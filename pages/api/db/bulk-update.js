import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { parseStoredConnectionConfig } from "@/lib/databaseConnectionConfig";
import { nullSafeEqualsSql, quoteSqlIdentifier } from "@/lib/sqlIdentifiers";
import { decrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize } from "@/lib/externalDatabase";
import { finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409 });
const invalidInsert = (message) => Object.assign(new Error(message), { statusCode: 422 });
const invalidValue = (message) => Object.assign(new Error(message), { statusCode: 422 });
const NUMERIC_TYPES = /^(tinyint|smallint|mediumint|int|integer|bigint|year|decimal|numeric|float|double|real|smallserial|serial|bigserial|int2|int4|int8|float4|float8|double precision)$/;
const NUMERIC_VALUE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function toSqlValue(value, dataType) {
    if (value && value.type === "Buffer" && Array.isArray(value.data)) return Buffer.from(value.data);
    if (["json", "jsonb"].includes(dataType) && value !== null && typeof value === "object") return JSON.stringify(value);
    return value;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed." });
    }

    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    const { db_id, table, pkField, rows, inserts = [] } = req.body || {};
    if (
        typeof db_id !== "string" ||
        typeof table !== "string" || !table.trim() || table.length > 128 ||
        typeof pkField !== "string" || !pkField.trim() || pkField.length > 128 ||
        !Array.isArray(rows) || rows.length > 500 ||
        !Array.isArray(inserts) || inserts.length > 500 ||
        rows.length + inserts.length === 0 || rows.length + inserts.length > 500
    ) {
        return res.status(400).json({ error: "Invalid bulk update payload." });
    }

    let sequelize;
    let auditId;
    let releaseConnectionSlot;
    try {
        const savedDatabase = await db.database.findFirst({
            where: { id: db_id, user_id: session.id },
            select: { db_url_connection: true, db_name: true },
        });
        if (!savedDatabase) return res.status(404).json({ error: "Database not found." });

        releaseConnectionSlot = await acquireExternalConnectionSlot();
        const connectionConfig = parseStoredConnectionConfig(decrypt(savedDatabase.db_url_connection));
        const { connectionString } = connectionConfig;
        sequelize = await acquireExternalSequelize(connectionString, session.id, connectionConfig);

        const dialect = sequelize.getDialect();
        const isPostgres = dialect === "postgres";
        let columns;
        if (dialect === "sqlite") {
            const [pragmaColumns] = await sequelize.query(`PRAGMA table_info(${quoteSqlIdentifier(sequelize, table)})`);
            columns = pragmaColumns.map((column) => ({ field: column.name, columnKey: column.pk ? "PRI" : "", dataType: String(column.type || "").toLowerCase(), columnType: column.type, isNullable: column.notnull ? "NO" : "YES", defaultValue: column.dflt_value, extra: "" }));
        } else if (dialect === "mssql") {
            [columns] = await sequelize.query(`SELECT c.COLUMN_NAME AS field, CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PRI' ELSE '' END AS columnKey, c.DATA_TYPE AS dataType, c.DATA_TYPE AS columnType, c.IS_NULLABLE AS isNullable, c.COLUMN_DEFAULT AS defaultValue, CASE WHEN c.IS_IDENTITY = 'YES' THEN 'identity' ELSE '' END AS extra FROM INFORMATION_SCHEMA.COLUMNS c LEFT JOIN (SELECT ku.TABLE_NAME, ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY') pk ON pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME WHERE c.TABLE_NAME = ?`, { replacements: [table] });
        } else {
            [columns] = await sequelize.query(isPostgres
            ? `SELECT c.column_name AS field, CASE WHEN EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name) THEN 'PRI' ELSE '' END AS "columnKey", c.data_type AS "dataType", c.udt_name AS "columnType", c.is_nullable AS "isNullable", c.column_default AS "defaultValue", CASE WHEN c.is_identity = 'YES' OR c.column_default LIKE 'nextval(%' THEN 'auto_increment' ELSE '' END AS extra FROM information_schema.columns c WHERE c.table_schema = current_schema() AND c.table_name = ?`
            : "SELECT COLUMN_NAME AS field, COLUMN_KEY AS columnKey, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            { replacements: [table] });
        }
        if (!columns.length) return res.status(404).json({ error: "Table not found." });
        const updatedColumns = [...new Set(rows.flatMap((row) => isRecord(row?.changes) ? Object.keys(row.changes) : []))];
        const insertedColumns = [...new Set(inserts.flatMap((row) => isRecord(row) ? Object.keys(row) : []))];
        const auditQueries = [];
        if (rows.length) {
            auditQueries.push(updatedColumns.length
                ? `UPDATE ${quoteSqlIdentifier(sequelize, table)} SET ${updatedColumns.map((field) => `${quoteSqlIdentifier(sequelize, field)} = ?`).join(", ")} WHERE ${nullSafeEqualsSql(dialect, quoteSqlIdentifier(sequelize, pkField), "?")}`
                : `UPDATE ${quoteSqlIdentifier(sequelize, table)} SET <edited columns> WHERE ${nullSafeEqualsSql(dialect, quoteSqlIdentifier(sequelize, pkField), "?")}`);
        }
        if (inserts.length) {
            auditQueries.push(insertedColumns.length
                ? `INSERT INTO ${quoteSqlIdentifier(sequelize, table)} (${insertedColumns.map((field) => quoteSqlIdentifier(sequelize, field)).join(", ")}) VALUES (${insertedColumns.map(() => "?").join(", ")})`
                : `INSERT INTO ${quoteSqlIdentifier(sequelize, table)} (<columns>) VALUES (<values>)`);
        }
        const audit = await startDatabaseAudit({
            userId: session.id,
            databaseId: db_id,
            databaseName: savedDatabase.db_name,
            action: "BULK_UPDATE",
            query: auditQueries.join("; "),
            tableName: table,
        });
        auditId = audit.id;

        let uniqueKeyRows;
        if (dialect === "sqlite") {
            uniqueKeyRows = [];
            const [indexes] = await sequelize.query(`PRAGMA index_list(${quoteSqlIdentifier(sequelize, table)})`);
            for (const index of indexes.filter((item) => item.unique)) {
                const [indexColumns] = await sequelize.query(`PRAGMA index_info('${String(index.name).replace(/'/g, "''")}')`);
                if (indexColumns.length === 1) uniqueKeyRows.push({ field: indexColumns[0].name });
            }
        } else if (dialect === "mssql") {
            [uniqueKeyRows] = await sequelize.query(`SELECT MIN(c.name) AS field FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id WHERE i.object_id = OBJECT_ID(?) AND i.is_unique = 1 GROUP BY i.index_id HAVING COUNT(*) = 1`, { replacements: [table] });
        } else {
            [uniqueKeyRows] = await sequelize.query(isPostgres
            ? `SELECT kcu.column_name AS field FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = current_schema() AND tc.table_name = ? AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE') AND (SELECT COUNT(*) FROM information_schema.key_column_usage k2 WHERE k2.constraint_name = tc.constraint_name AND k2.table_schema = tc.table_schema) = 1`
            : "SELECT MIN(COLUMN_NAME) AS field FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND NON_UNIQUE = 0 GROUP BY INDEX_NAME HAVING COUNT(*) = 1",
            { replacements: [table] });
        }
        const allowedColumns = new Set(columns.map((column) => column.field));
        const columnByName = new Map(columns.map((column) => [column.field, column]));
        const tableSql = quoteSqlIdentifier(sequelize, table);

        const result = await sequelize.transaction(async (transaction) => {
            let updatedRows = 0;
            let insertedRows = 0;
            const insertedIds = [];
            const seenRowIndexes = new Set();
            for (const rowUpdate of rows) {
                if (!isRecord(rowUpdate) || !Number.isInteger(rowUpdate.rowIndex) || rowUpdate.rowIndex < 0 ||
                    !isRecord(rowUpdate.original) || !isRecord(rowUpdate.changes)) {
                    throw new Error("Invalid row change.");
                }
                if (seenRowIndexes.has(rowUpdate.rowIndex)) throw new Error("Duplicate row in bulk update.");
                seenRowIndexes.add(rowUpdate.rowIndex);

                const originalWithMetadata = rowUpdate.original;
                let rowIdentity = null;
                if (typeof originalWithMetadata.__rowToken === "string") {
                    try {
                        rowIdentity = JSON.parse(decrypt(originalWithMetadata.__rowToken));
                    } catch {
                        throw conflict("The row identity is invalid. Reload the table and retry.");
                    }
                    if (rowIdentity.databaseId !== db_id || rowIdentity.table !== table || rowIdentity.field !== pkField) {
                        throw conflict("The row identity does not match this table. Reload the table and retry.");
                    }
                    const displayedPrimaryKey = originalWithMetadata[pkField];
                    if (displayedPrimaryKey !== "••••••••" && String(displayedPrimaryKey) !== String(rowIdentity.value)) {
                        throw conflict("The row identity does not match the loaded row. Reload the table and retry.");
                    }
                }
                const original = Object.fromEntries(Object.entries(originalWithMetadata).filter(([field]) => field !== "__rowToken"));
                const { changes: rowChanges } = rowUpdate;
                if (Object.keys(original).length !== columns.length || columns.some((column) => !Object.hasOwn(original, column.field))) {
                    throw conflict("The row shape does not match the current table. Reload the table and retry.");
                }
                const fields = Object.entries(rowChanges);
                if (!fields.length || fields.length > columns.length) throw new Error("Invalid changed columns.");

                const replacements = {};
                const assignments = [];
                fields.forEach(([field, diff], index) => {
                    if (!allowedColumns.has(field) || !isRecord(diff) || !Object.hasOwn(diff, "after") || !Object.hasOwn(diff, "before")) {
                        throw new Error("Invalid changed column.");
                    }
                    if (String(diff.before ?? "") !== String(original[field] ?? "")) {
                        throw conflict("The row changed after it was loaded. Reload the table and retry.");
                    }
                    if (String(columnByName.get(field).extra).toLowerCase().includes("generated")) {
                        throw new Error("Generated columns cannot be edited.");
                    }
                    const value = diff.after;
                    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
                        throw new Error("Unsupported cell value.");
                    }
                    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid numeric value.");

                    const column = columnByName.get(field);
                    const dataType = String(column.dataType).toLowerCase();
                    const columnType = String(column.columnType || "").toLowerCase();
                    const isNullable = column.isNullable === true || column.isNullable === "YES";
                    let sqlValue = value;
                    if (sqlValue === "" && isNullable) sqlValue = null;
                    if (sqlValue === null && !isNullable) throw invalidValue(`Column ${field} cannot be empty.`);
                    if (sqlValue !== null && typeof sqlValue === "string" && NUMERIC_TYPES.test(dataType)) {
                        if (!NUMERIC_VALUE.test(sqlValue.trim())) throw invalidValue(`Column ${field} requires a valid number.`);
                        if (columnType.includes("unsigned") && Number(sqlValue) < 0) {
                            throw invalidValue(`Column ${field} cannot be negative.`);
                        }
                    }
                    if (["datetime", "timestamp"].includes(dataType) && typeof sqlValue === "string") {
                        sqlValue = sqlValue.replace("T", " ");
                    }
                    if (["json", "jsonb"].includes(dataType) && typeof sqlValue === "string") {
                        try { JSON.parse(sqlValue); } catch { throw invalidValue(`Column ${field} requires valid JSON.`); }
                    }

                    const replacement = `value${index}`;
                    assignments.push(`${quoteSqlIdentifier(sequelize, field)} = :${replacement}`);
                    replacements[replacement] = toSqlValue(sqlValue, dataType);
                });

                const where = [];
                const originalPk = pkField && (rowIdentity ? rowIdentity.value : original[pkField]);
                const canUseUniqueKey = uniqueKeyRows.some((key) => key.field === pkField) && originalPk !== null && originalPk !== undefined;
                if (canUseUniqueKey) {
                    where.push(nullSafeEqualsSql(dialect, quoteSqlIdentifier(sequelize, pkField), ":originalKey"));
                    replacements.originalKey = toSqlValue(originalPk, columnByName.get(pkField).dataType);
                    for (const [field, diff] of fields) {
                        const oldName = `original${where.length}`;
                        where.push(nullSafeEqualsSql(dialect, quoteSqlIdentifier(sequelize, field), `:${oldName}`));
                        replacements[oldName] = toSqlValue(diff.before, columnByName.get(field).dataType);
                    }
                } else {
                    columns.forEach((column, index) => {
                        const oldName = `original${index}`;
                        where.push(nullSafeEqualsSql(dialect, quoteSqlIdentifier(sequelize, column.field), `:${oldName}`));
                        replacements[oldName] = toSqlValue(original[column.field], column.dataType);
                    });
                }

                const whereSql = where.join(" AND ");
                const lockHint = dialect === "mssql" ? " WITH (UPDLOCK, HOLDLOCK)" : "";
                const [matchingRows] = await sequelize.query(
                    `${dialect === "mssql" ? "SELECT TOP (2) 1 AS matched" : "SELECT 1 AS matched"} FROM ${tableSql}${lockHint} WHERE ${whereSql}${dialect === "mssql" ? "" : dialect === "postgres" ? " FOR UPDATE" : " LIMIT 2"}`,
                    { replacements, transaction }
                );
                if (matchingRows.length === 0) throw conflict("The row no longer matches its original values. Reload the table and retry.");
                if (matchingRows.length > 1) throw conflict("Identical rows cannot be updated safely without a unique key.");

                await sequelize.query(
                    `UPDATE ${tableSql} SET ${assignments.join(", ")} WHERE ${whereSql}`,
                    { replacements, transaction }
                );
                updatedRows += 1;
            }

            for (const insert of inserts) {
                if (!isRecord(insert) || !isRecord(insert.values)) throw invalidInsert("Invalid inserted row.");
                const entries = Object.entries(insert.values);
                if (entries.length > columns.length) throw invalidInsert("Invalid inserted columns.");

                const replacements = {};
                const fields = [];
                const placeholders = [];
                for (const [field, value] of entries) {
                    if (!allowedColumns.has(field)) throw invalidInsert("Invalid inserted column.");
                    const column = columnByName.get(field);
                    const extra = String(column.extra || "").toLowerCase();
                    if (extra.includes("generated") || extra.includes("auto_increment")) {
                        throw invalidInsert("Generated columns cannot be inserted.");
                    }
                    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
                        throw invalidInsert("Unsupported inserted value.");
                    }
                    if (typeof value === "number" && !Number.isFinite(value)) throw invalidInsert("Invalid numeric value.");

                    const isNullable = column.isNullable === true || column.isNullable === "YES";
                    const hasNoDefault = column.defaultValue === null || column.defaultValue === undefined;
                    const isRequired = !isNullable && hasNoDefault &&
                        !extra.includes("auto_increment") && !extra.includes("generated");
                    if ((value === "" || value === null) && isRequired) throw invalidInsert(`Column ${field} is required.`);

                    let sqlValue = value === "" && isNullable ? null : value;
                    if (sqlValue !== null && typeof sqlValue === "string" &&
                        NUMERIC_TYPES.test(column.dataType) &&
                        !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(sqlValue)) {
                        throw invalidInsert(`Column ${field} requires a valid number.`);
                    }
                    if (["datetime", "timestamp"].includes(column.dataType) && typeof sqlValue === "string") {
                        sqlValue = sqlValue.replace("T", " ");
                    }
                    if (["json", "jsonb"].includes(column.dataType) && typeof sqlValue === "string") {
                        try { JSON.parse(sqlValue); } catch { throw invalidInsert(`Column ${field} requires valid JSON.`); }
                    }

                    const replacement = `insert${insertedRows}_${fields.length}`;
                    fields.push(quoteSqlIdentifier(sequelize, field));
                    placeholders.push(`:${replacement}`);
                    replacements[replacement] = toSqlValue(sqlValue, column.dataType);
                }

                for (const column of columns) {
                    const extra = String(column.extra || "").toLowerCase();
                    const hasValue = Object.hasOwn(insert.values, column.field);
                    const isNullable = column.isNullable === true || column.isNullable === "YES";
                    const hasNoDefault = column.defaultValue === null || column.defaultValue === undefined;
                    if (!hasValue && !isNullable && hasNoDefault &&
                        !extra.includes("auto_increment") && !extra.includes("generated")) {
                        throw invalidInsert(`Column ${column.field} is required.`);
                    }
                }

                const insertSql = fields.length
                    ? `INSERT INTO ${tableSql} (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`
                    : (isPostgres || dialect === "sqlite" || dialect === "mssql" ? `INSERT INTO ${tableSql} DEFAULT VALUES` : `INSERT INTO ${tableSql} () VALUES ()`);
                const [insertResult] = await sequelize.query(isPostgres ? `${insertSql} RETURNING *` : insertSql, { replacements, transaction });
                insertedIds.push(insertResult?.insertId ?? null);
                insertedRows += 1;
            }
            return { updatedRows, insertedRows, insertedIds };
        });

        try {
            await finishDatabaseAudit(auditId, { status: "success", affectedRows: result.updatedRows + result.insertedRows });
        } catch (auditError) {
            console.error("Could not finalize database audit event", auditError?.code || "AUDIT_FAILED");
        }
        return res.status(200).json(result);
    } catch (error) {
        if (auditId) {
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch (auditError) { console.error("Unable to finalize database audit", safeDatabaseErrorCode(auditError)); }
        }
        console.error("Bulk database update failed", safeDatabaseErrorCode(error));
        return res.status(error.statusCode || 400).json({ error: error.statusCode ? error.message : "Bulk update failed. Check the values and database permissions." });
    } finally {
        if (sequelize) {
            releaseExternalSequelize(sequelize);
        }
        await releaseConnectionSlot?.();
    }
}
