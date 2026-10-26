export const DEFAULT_DATABASE_PREFERENCES = Object.freeze({
    pageSize: 50,
    sensitiveColumns: [],
});

const ALLOWED_PAGE_SIZES = new Set([10, 25, 50, 100]);

export function normalizeDatabasePreferences(value) {
    if (typeof value === "string") {
        try { value = JSON.parse(value); } catch { value = {}; }
    }
    const preferences = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
        pageSize: ALLOWED_PAGE_SIZES.has(Number(preferences.pageSize)) ? Number(preferences.pageSize) : DEFAULT_DATABASE_PREFERENCES.pageSize,
        sensitiveColumns: Array.isArray(preferences.sensitiveColumns)
            ? [...new Set(preferences.sensitiveColumns.filter((column) => typeof column === "string" && column.length > 0 && column.length <= 255))].slice(0, 500)
            : [],
    };
}

export function maskSensitiveRows(rows, sensitiveColumns = []) {
    if (!Array.isArray(rows) || !Array.isArray(sensitiveColumns) || sensitiveColumns.length === 0) return rows;
    const sensitiveNames = new Set(sensitiveColumns.map((column) => String(column).toLowerCase()));
    return rows.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return row;
        const maskedRow = { ...row };
        Object.keys(maskedRow).forEach((key) => {
            if (sensitiveNames.has(key.toLowerCase())) maskedRow[key] = "••••••••";
        });
        return maskedRow;
    });
}
