import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize } from "@/lib/externalDatabase";
import { finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";
import { databasePerformanceNow, markDatabasePerformance, recordDatabasePerformance, startDatabasePerformance } from "@/lib/databasePerformance";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    const performanceContext = startDatabasePerformance("/api/playground/db/table", "schema_load");
    res.setHeader("X-Performance-Request-Id", performanceContext.requestId);
    let performanceStatus = "error";
    let performanceRows = 0;
    let performanceErrorCode;
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;
    const { db_id } = req.query;

    if (req.method !== "GET" || typeof db_id !== "string") {
        return res.status(400).json({ message: "Invalid request." });
    }

    let sequelize;
    let auditId;
    let releaseConnectionSlot;

    try {
        let phaseStartedAt = databasePerformanceNow();
        const fetchDatabase = await db.database.findUnique({
            where: { id: db_id, user_id: session.id },
        });
        markDatabasePerformance(performanceContext, "app_database_lookup", phaseStartedAt);

        if (!fetchDatabase) {
            performanceStatus = "not_found";
            return res.status(404).json({ message: "Database not found." });
        }

        // ✅ decifra la connection string salvata nel DB
        phaseStartedAt = databasePerformanceNow();
        releaseConnectionSlot = await acquireExternalConnectionSlot();
        markDatabasePerformance(performanceContext, "connection_slot_wait", phaseStartedAt);
        const connectionString = decrypt(fetchDatabase.db_url_connection);
        phaseStartedAt = databasePerformanceNow();
        sequelize = await acquireExternalSequelize(connectionString);
        markDatabasePerformance(performanceContext, "external_connection_acquire", phaseStartedAt);

        const audit = await startDatabaseAudit({
            userId: session.id,
            databaseId: db_id,
            databaseName: fetchDatabase.db_name,
            action: "SYSTEM_SCHEMA_LOAD",
            query: "SHOW TABLES; SELECT table metadata FROM information_schema.TABLES; SELECT column metadata FROM information_schema.COLUMNS",
        });
        auditId = audit.id;

        // Ottieni l'elenco delle tabelle
        phaseStartedAt = databasePerformanceNow();
        const fetch_query = await sequelize.query("SHOW tables;");
        const tables = fetch_query[0];

        // Fetch all table and column metadata in two round trips instead of one
        // DESCRIBE and one exact COUNT(*) query for every table.
        let tableInfoByName = new Map();
        let columnsByTableName = new Map();
        const [tableInfoRows] = await sequelize.query(`
            SELECT TABLE_NAME, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH,
                   TABLE_COLLATION, CREATE_TIME, UPDATE_TIME, TABLE_COMMENT
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE();
        `);
        tableInfoByName = new Map(tableInfoRows.map((info) => [info.TABLE_NAME, info]));

        const [columnRows] = await sequelize.query(`
            SELECT TABLE_NAME, COLUMN_NAME AS field, COLUMN_TYPE AS type,
                   IS_NULLABLE AS nullable, COLUMN_KEY AS columnKey,
                   COLUMN_DEFAULT AS columnDefault, EXTRA AS extra
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME, ORDINAL_POSITION;
        `);
        markDatabasePerformance(performanceContext, "external_schema_queries", phaseStartedAt);
        for (const column of columnRows) {
            const tableColumns = columnsByTableName.get(column.TABLE_NAME) || [];
            tableColumns.push(column);
            columnsByTableName.set(column.TABLE_NAME, tableColumns);
        }

        const tablesWithDetails = tables.map((tableObj) => {
            const tableKey = Object.keys(tableObj).find(
                (key) => key.startsWith("Tables_in_") || key.toLowerCase().includes("table")
            );
            const tableName = tableObj[tableKey] || Object.values(tableObj)[0];

            try {
                const columns = columnsByTableName.get(tableName) || [];
                const tableInfo = tableInfoByName.get(tableName) || {};

                return {
                    ...tableObj,
                    tableName,
                    details: {
                        columns: columns.map((col) => ({
                            field: col.field,
                            type: col.type,
                            null: col.nullable === "YES",
                            key: col.columnKey,
                            default: col.columnDefault,
                            extra: col.extra,
                        })),
                        rowCount: tableInfo.TABLE_ROWS == null ? null : Number(tableInfo.TABLE_ROWS),
                        tableInfo,
                        statistics: {
                            totalColumns: columns.length,
                            primaryKeys: columns.filter((col) => col.columnKey === "PRI").length,
                            indexes: columns.filter((col) => col.columnKey !== "").length,
                            nullableColumns: columns.filter((col) => col.nullable === "YES").length,
                        },
                    },
                };
            } catch (error) {
                return {
                    ...tableObj,
                    tableName,
                    details: null,
                    error: `Failed to fetch table details: ${error.message}`,
                };
            }
        });

        try {
            await finishDatabaseAudit(auditId, { status: "success", affectedRows: tablesWithDetails.length });
        } catch (auditError) {
            console.error("Could not finalize schema load audit event", auditError?.code || "AUDIT_FAILED");
        }

        performanceRows = tablesWithDetails.length;
        performanceStatus = "success";
        return res.status(200).json({
            data: tablesWithDetails,
            summary: {
                totalTables: tablesWithDetails.length,
                tablesWithErrors: tablesWithDetails.filter((t) => t.error).length,
                databaseName: fetchDatabase.name || "Unknown",
            },
        });
    } catch (error) {
        performanceErrorCode = safeDatabaseErrorCode(error);
        if (auditId) {
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch {}
        }
        return res.status(error.statusCode || 400).json({
            message: "Database connection failed",
            error: "Database connection failed.",
        });
    } finally {
        if (sequelize) {
            try {
                releaseExternalSequelize(sequelize);
            } catch {}
        }
        await releaseConnectionSlot?.();
        recordDatabasePerformance(performanceContext, {
            status: performanceStatus,
            rowsReturned: performanceRows,
            errorCode: performanceErrorCode,
        });
    }
}
