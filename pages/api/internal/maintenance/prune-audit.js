import { timingSafeEqual } from "node:crypto";
import db from "@/lib/db";

const DELETE_BATCH_SIZE = 5_000;
const MAX_BATCHES_PER_REQUEST = 5;

function hasValidSecret(req) {
    const expected = process.env.DATABASE_AUDIT_CLEANUP_SECRET;
    const authorization = req.headers.authorization || "";
    if (!expected || !authorization.startsWith("Bearer ")) return false;
    const provided = Buffer.from(authorization.slice(7));
    const expectedBuffer = Buffer.from(expected);
    return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed." });
    }
    if (!hasValidSecret(req)) return res.status(401).json({ error: "Unauthorized." });

    const retentionDays = Number.parseInt(process.env.DATABASE_AUDIT_RETENTION_DAYS || "", 10);
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
        return res.status(503).json({ error: "Configure DATABASE_AUDIT_RETENTION_DAYS (1–3650) to enable cleanup." });
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let deleted = 0;
    try {
        for (let batch = 0; batch < MAX_BATCHES_PER_REQUEST; batch += 1) {
            const batchDeleted = await db.$executeRaw`
                DELETE FROM DatabaseAuditLog
                WHERE createdAt < ${cutoff}
                ORDER BY createdAt ASC
                LIMIT ${DELETE_BATCH_SIZE}
            `;
            deleted += batchDeleted;
            if (batchDeleted < DELETE_BATCH_SIZE) break;
        }
        return res.status(200).json({ deleted, cutoff, moreMayRemain: deleted === DELETE_BATCH_SIZE * MAX_BATCHES_PER_REQUEST });
    } catch (error) {
        console.error("Unable to prune old database audit events", error?.code || "AUDIT_CLEANUP_FAILED");
        return res.status(500).json({ error: "Unable to prune audit history." });
    }
}
