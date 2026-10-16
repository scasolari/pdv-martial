import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { decrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize } from "@/lib/externalDatabase";
import { finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409 });
const toSqlValue = (value, dataType) => {
    if (value && value.type === "Buffer" && Array.isArray(value.data)) return Buffer.from(value.data);
    if (["datetime", "timestamp"].includes(dataType) && typeof value === "string") {
        return value.replace("T", " ").replace(/(?:Z|[+-]\d{2}:\d{2})$/, "");
    }
    if (dataType === "json" && value !== null && typeof value === "object") return JSON.stringify(value);
    return value;
};

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed." });
    }

    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    const { db_id, table, rows } = req.body || {};
    if (typeof db_id !== "string" || typeof table !== "string" || !table.trim() || table.length > 128 ||
        !Array.isArray(rows) || rows.length === 0 || rows.length > 500 || !rows.every(isRecord)) {
        return res.status(400).json({ error: "Invalid bulk delete payload." });
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
        sequelize = await acquireExternalSequelize(decrypt(savedDatabase.db_url_connection));
        if (sequelize.getDialect() !== "mysql") {
            return res.status(400).json({ error: "Bulk deletes currently require a MySQL database." });
        }

        const [columns] = await sequelize.query(
            "SELECT COLUMN_NAME AS field, DATA_TYPE AS dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            { replacements: [table] }
        );
        if (!columns.length) return res.status(404).json({ error: "Table not found." });

        const quoteIdentifier = (identifier) => `\`${String(identifier).replace(/`/g, "``")}\``;
        const audit = await startDatabaseAudit({
            userId: session.id,
            databaseId: db_id,
            databaseName: savedDatabase.db_name,
            action: "BULK_DELETE",
            query: `DELETE FROM ${quoteIdentifier(table)} WHERE ${columns.map((column) => `${quoteIdentifier(column.field)} <=> ?`).join(" AND ")}`,
            tableName: table,
        });
        auditId = audit.id;

        const tableSql = quoteIdentifier(table);

        const deletedRows = await sequelize.transaction(async (transaction) => {
            let deletedCount = 0;
            for (const original of rows) {
                if (Object.keys(original).length !== columns.length || columns.some((column) => !Object.hasOwn(original, column.field))) {
                    throw conflict("The selected rows do not match the current table. Refresh and try again.");
                }

                const replacements = {};
                const where = columns.map((column, index) => {
                    const key = `original${index}`;
                    replacements[key] = toSqlValue(original[column.field], column.dataType);
                    return `${quoteIdentifier(column.field)} <=> :${key}`;
                });
                const whereSql = where.join(" AND ");
                const [matches] = await sequelize.query(
                    `SELECT 1 AS matched FROM ${tableSql} WHERE ${whereSql} LIMIT 2 FOR UPDATE`,
                    { replacements, transaction }
                );
                if (matches.length === 0) throw conflict("A selected row changed or was already deleted. Refresh and try again.");
                if (matches.length > 1) throw conflict("Identical rows cannot be deleted safely without a unique key.");

                const [result, metadata] = await sequelize.query(
                    `DELETE FROM ${tableSql} WHERE ${whereSql}`,
                    { replacements, transaction }
                );
                const affectedRows = result?.affectedRows ?? metadata?.affectedRows;
                if (affectedRows !== 1) throw conflict("A selected row changed before it could be deleted.");
                deletedCount += 1;
            }
            return deletedCount;
        });

        try {
            await finishDatabaseAudit(auditId, { status: "success", affectedRows: deletedRows });
        } catch (auditError) {
            console.error("Could not finalize database audit event", auditError?.code || "AUDIT_FAILED");
        }
        return res.status(200).json({ deletedRows });
    } catch (error) {
        if (auditId) {
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch {}
        }
        console.error("Bulk database delete failed", safeDatabaseErrorCode(error));
        return res.status(error.statusCode || 400).json({ error: error.statusCode ? error.message : "Bulk delete failed." });
    } finally {
        if (sequelize) {
            releaseExternalSequelize(sequelize);
        }
        await releaseConnectionSlot?.();
    }
}
