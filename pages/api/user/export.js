import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed." });
    }

    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    try {
        const user = await db.user.findUnique({
            where: { id: session.id },
            select: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                image: true,
                Database: {
                    select: {
                        id: true,
                        db_name: true,
                        preferences: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!user) return res.status(401).json({ error: "Not authenticated." });

        const { Database, ...profile } = user;
        const exportData = {
            format: "pdv-account-export-v1",
            exportedAt: new Date().toISOString(),
            profile,
            savedDatabases: Database,
        };

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="account-data.json"');
        return res.status(200).send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        console.error("Unable to export account data", error?.code || error?.name || "unknown");
        return res.status(500).json({ error: "Unable to export account data." });
    }
}
