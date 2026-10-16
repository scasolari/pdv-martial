import db from "@/lib/db";

export async function startDatabaseAudit({ userId, databaseId, databaseName, action, query = null, tableName = null }) {
    return db.databaseAuditLog.create({
        data: {
            user_id: userId,
            database_id: databaseId,
            database_name: databaseName,
            action,
            query,
            table_name: tableName,
            status: "started",
        },
        select: { id: true },
    });
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
