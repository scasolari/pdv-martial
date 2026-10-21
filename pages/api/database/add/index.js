import db from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { validateExternalDatabaseUrl } from "@/lib/externalDatabase";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { serializeConnectionConfig, validateSshConfig, validateSslConfig } from "@/lib/databaseConnectionConfig";
import { DATABASE_AUTHORIZATION_VERSION } from "@/lib/databaseAuthorization";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const session = await requireTwoFactorApi(req, res);
    const { form } = req.body || {};

    if (!session) return;
    if (form?.authorizationConfirmed !== true) {
        return res.status(400).json({ error: "Confirm that you are authorised to connect this database." });
    }
    if (typeof form?.db_name !== "string" || !form.db_name.trim() || form.db_name.length > 120 ||
        typeof form?.url_connection !== "string" || form.url_connection.length > 4096) {
        return res.status(400).json({ error: "Invalid database details." });
    }

    let connectionInfo;
    let ssh;
    let ssl;
    try {
        ssh = validateSshConfig(form.ssh);
        connectionInfo = await validateExternalDatabaseUrl(form.url_connection, session.id, { throughSsh: Boolean(ssh) });
        ssl = validateSslConfig(form.ssl, connectionInfo.dialect);
    } catch (error) {
        return res.status(400).json({ error: error.message || "Invalid database host." });
    }

    try {
        const encryptedUrl = encrypt(serializeConnectionConfig({ connectionString: form.url_connection, ssh, ssl }));

        const addDatabase = await db.database.create({
            data: {
                user_id: session.id,
                db_name: form.db_name,
                db_url_connection: encryptedUrl,
                authorizationConfirmedAt: new Date(),
                authorizationVersion: DATABASE_AUTHORIZATION_VERSION,
            },
        });
        return res.status(201).json({ id: addDatabase.id, db_name: addDatabase.db_name, dialect: connectionInfo.dialect, createdAt: addDatabase.createdAt });
    } catch (e) {
        console.error("Unable to save database connection", e);
        return res.status(500).json({ error: "Unable to save database connection." });
    }
}
