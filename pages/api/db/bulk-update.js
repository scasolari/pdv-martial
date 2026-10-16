import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { decrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize } from "@/lib/externalDatabase";
import { finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409 });
const invalidInsert = (message) => Object.assign(new Error(message), { statusCode: 422 });
const invalidValue = (message) => Object.assign(new Error(message), { statusCode: 422 });
const NUMERIC_TYPES = /^(tinyint|smallint|mediumint|int|integer|bigint|year|decimal|numeric|float|double|real)$/;
const NUMERIC_VALUE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function toSqlValue(value, dataType) {
    if (value && value.type === "Buffer" && Array.isArray(value.data)) return Buffer.from(value.data);
    if (dataType === "json" && value !== null && typeof value === "object") return JSON.stringify(value);
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
        const connectionString = decrypt(savedDatabase.db_url_connection);
        sequelize = await acquireExternalSequelize(connectionString);

        if (sequelize.getDialect() !== "mysql") {
            return res.status(400).json({ error: "Bulk edits currently require a MySQL database." });
        }

        const [columns] = await sequelize.query(
            "SELECT COLUMN_NAME AS field, COLUMN_KEY AS columnKey, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            { replacements: [table] }
        );
        if (!columns.length) return res.status(404).json({ error: "Table not found." });
        const quoteAuditIdentifier = (identifier) => `\`${String(identifier).replace(/`/g, "``")}\``;
        const updatedColumns = [...new Set(rows.flatMap((row) => isRecord(row?.changes) ? Object.keys(row.changes) : []))];
        const insertedColumns = [...new Set(inserts.flatMap((row) => isRecord(row) ? Object.keys(row) : []))];
        const auditQueries = [];
        if (rows.length) {
            auditQueries.push(updatedColumns.length
                ? `UPDATE ${quoteAuditIdentifier(table)} SET ${updatedColumns.map((field) => `${quoteAuditIdentifier(field)} = ?`).join(", ")} WHERE ${quoteAuditIdentifier(pkField)} <=> ?`
                : `UPDATE ${quoteAuditIdentifier(table)} SET <edited columns> WHERE ${quoteAuditIdentifier(pkField)} <=> ?`);
        }
        if (inserts.length) {
            auditQueries.push(insertedColumns.length
                ? `INSERT INTO ${quoteAuditIdentifier(table)} (${insertedColumns.map(quoteAuditIdentifier).join(", ")}) VALUES (${insertedColumns.map(() => "?").join(", ")})`
                : `INSERT INTO ${quoteAuditIdentifier(table)} (<columns>) VALUES (<values>)`);
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

        const [uniqueKeyRows] = await sequelize.query(
            "SELECT MIN(COLUMN_NAME) AS field FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND NON_UNIQUE = 0 GROUP BY INDEX_NAME HAVING COUNT(*) = 1",
            { replacements: [table] }
        );
        const allowedColumns = new Set(columns.map((column) => column.field));
        const columnByName = new Map(columns.map((column) => [column.field, column]));
        const quoteIdentifier = (identifier) => `\`${String(identifier).replace(/`/g, "``")}\``;
        const tableSql = quoteIdentifier(table);

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
                    if (dataType === "json" && typeof sqlValue === "string") {
                        try { JSON.parse(sqlValue); } catch { throw invalidValue(`Column ${field} requires valid JSON.`); }
                    }

                    const replacement = `value${index}`;
                    assignments.push(`${quoteIdentifier(field)} = :${replacement}`);
                    replacements[replacement] = toSqlValue(sqlValue, dataType);
                });

                const where = [];
                const originalPk = pkField && (rowIdentity ? rowIdentity.value : original[pkField]);
                const canUseUniqueKey = uniqueKeyRows.some((key) => key.field === pkField) && originalPk !== null && originalPk !== undefined;
                if (canUseUniqueKey) {
                    where.push(`${quoteIdentifier(pkField)} <=> :originalKey`);
                    replacements.originalKey = toSqlValue(originalPk, columnByName.get(pkField).dataType);
                    for (const [field, diff] of fields) {
                        const oldName = `original${where.length}`;
                        where.push(`${quoteIdentifier(field)} <=> :${oldName}`);
                        replacements[oldName] = toSqlValue(diff.before, columnByName.get(field).dataType);
                    }
                } else {
                    columns.forEach((column, index) => {
                        const oldName = `original${index}`;
                        where.push(`${quoteIdentifier(column.field)} <=> :${oldName}`);
                        replacements[oldName] = toSqlValue(original[column.field], column.dataType);
                    });
                }

                const whereSql = where.join(" AND ");
                const [matchingRows] = await sequelize.query(
                    `SELECT 1 AS matched FROM ${tableSql} WHERE ${whereSql} LIMIT 2 FOR UPDATE`,
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
                        /^(tinyint|smallint|mediumint|int|integer|bigint|year|decimal|numeric|float|double|real)$/.test(column.dataType) &&
                        !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(sqlValue)) {
                        throw invalidInsert(`Column ${field} requires a valid number.`);
                    }
                    if (["datetime", "timestamp"].includes(column.dataType) && typeof sqlValue === "string") {
                        sqlValue = sqlValue.replace("T", " ");
                    }
                    if (column.dataType === "json" && typeof sqlValue === "string") {
                        try { JSON.parse(sqlValue); } catch { throw invalidInsert(`Column ${field} requires valid JSON.`); }
                    }

                    const replacement = `insert${insertedRows}_${fields.length}`;
                    fields.push(quoteIdentifier(field));
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
                    : `INSERT INTO ${tableSql} () VALUES ()`;
                const [insertResult] = await sequelize.query(insertSql, { replacements, transaction });
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
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch {}
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
