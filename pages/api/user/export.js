import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { decryptAuditQuery } from "@/lib/databaseAudit";

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
                LegalAcceptance: {
                    select: {
                        documentType: true,
                        documentVersion: true,
                        acceptedAt: true,
                    },
                    orderBy: { acceptedAt: "asc" },
                },
                Database: {
                    select: {
                        id: true,
                        db_name: true,
                        preferences: true,
                        authorizationConfirmedAt: true,
                        authorizationVersion: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!user) return res.status(401).json({ error: "Not authenticated." });

        const activityHistory = await db.databaseAuditLog.findMany({
            where: { user_id: session.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
                database_id: true,
                database_name: true,
                action: true,
                query: true,
                table_name: true,
                affected_rows: true,
                status: true,
                error_code: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        const { Database, LegalAcceptance, ...profile } = user;
        const exportData = {
            format: "pdv-account-export-v1",
            exportedAt: new Date().toISOString(),
            profile,
            savedDatabases: Database,
            legalAcceptances: LegalAcceptance,
            activityHistory: activityHistory.map((event) => ({
                ...event,
                query: decryptAuditQuery(event.query),
            })),
            notes: [
                "Connection credentials and authentication tokens are excluded.",
                "Terms, privacy-notice, addendum, and database-authorization acceptance records are included.",
                "Activity-history SQL may contain values or personal data entered by the account holder.",
                "Uploaded SQLite files and data stored in connected external databases are not included.",
            ],
        };

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="account-data.json"');
        return res.status(200).send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        console.error("Unable to export account data", error?.code || error?.name || "unknown");
        return res.status(500).json({ error: "Unable to export account data." });
    }
}
