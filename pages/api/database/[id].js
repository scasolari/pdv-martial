import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, getExternalDatabaseDialect, invalidateExternalSequelize, releaseExternalSequelize } from "@/lib/externalDatabase";
import { encrypt } from "@/lib/crypto";
import { finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { getSqlitePathFromConnectionString, removeSqliteUserFile } from "@/lib/sqliteStorage";
import { parseStoredConnectionConfig, serializeConnectionConfig, validateSshConfig, validateSslConfig } from "@/lib/databaseConnectionConfig";
import { DATABASE_AUTHORIZATION_VERSION } from "@/lib/databaseAuthorization";

export default async function handler(req, res) {
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    const { id } = req.query;
    if (typeof id !== "string" || !id.trim() || id.length > 128) {
        return res.status(400).json({ error: "Invalid dataset id." });
    }

    if (req.method === "GET") {
        try {
            const dataset = await db.database.findFirst({
                where: { id, user_id: session.id },
                select: { id: true, db_name: true, db_url_connection: true, createdAt: true, updatedAt: true },
            });
            if (!dataset) return res.status(404).json({ error: "Dataset not found." });
            const { db_url_connection, ...safeDataset } = dataset;
            const connectionConfig = parseStoredConnectionConfig(decrypt(db_url_connection));
            return res.status(200).json({ ...safeDataset, dialect: getExternalDatabaseDialect(connectionConfig.connectionString), hasSshTunnel: Boolean(connectionConfig.ssh), sslEnabled: Boolean(connectionConfig.ssl?.enabled), sslMode: connectionConfig.ssl?.mode || "verify-full" });
        } catch (error) {
            console.error("Unable to load saved dataset settings", safeDatabaseErrorCode(error));
            return res.status(500).json({ error: "Unable to load database settings." });
        }
    }

    if (req.method === "PATCH") {
        const dbName = req.body?.db_name;
        const connectionString = req.body?.url_connection;
        const updateConnection = connectionString !== undefined && connectionString !== "";
        const updateConnectionConfig = updateConnection || req.body?.ssh !== undefined || req.body?.ssl !== undefined;
        if (updateConnectionConfig && req.body?.authorizationConfirmed !== true) {
            return res.status(400).json({ error: "Confirm that you are authorised to connect this database." });
        }
        if (typeof dbName !== "string" || !dbName.trim() || dbName.trim().length > 120) {
            return res.status(400).json({ error: "Database name must be between 1 and 120 characters." });
        }
        if (connectionString !== undefined && connectionString !== "" && (typeof connectionString !== "string" || connectionString.length > 4096)) {
            return res.status(400).json({ error: "Invalid connection string." });
        }

        let auditId;
        let sequelize;
        let releaseConnectionSlot;
        try {
            const dataset = await db.database.findFirst({
                where: { id, user_id: session.id },
                select: { db_name: true, db_url_connection: true },
            });
            if (!dataset) return res.status(404).json({ error: "Dataset not found." });

            const previousConfig = parseStoredConnectionConfig(decrypt(dataset.db_url_connection));
            const nextConnectionString = updateConnection ? connectionString : previousConfig.connectionString;
            let nextSsh = previousConfig.ssh;
            let nextSsl = previousConfig.ssl;
            if (req.body?.ssh !== undefined) nextSsh = validateSshConfig(req.body.ssh);
            if (req.body?.ssl !== undefined) nextSsl = req.body.ssl;
            nextSsl = validateSslConfig(nextSsl, getExternalDatabaseDialect(nextConnectionString));

            if (updateConnection || req.body?.ssh !== undefined || req.body?.ssl !== undefined) {
                try {
                    nextSsh = validateSshConfig(nextSsh);
                    releaseConnectionSlot = await acquireExternalConnectionSlot();
                    sequelize = await acquireExternalSequelize(nextConnectionString, session.id, { ssh: nextSsh, ssl: nextSsl });
                    await sequelize.authenticate();
                } catch {
                    return res.status(400).json({ error: "Unable to connect with the new settings. Check the connection string, SSH host key, and database permissions." });
                }
            }

            const audit = await startDatabaseAudit({
                userId: session.id,
                databaseId: id,
                databaseName: dataset.db_name,
                action: updateConnectionConfig ? "DATABASE_CONNECTION_UPDATE" : "DATABASE_SETTINGS_UPDATE",
                query: updateConnectionConfig ? "Update saved database connection settings" : "Update saved database display name",
            });
            auditId = audit.id;

            const updated = await db.database.updateMany({
                where: { id, user_id: session.id },
                data: {
                    db_name: dbName.trim(),
                    ...(updateConnectionConfig ? {
                        db_url_connection: encrypt(serializeConnectionConfig({ connectionString: nextConnectionString, ssh: nextSsh, ssl: nextSsl })),
                        authorizationConfirmedAt: new Date(),
                        authorizationVersion: DATABASE_AUTHORIZATION_VERSION,
                    } : {}),
                },
            });
            if (updated.count === 0) return res.status(404).json({ error: "Dataset not found." });
            if (updateConnectionConfig) invalidateExternalSequelize(previousConfig.connectionString);
            if (updateConnection) {
                const previousSqlitePath = getSqlitePathFromConnectionString(previousConfig.connectionString);
                if (previousSqlitePath && previousConfig.connectionString !== connectionString) {
                    await removeSqliteUserFile(previousSqlitePath, session.id).catch(() => {});
                }
            }

            const updatedDataset = await db.database.findFirst({
                where: { id, user_id: session.id },
                select: { id: true, db_name: true, createdAt: true, updatedAt: true },
            });
            try { await finishDatabaseAudit(auditId, { status: "success", affectedRows: 1 }); } catch (auditError) { console.error("Unable to finalize database audit", safeDatabaseErrorCode(auditError)); }
            return res.status(200).json({ ...updatedDataset, dialect: getExternalDatabaseDialect(nextConnectionString), hasSshTunnel: Boolean(nextSsh), sslEnabled: Boolean(nextSsl?.enabled), sslMode: nextSsl?.mode || "verify-full" });
        } catch (error) {
            if (auditId) {
                try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch (auditError) { console.error("Unable to finalize database audit", safeDatabaseErrorCode(auditError)); }
            }
            console.error("Unable to update saved database settings", safeDatabaseErrorCode(error));
            return res.status(500).json({ error: "Unable to update database settings." });
        } finally {
            if (sequelize) releaseExternalSequelize(sequelize);
            await releaseConnectionSlot?.();
        }
    }

    if (req.method !== "DELETE") {
        res.setHeader("Allow", "GET, PATCH, DELETE");
        return res.status(405).json({ error: "Method not allowed." });
    }

    let auditId;
    try {
        const dataset = await db.database.findFirst({ where: { id, user_id: session.id }, select: { db_name: true, db_url_connection: true } });
        if (!dataset) return res.status(404).json({ error: "Dataset not found." });
        const connectionConfig = parseStoredConnectionConfig(decrypt(dataset.db_url_connection));
        const connectionString = connectionConfig.connectionString;
        const audit = await startDatabaseAudit({
            userId: session.id,
            databaseId: id,
            databaseName: dataset.db_name,
            action: "DATASET_DELETE",
        });
        auditId = audit.id;
        invalidateExternalSequelize(connectionString);
        const sqlitePath = getSqlitePathFromConnectionString(connectionString);
        if (sqlitePath) await removeSqliteUserFile(sqlitePath, session.id);

        const deleted = await db.database.deleteMany({
            where: { id, user_id: session.id },
        });
        if (deleted.count === 0) return res.status(404).json({ error: "Dataset not found." });
        try { await finishDatabaseAudit(auditId, { status: "success", affectedRows: 1 }); } catch (auditError) { console.error("Unable to finalize database audit", safeDatabaseErrorCode(auditError)); }
        return res.status(200).json({ id, deleted: true });
    } catch (error) {
        if (auditId) {
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch (auditError) { console.error("Unable to finalize database audit", safeDatabaseErrorCode(auditError)); }
        }
        console.error("Unable to delete saved dataset", safeDatabaseErrorCode(error));
        return res.status(500).json({ error: "Unable to delete dataset." });
    }
}
