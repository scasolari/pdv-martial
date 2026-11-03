import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

const MAX_QUERY_LENGTH = 100_000;

export default async function handler(req, res) {
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    if (req.method === "GET") {
        const databaseId = typeof req.query.databaseId === "string" ? req.query.databaseId.trim() : "";
        if (!databaseId) return res.status(400).json({ error: "A database ID is required." });

        try {
            const database = await db.database.findFirst({
                where: { id: databaseId, user_id: session.id },
                select: { id: true },
            });
            if (!database) return res.status(404).json({ error: "Database not found." });

            const queries = await db.savedQuery.findMany({
                where: { userId: session.id, databaseId },
                orderBy: { updatedAt: "desc" },
                select: { id: true, name: true, query: true, databaseId: true, createdAt: true, updatedAt: true },
            });
            res.setHeader("Cache-Control", "no-store");
            return res.status(200).json({ queries });
        } catch (error) {
            console.error("Unable to list saved queries", error);
            return res.status(500).json({ error: "Unable to load saved queries." });
        }
    }

    if (req.method === "POST") {
        const databaseId = typeof req.body?.databaseId === "string" ? req.body.databaseId.trim() : "";
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
        const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
        if (!databaseId || !name || name.length > 80 || !query || query.length > MAX_QUERY_LENGTH) {
            return res.status(400).json({ error: "Provide a database ID, query name (up to 80 characters), and query text (up to 100,000 characters)." });
        }

        try {
            const database = await db.database.findFirst({
                where: { id: databaseId, user_id: session.id },
                select: { id: true },
            });
            if (!database) return res.status(404).json({ error: "Database not found." });

            const existingQueries = await db.savedQuery.findMany({
                where: { userId: session.id, databaseId },
                select: { id: true, name: true },
            });
            const existing = existingQueries.find((savedQuery) => savedQuery.name.toLowerCase() === name.toLowerCase());
            const savedQuery = existing
                ? await db.savedQuery.update({
                    where: { id: existing.id },
                    data: { name, query },
                    select: { id: true, name: true, query: true, databaseId: true, createdAt: true, updatedAt: true },
                })
                : await db.savedQuery.create({
                    data: { userId: session.id, databaseId, name, query },
                    select: { id: true, name: true, query: true, databaseId: true, createdAt: true, updatedAt: true },
                });
            return res.status(existing ? 200 : 201).json({ query: savedQuery });
        } catch (error) {
            console.error("Unable to save query", error);
            return res.status(500).json({ error: "Unable to save query." });
        }
    }

    if (req.method === "DELETE") {
        const databaseId = typeof req.body?.databaseId === "string" ? req.body.databaseId.trim() : "";
        const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
        if (!databaseId || !id) return res.status(400).json({ error: "A database ID and saved query ID are required." });

        try {
            const deleted = await db.savedQuery.deleteMany({ where: { id, userId: session.id, databaseId } });
            if (deleted.count === 0) return res.status(404).json({ error: "Saved query not found." });
            return res.status(200).json({ success: true });
        } catch (error) {
            console.error("Unable to delete saved query", error);
            return res.status(500).json({ error: "Unable to delete saved query." });
        }
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
}
