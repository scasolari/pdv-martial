import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { invalidateExternalSequelize } from "@/lib/externalDatabase";
import { finishDatabaseAudit, safeDatabaseErrorCode, startDatabaseAudit } from "@/lib/databaseAudit";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

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
                select: { id: true, db_name: true, createdAt: true, updatedAt: true },
            });
            if (!dataset) return res.status(404).json({ error: "Dataset not found." });
            return res.status(200).json(dataset);
        } catch (error) {
            console.error("Unable to load saved dataset settings", safeDatabaseErrorCode(error));
            return res.status(500).json({ error: "Unable to load database settings." });
        }
    }

    if (req.method === "PATCH") {
        const dbName = req.body?.db_name;
        if (typeof dbName !== "string" || !dbName.trim() || dbName.trim().length > 120) {
            return res.status(400).json({ error: "Database name must be between 1 and 120 characters." });
        }

        let auditId;
        try {
            const dataset = await db.database.findFirst({
                where: { id, user_id: session.id },
                select: { db_name: true },
            });
            if (!dataset) return res.status(404).json({ error: "Dataset not found." });

            const audit = await startDatabaseAudit({
                userId: session.id,
                databaseId: id,
                databaseName: dataset.db_name,
                action: "DATABASE_SETTINGS_UPDATE",
                query: "Update saved database display name",
            });
            auditId = audit.id;

            const updated = await db.database.updateMany({
                where: { id, user_id: session.id },
                data: { db_name: dbName.trim() },
            });
            if (updated.count === 0) return res.status(404).json({ error: "Dataset not found." });

            const updatedDataset = await db.database.findFirst({
                where: { id, user_id: session.id },
                select: { id: true, db_name: true, createdAt: true, updatedAt: true },
            });
            try { await finishDatabaseAudit(auditId, { status: "success", affectedRows: 1 }); } catch {}
            return res.status(200).json(updatedDataset);
        } catch (error) {
            if (auditId) {
                try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch {}
            }
            console.error("Unable to update saved database settings", safeDatabaseErrorCode(error));
            return res.status(500).json({ error: "Unable to update database settings." });
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
        const connectionString = decrypt(dataset.db_url_connection);
        const audit = await startDatabaseAudit({
            userId: session.id,
            databaseId: id,
            databaseName: dataset.db_name,
            action: "DATASET_DELETE",
        });
        auditId = audit.id;
        const deleted = await db.database.deleteMany({
            where: { id, user_id: session.id },
        });
        if (deleted.count === 0) return res.status(404).json({ error: "Dataset not found." });
        invalidateExternalSequelize(connectionString);
        try { await finishDatabaseAudit(auditId, { status: "success", affectedRows: 1 }); } catch {}
        return res.status(200).json({ id, deleted: true });
    } catch (error) {
        if (auditId) {
            try { await finishDatabaseAudit(auditId, { status: "failed", errorCode: safeDatabaseErrorCode(error) }); } catch {}
        }
        console.error("Unable to delete saved dataset", safeDatabaseErrorCode(error));
        return res.status(500).json({ error: "Unable to delete dataset." });
    }
}
