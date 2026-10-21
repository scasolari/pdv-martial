import prismaPackage from "@prisma/client";

const { PrismaClient } = prismaPackage;
const MAX_DATABASE_AUDIT_EVENTS = 100;
const GROUP_BATCH_SIZE = 250;
const db = new PrismaClient();
let cursor;
let deletedCount = 0;

try {
    while (true) {
        const groups = await db.databaseAuditLog.groupBy({
            by: ["user_id", "database_id"],
            ...(cursor ? { where: { database_id: { gt: cursor } } } : {}),
            orderBy: { database_id: "asc" },
            take: GROUP_BATCH_SIZE,
        });
        if (groups.length === 0) break;

        for (const group of groups) {
            const cutoffRows = await db.databaseAuditLog.findMany({
                where: { user_id: group.user_id, database_id: group.database_id },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: MAX_DATABASE_AUDIT_EVENTS,
                take: 1,
                select: { id: true, createdAt: true },
            });
            const cutoff = cutoffRows[0];
            if (!cutoff) continue;

            const result = await db.databaseAuditLog.deleteMany({
                where: {
                    user_id: group.user_id,
                    database_id: group.database_id,
                    OR: [
                        { createdAt: { lt: cutoff.createdAt } },
                        { AND: [{ createdAt: cutoff.createdAt }, { id: { lt: cutoff.id } }] },
                    ],
                },
            });
            deletedCount += result.count;
        }

        cursor = groups.at(-1).database_id;
        if (groups.length < GROUP_BATCH_SIZE) break;
    }

    console.log(`Deleted ${deletedCount} old activity-history events.`);
} finally {
    await db.$disconnect();
}
