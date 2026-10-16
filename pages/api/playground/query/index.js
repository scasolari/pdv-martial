import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize, executeExternalSql } from "@/lib/externalDatabase";
import { classifySqlOperation, extractSqlTableName, finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";
import { maskSensitiveRows, normalizeDatabasePreferences } from "@/lib/databasePreferences";
import { databasePerformanceNow, markDatabasePerformance, recordDatabasePerformance, startDatabasePerformance } from "@/lib/databasePerformance";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    const performanceContext = startDatabasePerformance("/api/playground/query", "sql_query");
    res.setHeader("X-Performance-Request-Id", performanceContext.requestId);
    let performanceStatus = "error";
    let performanceRows;
    let performanceRowsAffected;
    let performanceTruncated = false;
    let performanceErrorCode;
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;
    const { query, db_id } = req.body || {};

    if (typeof query !== "string" || !query.trim() || query.length > 100_000 || typeof db_id !== "string") {
        return res.status(400).json({ error: "Invalid query or database id." });
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
        const preferences = normalizeDatabasePreferences(fetchDatabase.preferences);

        phaseStartedAt = databasePerformanceNow();
        releaseConnectionSlot = await acquireExternalConnectionSlot();
        markDatabasePerformance(performanceContext, "connection_slot_wait", phaseStartedAt);
        const connectionString = decrypt(fetchDatabase.db_url_connection);
        phaseStartedAt = databasePerformanceNow();
        sequelize = await acquireExternalSequelize(connectionString);
        markDatabasePerformance(performanceContext, "external_connection_acquire", phaseStartedAt);

        const operation = classifySqlOperation(query);
        const audit = await startDatabaseAudit({
            userId: session.id,
            databaseId: db_id,
            databaseName: fetchDatabase.db_name,
            action: `SQL_${operation}`,
            query,
            tableName: extractSqlTableName(query),
        });
        auditId = audit.id;

        phaseStartedAt = databasePerformanceNow();
        const queryResult = await executeExternalSql(sequelize, query);
        markDatabasePerformance(performanceContext, "external_query", phaseStartedAt);
        const duration = Math.round(databasePerformanceNow() - phaseStartedAt);
        performanceRows = queryResult.count;
        performanceRowsAffected = queryResult.affectedRows;
        performanceTruncated = queryResult.truncated;
        try {
            await finishDatabaseAudit(auditId, {
                status: "success",
                affectedRows: queryResult.affectedRows ?? queryResult.count,
            });
        } catch (auditError) {
            console.error("Could not finalize SQL audit event", auditError?.code || "AUDIT_FAILED");
        }

        performanceStatus = "success";
        return res.status(200).json({
            ...queryResult,
            data: maskSensitiveRows(queryResult.data, preferences.sensitiveColumns),
            sensitiveColumns: preferences.sensitiveColumns,
            duration_ms: duration,
        });
    } catch (error) {
        performanceStatus = error.statusCode === 429 ? "throttled" : "error";
        performanceErrorCode = safeDatabaseErrorCode(error);
        if (auditId) {
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch {}
        }
        console.error("Database query failed", safeDatabaseErrorCode(error));
        return res.status(error.statusCode || 400).json({ error: "Database query failed or exceeded its execution limit." });
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
            rowsAffected: performanceRowsAffected,
            truncated: performanceTruncated,
            errorCode: performanceErrorCode,
        });
    }
}
