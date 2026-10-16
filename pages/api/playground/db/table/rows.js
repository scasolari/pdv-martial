import db from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize } from "@/lib/externalDatabase";
import { finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";
import { maskSensitiveRows, normalizeDatabasePreferences } from "@/lib/databasePreferences";
import { databasePerformanceNow, markDatabasePerformance, recordDatabasePerformance, startDatabasePerformance } from "@/lib/databasePerformance";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_PAGE_SIZE = 5_000;
const MAX_TABLE_QUERY_TIME_MS = 15_000;
const FILTER_OPERATORS = new Set(["contains", "equals", "notEquals", "startsWith", "endsWith", "isEmpty", "isNotEmpty"]);

function parseFilters(rawFilters, availableColumns) {
    if (rawFilters === undefined) return [];
    if (typeof rawFilters !== "string" || rawFilters.length > 12_000) return null;
    let filters;
    try { filters = JSON.parse(rawFilters); } catch { return null; }
    if (!Array.isArray(filters) || filters.length > 12) return null;
    if (!filters.every((filter) => filter && typeof filter === "object" &&
        typeof filter.column === "string" && availableColumns.has(filter.column) &&
        FILTER_OPERATORS.has(filter.operator) &&
        (filter.conjunction === undefined || ["and", "or"].includes(filter.conjunction)) &&
        (["isEmpty", "isNotEmpty"].includes(filter.operator) ||
            (typeof filter.value === "string" && filter.value.length <= 500)))) return null;
    return filters.filter((filter) => ["isEmpty", "isNotEmpty"].includes(filter.operator) || filter.value.trim() !== "");
}

function buildFilterWhere(filters, queryGenerator, textColumns, caseInsensitiveTextColumns) {
    if (!filters.length) return { sql: "", replacements: [] };
    const groups = [[]];
    filters.forEach((filter, index) => {
        if (index > 0 && filter.conjunction === "or") groups.push([]);
        groups[groups.length - 1].push(filter);
    });
    const replacements = [];
    const conditions = groups.map((group) => `(${group.map((filter) => {
        const column = queryGenerator.quoteIdentifier(filter.column);
        const isTextColumn = textColumns.has(filter.column);
        const isCaseInsensitiveTextColumn = caseInsensitiveTextColumns.has(filter.column);
        // Avoid casting character columns on every row. CAST(... AS CHAR) is
        // only needed for non-text values to preserve the filter's string semantics.
        const caseInsensitiveColumn = isCaseInsensitiveTextColumn
            ? column
            : isTextColumn
                ? `LOWER(${column})`
                : `LOWER(CAST(${column} AS CHAR))`;
        const caseInsensitiveValue = isCaseInsensitiveTextColumn ? "?" : "LOWER(?)";
        switch (filter.operator) {
            case "equals":
                replacements.push(filter.value);
                return isTextColumn && !isCaseInsensitiveTextColumn
                    ? `${caseInsensitiveColumn} = LOWER(?)`
                    : `${column} = ?`;
            case "notEquals":
                replacements.push(filter.value);
                return isTextColumn && !isCaseInsensitiveTextColumn
                    ? `(${caseInsensitiveColumn} <> LOWER(?) OR ${column} IS NULL)`
                    : `(${column} <> ? OR ${column} IS NULL)`;
            case "startsWith": {
                const value = filter.value.replace(/!/g, "!!").replace(/%/g, "!%").replace(/_/g, "!_");
                replacements.push(`${value}%`);
                return `${caseInsensitiveColumn} LIKE ${caseInsensitiveValue} ESCAPE '!'`;
            }
            case "endsWith": {
                const value = filter.value.replace(/!/g, "!!").replace(/%/g, "!%").replace(/_/g, "!_");
                replacements.push(`%${value}`);
                return `${caseInsensitiveColumn} LIKE ${caseInsensitiveValue} ESCAPE '!'`;
            }
            case "isEmpty": return `(${column} IS NULL OR TRIM(CAST(${column} AS CHAR)) = '')`;
            case "isNotEmpty": return `(${column} IS NOT NULL AND TRIM(CAST(${column} AS CHAR)) <> '')`;
            case "contains":
            default: {
                const value = filter.value.replace(/!/g, "!!").replace(/%/g, "!%").replace(/_/g, "!_");
                replacements.push(`%${value}%`);
                return `${caseInsensitiveColumn} LIKE ${caseInsensitiveValue} ESCAPE '!'`;
            }
        }
    }).join(" AND ")})`);
    return { sql: `(${conditions.join(" OR ")})`, replacements };
}

function parseCursor(rawCursor, databaseId, table, primaryKeyRows) {
    if (!rawCursor) return null;
    try {
        const parsed = JSON.parse(decrypt(rawCursor));
        if (
            parsed.databaseId !== databaseId ||
            parsed.table !== table ||
            !Array.isArray(parsed.fields) ||
            !Array.isArray(parsed.values) ||
            parsed.fields.length !== primaryKeyRows.length ||
            parsed.values.length !== primaryKeyRows.length ||
            parsed.fields.some((field, index) => field !== primaryKeyRows[index].field)
        ) return null;
        return parsed.values.map((value) => (
            value && typeof value === "object" && value.type === "Buffer" && Array.isArray(value.data)
                ? Buffer.from(value.data)
                : value
        ));
    } catch {
        return null;
    }
}

function createCursor(row, primaryKeyRows, databaseId, table) {
    return encrypt(JSON.stringify({
        databaseId,
        table,
        fields: primaryKeyRows.map(({ field }) => field),
        values: primaryKeyRows.map(({ field }) => row[field]),
    }));
}

function buildCursorWhere(primaryKeyRows, queryGenerator, values, direction) {
    const comparator = direction === "previous" ? "<" : ">";
    const replacements = [];
    const branches = primaryKeyRows.map(({ field }, index) => {
        const parts = [];
        for (let prefix = 0; prefix < index; prefix += 1) {
            parts.push(`${queryGenerator.quoteIdentifier(primaryKeyRows[prefix].field)} = ?`);
            replacements.push(values[prefix]);
        }
        parts.push(`${queryGenerator.quoteIdentifier(field)} ${comparator} ?`);
        replacements.push(values[index]);
        return `(${parts.join(" AND ")})`;
    });
    return { sql: ` WHERE ${branches.join(" OR ")}`, replacements };
}

export default async function handler(req, res) {
    const operation = req.query?.count_only === "true" ? "table_count" : "table_page";
    const performanceContext = startDatabasePerformance("/api/playground/db/table/rows", operation);
    res.setHeader("X-Performance-Request-Id", performanceContext.requestId);
    let performanceStatus = "error";
    let performanceRows = 0;
    let performanceErrorCode;
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

    const { db_id, table, page: rawPage, pageSize: rawPageSize, count_only: rawCountOnly, cursor: rawCursor, direction: rawDirection, filters: rawFilters } = req.query;
    const isExport = req.query.export === "true";
    const countOnly = rawCountOnly === "true";
    const page = rawPage === undefined ? 0 : Number(rawPage);
    const requestedPageSize = rawPageSize === undefined ? undefined : Number(rawPageSize);
    const maxPageSize = isExport ? MAX_EXPORT_PAGE_SIZE : MAX_PAGE_SIZE;
    if (
        typeof db_id !== "string" ||
        typeof table !== "string" ||
        !table.trim() ||
        !Number.isSafeInteger(page) || page < 0 ||
        (requestedPageSize !== undefined && (!Number.isSafeInteger(requestedPageSize) || requestedPageSize < 1 || requestedPageSize > maxPageSize))
    ) {
        return res.status(400).json({ error: "Invalid table or pagination parameters." });
    }

    let sequelize;
    let auditId;
    let releaseConnectionSlot;
    try {
        let phaseStartedAt = databasePerformanceNow();
        const savedDatabase = await db.database.findUnique({
            where: { id: db_id, user_id: session.id },
        });
        markDatabasePerformance(performanceContext, "app_database_lookup", phaseStartedAt);
        if (!savedDatabase) {
            performanceStatus = "not_found";
            return res.status(404).json({ error: "Database not found." });
        }
        const preferences = normalizeDatabasePreferences(savedDatabase.preferences);
        const pageSize = requestedPageSize ?? preferences.pageSize;

        phaseStartedAt = databasePerformanceNow();
        releaseConnectionSlot = await acquireExternalConnectionSlot();
        markDatabasePerformance(performanceContext, "connection_slot_wait", phaseStartedAt);
        const connectionString = decrypt(savedDatabase.db_url_connection);
        phaseStartedAt = databasePerformanceNow();
        sequelize = await acquireExternalSequelize(connectionString);
        markDatabasePerformance(performanceContext, "external_connection_acquire", phaseStartedAt);

        const queryGenerator = sequelize.getQueryInterface().queryGenerator;
        const quotedTable = queryGenerator.quoteTable(table);
        phaseStartedAt = databasePerformanceNow();
        const [columnMetadata] = await sequelize.query(
            `SELECT COLUMN_NAME AS field, COLUMN_KEY AS columnKey, COLLATION_NAME AS collationName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
            { replacements: [table] }
        );
        markDatabasePerformance(performanceContext, "schema_metadata_query", phaseStartedAt);
        const availableColumns = new Set(columnMetadata.map(({ field }) => field));
        const textColumns = new Set(columnMetadata.map(({ field, collationName }) => collationName ? field : null).filter(Boolean));
        const caseInsensitiveTextColumns = new Set(columnMetadata
            .filter(({ collationName }) => typeof collationName === "string" && /_ci$/i.test(collationName))
            .map(({ field }) => field));
        const filters = parseFilters(rawFilters, availableColumns);
        if (filters === null) {
            const error = new Error("Invalid table filters.");
            error.statusCode = 400;
            throw error;
        }
        const filterWhere = buildFilterWhere(filters, queryGenerator, textColumns, caseInsensitiveTextColumns);
        const audit = await startDatabaseAudit({
            userId: session.id,
            databaseId: db_id,
            databaseName: savedDatabase.db_name,
            action: countOnly ? "SYSTEM_TABLE_COUNT" : "SYSTEM_TABLE_LOAD",
            tableName: table,
            query: countOnly
                ? `SELECT COUNT(*) AS total FROM ${quotedTable}`
                : [
                    "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY';",
                    `SELECT * FROM ${quotedTable}`,
                    filterWhere.sql ? "WHERE <validated filters>" : "",
                    rawCursor ? "WHERE <primary key cursor>" : "",
                    "ORDER BY <primary key>",
                    `LIMIT ${pageSize + 1}`,
                    rawCursor ? "" : `OFFSET ${page * pageSize}`,
                ].filter(Boolean).join(" "),
        });
        auditId = audit.id;
        const start = databasePerformanceNow();
        if (countOnly) {
            phaseStartedAt = databasePerformanceNow();
            const [countRows] = await sequelize.query(
                `SELECT /*+ MAX_EXECUTION_TIME(${MAX_TABLE_QUERY_TIME_MS}) */ COUNT(*) AS total FROM ${quotedTable}${filterWhere.sql ? ` WHERE ${filterWhere.sql}` : ""}`,
                { replacements: filterWhere.replacements }
            );
            markDatabasePerformance(performanceContext, "external_count_query", phaseStartedAt);
            const total = Number(countRows[0]?.total || 0);
            performanceRows = total;
            await finishDatabaseAudit(auditId, { status: "success", affectedRows: total });
            auditId = null;
            performanceStatus = "success";
            return res.status(200).json({
                count: total,
                totalPages: Math.ceil(total / pageSize),
                duration_ms: Math.round(databasePerformanceNow() - start),
            });
        }
        const primaryKeyRows = columnMetadata.filter(({ columnKey }) => columnKey === "PRI");
        const orderBy = primaryKeyRows.length
            ? ` ORDER BY ${primaryKeyRows.map(({ field }) => queryGenerator.quoteIdentifier(field)).join(", ")}`
            : "";
        const cursorSupported = primaryKeyRows.length > 0;
        const direction = rawDirection === "previous" ? "previous" : "next";
        const cursorValues = cursorSupported ? parseCursor(rawCursor, db_id, table, primaryKeyRows) : null;
        if (rawCursor && cursorSupported && !cursorValues) {
            performanceStatus = "rejected";
            await finishDatabaseAudit(auditId, { status: "failed", errorCode: "INVALID_CURSOR" });
            auditId = null;
            return res.status(400).json({ error: "Invalid table cursor." });
        }
        const currentPage = page;
        const offset = currentPage * pageSize;
        const cursorWhere = cursorValues ? buildCursorWhere(primaryKeyRows, queryGenerator, cursorValues, direction) : null;
        const orderDirection = cursorValues && direction === "previous" ? " DESC" : " ASC";
        const orderedKeys = cursorSupported
            ? ` ORDER BY ${primaryKeyRows.map(({ field }) => `${queryGenerator.quoteIdentifier(field)}${orderDirection}`).join(", ")}`
            : "";
        const conditions = [filterWhere.sql, cursorWhere?.sql.replace(/^\s*WHERE\s*/i, "")].filter(Boolean);
        const whereClause = conditions.length ? ` WHERE ${conditions.map((condition) => `(${condition})`).join(" AND ")}` : "";
        const paginationClause = cursorWhere
            ? `${whereClause}${orderedKeys} LIMIT ${pageSize + 1}`
            : `${whereClause}${orderBy} LIMIT ${pageSize + 1} OFFSET ${offset}`;
        phaseStartedAt = databasePerformanceNow();
        const [rows] = await sequelize.query(
            `SELECT /*+ MAX_EXECUTION_TIME(${MAX_TABLE_QUERY_TIME_MS}) */ * FROM ${quotedTable}${paginationClause}`,
            { replacements: [...filterWhere.replacements, ...(cursorWhere?.replacements || [])] }
        );
        markDatabasePerformance(performanceContext, "external_page_query", phaseStartedAt);
        const hasExtraRow = rows.length > pageSize;
        const pageRows = hasExtraRow ? rows.slice(0, pageSize) : rows;
        performanceRows = pageRows.length;
        const visibleRows = cursorValues && direction === "previous" ? pageRows.reverse() : pageRows;
        const hasNext = cursorValues && direction === "previous" ? visibleRows.length > 0 : hasExtraRow;
        const hasPrevious = cursorValues && direction === "previous" ? hasExtraRow : page > 0;
        const identityField = primaryKeyRows.length === 1 ? primaryKeyRows[0].field : null;
        const rowsWithIdentityTokens = identityField
            ? visibleRows.map((row) => ({
                ...row,
                __rowToken: encrypt(JSON.stringify({ databaseId: db_id, table, field: identityField, value: row[identityField] })),
            }))
            : visibleRows;
        try {
            await finishDatabaseAudit(auditId, { status: "success", affectedRows: visibleRows.length });
        } catch (auditError) {
            console.error("Could not finalize table load audit event", auditError?.code || "AUDIT_FAILED");
        }

        performanceStatus = "success";
        return res.status(200).json({
            data: maskSensitiveRows(rowsWithIdentityTokens, preferences.sensitiveColumns),
            sensitiveColumns: preferences.sensitiveColumns,
            count: null,
            countPending: true,
            hasNext,
            hasPrevious,
            cursorSupported,
            nextCursor: cursorSupported && visibleRows.length ? createCursor(visibleRows[visibleRows.length - 1], primaryKeyRows, db_id, table) : null,
            previousCursor: cursorSupported && visibleRows.length ? createCursor(visibleRows[0], primaryKeyRows, db_id, table) : null,
            page: currentPage,
            pageSize,
            duration_ms: Math.round(databasePerformanceNow() - start),
        });
    } catch (error) {
        performanceStatus = error.statusCode === 400 ? "rejected" : "error";
        performanceErrorCode = safeDatabaseErrorCode(error);
        if (auditId) {
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch {}
        }
        console.error("Unable to fetch database table page", error?.original?.code || error?.name || "unknown");
        return res.status(error.statusCode || 400).json({ error: "Unable to load table rows." });
    } finally {
        if (sequelize) {
            try {
                releaseExternalSequelize(sequelize);
            } catch {}
        }
        await releaseConnectionSlot?.();
        recordDatabasePerformance(performanceContext, {
            status: performanceStatus,
            rowsReturned: operation === "table_page" ? performanceRows : undefined,
            rowsCounted: operation === "table_count" ? performanceRows : undefined,
            errorCode: performanceErrorCode,
        });
    }
}
