import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize } from "@/lib/externalDatabase";
import { finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";
import { databasePerformanceNow, markDatabasePerformance, recordDatabasePerformance, startDatabasePerformance } from "@/lib/databasePerformance";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { parseStoredConnectionConfig } from "@/lib/databaseConnectionConfig";

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
        const connectionConfig = parseStoredConnectionConfig(decrypt(fetchDatabase.db_url_connection));
        const { connectionString } = connectionConfig;
        phaseStartedAt = databasePerformanceNow();
        sequelize = await acquireExternalSequelize(connectionString, session.id, connectionConfig);
        markDatabasePerformance(performanceContext, "external_connection_acquire", phaseStartedAt);

        const audit = await startDatabaseAudit({
            userId: session.id,
            databaseId: db_id,
            databaseName: fetchDatabase.db_name,
            action: "SYSTEM_SCHEMA_LOAD",
            query: "SHOW TABLES; SELECT table metadata FROM information_schema.TABLES; SELECT column metadata FROM information_schema.COLUMNS",
        });
        auditId = audit.id;

        phaseStartedAt = databasePerformanceNow();
        const dialect = sequelize.getDialect();
        const isPostgres = dialect === "postgres";
        let tables;
        let tableInfoByName;
        let columnsByTableName = new Map();
        let columnRows;
        if (isPostgres) {
            const [tableRows] = await sequelize.query(`SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name`);
            tables = tableRows.map((row) => ({ tableName: row.tableName }));
            const [tableInfoRows] = await sequelize.query(`SELECT c.relname AS "tableName", c.reltuples::bigint AS "estimatedRows", pg_total_relation_size(c.oid) AS "totalBytes", obj_description(c.oid) AS "tableComment" FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')`);
            tableInfoByName = new Map(tableInfoRows.map((info) => [info.tableName, info]));
            [columnRows] = await sequelize.query(`
                SELECT c.table_name AS "tableName", c.column_name AS field,
                       COALESCE(c.udt_name, c.data_type) AS type, c.is_nullable AS nullable,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM information_schema.table_constraints tc
                           JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                           WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name
                       ) THEN 'PRI' ELSE '' END AS "columnKey",
                       c.column_default AS "columnDefault", c.is_identity AS "isIdentity"
                FROM information_schema.columns c WHERE c.table_schema = current_schema() ORDER BY c.table_name, c.ordinal_position
            `);
            columnRows = columnRows.map((column) => ({ ...column, extra: column.isIdentity === 'YES' ? 'identity' : '' }));
        } else if (dialect === "sqlite") {
            const [tableRows] = await sequelize.query("SELECT name AS tableName FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
            tables = tableRows;
            tableInfoByName = new Map(tableRows.map((row) => [row.tableName, { estimatedRows: null }]));
            columnRows = [];
            for (const { tableName } of tableRows) {
                const safeName = String(tableName).replace(/'/g, "''");
                const [columns] = await sequelize.query(`PRAGMA table_info('${safeName}')`);
                columnRows.push(...columns.map((column) => ({
                    tableName, field: column.name, type: column.type, nullable: column.notnull ? "NO" : "YES",
                    columnKey: column.pk ? "PRI" : "", columnDefault: column.dflt_value, extra: "",
                })));
            }
        } else if (dialect === "mssql") {
            const [tableRows] = await sequelize.query("SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
            tables = tableRows;
            const [columnMetadata] = await sequelize.query(`SELECT c.TABLE_NAME AS tableName, c.COLUMN_NAME AS field, c.DATA_TYPE AS type, c.IS_NULLABLE AS nullable, CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PRI' ELSE '' END AS columnKey, c.COLUMN_DEFAULT AS columnDefault, CASE WHEN c.IS_IDENTITY = 'YES' THEN 'identity' ELSE '' END AS extra FROM INFORMATION_SCHEMA.COLUMNS c LEFT JOIN (SELECT ku.TABLE_NAME, ku.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY') pk ON pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`);
            columnRows = columnMetadata;
            tableInfoByName = new Map(tableRows.map((row) => [row.tableName, {}]));
        } else {
            const [tableRows] = await sequelize.query("SHOW tables;");
            tables = tableRows;
            const [tableInfoRows] = await sequelize.query(`
            SELECT TABLE_NAME, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH,
                   TABLE_COLLATION, CREATE_TIME, UPDATE_TIME, TABLE_COMMENT
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE();
        `);
            tableInfoByName = new Map(tableInfoRows.map((info) => [info.TABLE_NAME, info]));
            [columnRows] = await sequelize.query(`
            SELECT TABLE_NAME, COLUMN_NAME AS field, COLUMN_TYPE AS type,
                   IS_NULLABLE AS nullable, COLUMN_KEY AS columnKey,
                   COLUMN_DEFAULT AS columnDefault, EXTRA AS extra
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME, ORDINAL_POSITION;
        `);
        }
        markDatabasePerformance(performanceContext, "external_schema_queries", phaseStartedAt);
        for (const column of columnRows) {
            const tableName = column.TABLE_NAME || column.tableName;
            const tableColumns = columnsByTableName.get(tableName) || [];
            tableColumns.push(column);
            columnsByTableName.set(tableName, tableColumns);
        }

        const tablesWithDetails = tables.map((tableObj) => {
            const tableKey = tableObj.tableName ? "tableName" : Object.keys(tableObj).find(
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
                        rowCount: (tableInfo.TABLE_ROWS ?? tableInfo.estimatedRows) == null ? null : Number(tableInfo.TABLE_ROWS ?? tableInfo.estimatedRows),
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
            dialect: sequelize.getDialect(),
            summary: {
                totalTables: tablesWithDetails.length,
                tablesWithErrors: tablesWithDetails.filter((t) => t.error).length,
                databaseName: fetchDatabase.name || "Unknown",
            },
        });
    } catch (error) {
        performanceErrorCode = safeDatabaseErrorCode(error);
        if (auditId) {
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch (auditError) { console.error("Unable to finalize database audit", safeDatabaseErrorCode(auditError)); }
        }
        return res.status(error.statusCode || 400).json({
            message: "Database connection failed",
            error: "Database connection failed.",
        });
    } finally {
        if (sequelize) {
            try {
                releaseExternalSequelize(sequelize);
            } catch (releaseError) { console.error("Unable to release database connection", releaseError?.code || "RELEASE_FAILED"); }
        }
        await releaseConnectionSlot?.();
        recordDatabasePerformance(performanceContext, {
            status: performanceStatus,
            rowsReturned: performanceRows,
            errorCode: performanceErrorCode,
        });
    }
}
