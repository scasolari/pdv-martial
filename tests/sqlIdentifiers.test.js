import { describe, expect, it } from "vitest";
import { nullSafeEqualsSql, quoteSqlIdentifier } from "../lib/sqlIdentifiers.js";

describe("SQL identifier helpers", () => {
    it("delegates identifier escaping to the active dialect query generator", () => {
        const sequelize = {
            getQueryInterface: () => ({
                queryGenerator: { quoteIdentifier: (identifier) => `escaped:${identifier}` },
            }),
        };

        expect(quoteSqlIdentifier(sequelize, "user name")).toBe("escaped:user name");
    });

    it.each([
        ["postgres", "left IS NOT DISTINCT FROM right"],
        ["mssql", "(left = right OR (left IS NULL AND right IS NULL))"],
        ["sqlite", "left IS right"],
        ["mysql", "left <=> right"],
        ["mariadb", "left <=> right"],
    ])("creates null-safe equality for %s", (dialect, expected) => {
        expect(nullSafeEqualsSql(dialect, "left", "right")).toBe(expected);
    });
});
