import db from "@/lib/db";
import { decrypt, encrypt, isEncryptedValue } from "@/lib/crypto";

const MAX_DATABASE_AUDIT_EVENTS = 100;
export function getDatabaseAuditInactivityDays() {
    const configuredDays = Number.parseInt(process.env.DATABASE_AUDIT_RETENTION_DAYS || "90", 10);
    return Number.isInteger(configuredDays) && configuredDays >= 1 && configuredDays <= 3650
        ? configuredDays
        : 90;
}

export async function clearInactiveDatabaseAuditHistory({ userId, databaseId, now = new Date() }) {
    const where = { user_id: userId, database_id: databaseId };
    const latestEvent = await db.databaseAuditLog.findFirst({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true },
    });
    if (!latestEvent) return 0;

    const cutoff = new Date(now.getTime() - getDatabaseAuditInactivityDays() * 24 * 60 * 60 * 1000);
    if (latestEvent.createdAt >= cutoff) return 0;

    const result = await db.databaseAuditLog.deleteMany({ where });
    return result.count;
}

export function encryptAuditQuery(query) {
    if (typeof query !== "string") return query ?? null;
    if (isEncryptedValue(query)) return query;
    return encrypt(query);
}

export function decryptAuditQuery(query) {
    if (typeof query !== "string") return query;
    if (isEncryptedValue(query)) {
        return decrypt(query);
    }
    return query;
}

export async function startDatabaseAudit({ userId, databaseId, databaseName, action, query = null, tableName = null }) {
    try {
        await clearInactiveDatabaseAuditHistory({ userId, databaseId });
    } catch (error) {
        console.error("Unable to clear inactive database activity history", error?.code || "AUDIT_RETENTION_FAILED");
    }

    const auditEvent = await db.databaseAuditLog.create({
        data: {
            user_id: userId,
            database_id: databaseId,
            database_name: databaseName,
            action,
            query: encryptAuditQuery(query),
            table_name: tableName,
            status: "started",
        },
        select: { id: true },
    });

    try {
        const oldestRetainedEvent = await db.databaseAuditLog.findMany({
            where: { user_id: userId, database_id: databaseId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: MAX_DATABASE_AUDIT_EVENTS,
            take: 1,
            select: { id: true, createdAt: true },
        });
        const cutoff = oldestRetainedEvent[0];
        if (cutoff) {
            await db.databaseAuditLog.deleteMany({
                where: {
                    user_id: userId,
                    database_id: databaseId,
                    OR: [
                        { createdAt: { lt: cutoff.createdAt } },
                        { AND: [{ createdAt: cutoff.createdAt }, { id: { lt: cutoff.id } }] },
                    ],
                },
            });
        }
    } catch (error) {
        console.error("Unable to enforce database activity history limit", error?.code || "AUDIT_RETENTION_FAILED");
    }

    return auditEvent;
}

export async function finishDatabaseAudit(auditId, { status, affectedRows = null, errorCode = null }) {
    if (!auditId) return;
    await db.databaseAuditLog.update({
        where: { id: auditId },
        data: {
            status,
            affected_rows: affectedRows,
            error_code: errorCode,
        },
    });
}

export function classifySqlOperation(sql) {
    const statement = String(sql || "").replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/, "");
    const directKeyword = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL|RENAME|ANALYZE|OPTIMIZE|REPAIR)\b/i.exec(statement)?.[1]?.toUpperCase();
    if (directKeyword) return directKeyword;
    if (/^WITH\b/i.test(statement)) {
        return [...statement.matchAll(/\)\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE)\b/gi)].at(-1)?.[1]?.toUpperCase() || "SQL";
    }
    return "SQL";
}

export function extractSqlTableName(sql) {
    const match = /\b(?:FROM|INTO|UPDATE|TABLE)\s+(`(?:``|[^`])+`|[\w$.]+)/i.exec(String(sql || ""));
    return match?.[1]?.replace(/^`|`$/g, "").replace(/``/g, "`").slice(0, 191) || null;
}

export function safeDatabaseErrorCode(error) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    return typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code) ? code : "QUERY_FAILED";
}
