import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

const DEFAULT_SLOW_OPERATION_MS = 1_000;

export function databasePerformanceNow() {
    return performance.now();
}

export function startDatabasePerformance(route, operation) {
    return {
        requestId: randomUUID(),
        route,
        operation,
        startedAt: performance.now(),
        phasesMs: {},
    };
}

export function markDatabasePerformance(context, phase, startedAt) {
    context.phasesMs[phase] = Math.round((performance.now() - startedAt) * 10) / 10;
}

export function recordDatabasePerformance(context, details = {}) {
    const durationMs = Math.round((performance.now() - context.startedAt) * 10) / 10;
    const configuredThreshold = Number(process.env.DATABASE_SLOW_OPERATION_MS);
    const thresholdMs = Number.isFinite(configuredThreshold) && configuredThreshold > 0
        ? configuredThreshold
        : DEFAULT_SLOW_OPERATION_MS;
    if (process.env.DATABASE_PERFORMANCE_LOG_ALL !== "true" && durationMs < thresholdMs) return;

    console.info(JSON.stringify({
        event: "database.performance",
        request_id: context.requestId,
        route: context.route,
        operation: context.operation,
        status: details.status || "unknown",
        duration_ms: durationMs,
        phases_ms: context.phasesMs,
        ...(Number.isFinite(details.rowsReturned) ? { rows_returned: details.rowsReturned } : {}),
        ...(Number.isFinite(details.rowsAffected) ? { rows_affected: details.rowsAffected } : {}),
        ...(Number.isFinite(details.rowsCounted) ? { rows_counted: details.rowsCounted } : {}),
        ...(details.truncated === true ? { truncated: true } : {}),
        ...(details.errorCode ? { error_code: details.errorCode } : {}),
    }));
}
