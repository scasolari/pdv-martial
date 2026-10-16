import db from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { validateExternalDatabaseUrl } from "@/lib/externalDatabase";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const session = await requireTwoFactorApi(req, res);
    const { form } = req.body || {};

    if (!session) return;
    if (typeof form?.db_name !== "string" || !form.db_name.trim() || form.db_name.length > 120 ||
        typeof form?.url_connection !== "string" || form.url_connection.length > 4096) {
        return res.status(400).json({ error: "Invalid database details." });
    }

    try {
        await validateExternalDatabaseUrl(form.url_connection);
    } catch (error) {
        return res.status(400).json({ error: error.message || "Invalid database host." });
    }

    try {
        const encryptedUrl = encrypt(form.url_connection);

        await db.$connect();
        const addDatabase = await db.database.create({
            data: {
                user_id: session.id,
                db_name: form.db_name,
                db_url_connection: encryptedUrl,
            },
        });
        await db.$disconnect();

        return res.status(201).json({ id: addDatabase.id, db_name: addDatabase.db_name, createdAt: addDatabase.createdAt });
    } catch (e) {
        try { await db.$disconnect(); } catch {}
        console.error("Unable to save database connection", e);
        return res.status(500).json({ error: "Unable to save database connection." });
    }
}
