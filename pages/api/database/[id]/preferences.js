import db from "@/lib/db";
import { normalizeDatabasePreferences } from "@/lib/databasePreferences";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

const ALLOWED_PAGE_SIZES = new Set([10, 25, 50, 100]);

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
                select: { preferences: true },
            });
            if (!dataset) return res.status(404).json({ error: "Dataset not found." });
            return res.status(200).json(normalizeDatabasePreferences(dataset.preferences));
        } catch (error) {
            console.error("Unable to load database preferences", error?.code || error?.name || "unknown");
            return res.status(500).json({ error: "Unable to load database preferences." });
        }
    }

    if (req.method === "PATCH") {
        const preferences = req.body;
        if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)
            || !ALLOWED_PAGE_SIZES.has(Number(preferences.pageSize))
            || !Array.isArray(preferences.sensitiveColumns)
            || preferences.sensitiveColumns.some((column) => typeof column !== "string" || !column.length || column.length > 255)
            || preferences.sensitiveColumns.length > 500) {
            return res.status(400).json({ error: "Invalid database preferences." });
        }

        try {
            const updated = await db.database.updateMany({
                where: { id, user_id: session.id },
                data: { preferences: normalizeDatabasePreferences(preferences) },
            });
            if (!updated.count) return res.status(404).json({ error: "Dataset not found." });
            return res.status(200).json(normalizeDatabasePreferences(preferences));
        } catch (error) {
            console.error("Unable to save database preferences", error?.code || error?.name || "unknown");
            return res.status(500).json({ error: "Unable to save database preferences." });
        }
    }

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
}
