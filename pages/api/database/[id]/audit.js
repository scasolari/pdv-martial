import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { databasePerformanceNow, markDatabasePerformance, recordDatabasePerformance, startDatabasePerformance } from "@/lib/databasePerformance";

const FILTER_FIELDS = {
    Database: "database_name",
    Action: "action",
    Query: "query",
    Table: "table_name",
    Status: "status",
    "Error code": "error_code",
};
const FILTER_OPERATORS = new Set(["contains", "equals", "notEquals", "startsWith", "endsWith", "isEmpty", "isNotEmpty"]);
const QUERY_PREVIEW_LENGTH = 4_000;

function parseFilters(rawFilters) {
    if (rawFilters === undefined) return [];
    if (typeof rawFilters !== "string" || rawFilters.length > 12_000) return null;
    let filters;
    try { filters = JSON.parse(rawFilters); } catch { return null; }
    if (!Array.isArray(filters) || filters.length > 12) return null;
    if (!filters.every((filter) => filter && typeof filter === "object" &&
        Object.hasOwn(FILTER_FIELDS, filter.column) && FILTER_OPERATORS.has(filter.operator) &&
        (filter.conjunction === undefined || ["and", "or"].includes(filter.conjunction)) &&
        (filter.operator === "isEmpty" || filter.operator === "isNotEmpty" ||
            (typeof filter.value === "string" && filter.value.length <= 500)))) return null;
    return filters.filter((filter) => ["isEmpty", "isNotEmpty"].includes(filter.operator) || filter.value.trim() !== "");
}

function filterCondition(filter) {
    const field = FILTER_FIELDS[filter.column];
    const value = filter.value;
    switch (filter.operator) {
        case "equals": return { [field]: { equals: value } };
        case "notEquals": return { OR: [{ [field]: { not: value } }, { [field]: null }] };
        case "startsWith": return { [field]: { startsWith: value } };
        case "endsWith": return { [field]: { endsWith: value } };
        case "isEmpty": return { OR: [{ [field]: null }, { [field]: "" }] };
        case "isNotEmpty": return { AND: [{ [field]: { not: null } }, { [field]: { not: "" } }] };
        case "contains":
        default: return { [field]: { contains: value } };
    }
}

export default async function handler(req, res) {
    const performanceContext = startDatabasePerformance(
        "/api/database/[id]/audit",
        req.query?.countOnly === "true" ? "activity_count" : "activity_page"
    );
    res.setHeader("X-Performance-Request-Id", performanceContext.requestId);
    let performanceStatus = "error";
    let performanceRows;
    let performanceErrorCode;
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed." });
    }

    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    const { id } = req.query;
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    const countOnly = req.query.countOnly === "true";
    const category = req.query.category === undefined ? "all" : req.query.category;
    const filters = parseFilters(req.query.filters);
    if (typeof id !== "string" || !id.trim() || id.length > 128 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
        !Number.isSafeInteger(offset) || offset < 0 ||
        !["all", "system", "user"].includes(category) || filters === null) {
        return res.status(400).json({ error: "Invalid audit log parameters." });
    }

    try {
        const where = {
            user_id: session.id,
            database_id: id,
            ...(category === "system" ? { action: { startsWith: "SYSTEM_" } } : {}),
            ...(category === "user" ? { NOT: { action: { startsWith: "SYSTEM_" } } } : {}),
        };
        if (filters.length) {
            const groups = [[]];
            filters.forEach((filter, index) => {
                if (index > 0 && filter.conjunction === "or") groups.push([]);
                groups[groups.length - 1].push(filterCondition(filter));
            });
            where.AND = [{ OR: groups.map((group) => group.length === 1 ? group[0] : { AND: group }) }];
        }
        if (countOnly) {
            const queryStartedAt = databasePerformanceNow();
            const count = await db.databaseAuditLog.count({ where });
            markDatabasePerformance(performanceContext, "internal_count_query", queryStartedAt);
            performanceRows = count;
            performanceStatus = "success";
            return res.status(200).json({ count });
        }

        // Return the visible page immediately; exact totals are fetched separately by the client.
        const queryStartedAt = databasePerformanceNow();
        const events = await db.databaseAuditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit + 1,
                select: {
                    id: true,
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
        markDatabasePerformance(performanceContext, "internal_page_query", queryStartedAt);
        const hasMore = events.length > limit;
        if (hasMore) events.pop();
        const pageData = events.map((event) => event.query?.length > QUERY_PREVIEW_LENGTH
            ? { ...event, query: `${event.query.slice(0, QUERY_PREVIEW_LENGTH)}…` }
            : event);
        performanceRows = pageData.length;
        performanceStatus = "success";
        return res.status(200).json({ data: pageData, hasMore, limit, offset });
    } catch (error) {
        performanceErrorCode = typeof error?.code === "string" ? error.code : "AUDIT_READ_FAILED";
        console.error("Unable to retrieve database audit events", error?.code || "AUDIT_READ_FAILED");
        return res.status(500).json({ error: "Unable to retrieve audit history." });
    } finally {
        recordDatabasePerformance(performanceContext, {
            status: performanceStatus,
            rowsReturned: performanceContext.operation === "activity_page" ? performanceRows : undefined,
            rowsCounted: performanceContext.operation === "activity_count" ? performanceRows : undefined,
            errorCode: performanceErrorCode,
        });
    }
}
