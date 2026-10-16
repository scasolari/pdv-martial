import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const session = await requireTwoFactorApi(req, res);

    if (!session) return;

    try {
        await db.$connect()
        const fetchDatabases = await db.database.findMany({
            where: {
                user_id: session.id
            },
            select: { id: true, db_name: true, createdAt: true, updatedAt: true }
        })
        return res.status(200).json(fetchDatabases);
    } catch (e) {
        console.error("Unable to list saved databases", e);
        return res.status(500).json({error: "Unable to list saved databases."});
    } finally {
        await db.$disconnect().catch(() => {});
    }
}
