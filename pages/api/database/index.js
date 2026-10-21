import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getExternalDatabaseDialect } from "@/lib/externalDatabase";
import { parseStoredConnectionConfig } from "@/lib/databaseConnectionConfig";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const session = await requireTwoFactorApi(req, res);

    if (!session) return;

    try {
        const fetchDatabases = await db.database.findMany({
            where: {
                user_id: session.id
            },
            select: { id: true, db_name: true, db_url_connection: true, createdAt: true, updatedAt: true }
        })
        return res.status(200).json(fetchDatabases.map(({ db_url_connection, ...dataset }) => ({
            ...dataset,
            dialect: getExternalDatabaseDialect(parseStoredConnectionConfig(decrypt(db_url_connection)).connectionString),
        })));
    } catch (e) {
        console.error("Unable to list saved databases", e);
        return res.status(500).json({error: "Unable to list saved databases."});
    }
}
