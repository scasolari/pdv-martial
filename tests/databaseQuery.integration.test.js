import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Sequelize } from "sequelize";

const mocks = vi.hoisted(() => ({
    findDatabase: vi.fn(),
    decrypt: vi.fn(),
    requireTwoFactorApi: vi.fn(),
    startAudit: vi.fn(),
    finishAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: { database: { findUnique: mocks.findDatabase } } }));
vi.mock("@/lib/crypto", () => ({ decrypt: mocks.decrypt }));
vi.mock("@/lib/requireTwoFactorApi", () => ({ requireTwoFactorApi: mocks.requireTwoFactorApi }));
vi.mock("@/lib/databaseAudit", () => ({
    classifySqlOperation: (query) => /^\s*SELECT/i.test(query) ? "SELECT" : "WRITE",
    extractSqlTableName: () => "notes",
    finishDatabaseAudit: mocks.finishAudit,
    safeDatabaseErrorCode: () => "TEST_DATABASE_ERROR",
    startDatabaseAudit: mocks.startAudit,
}));
vi.mock("@/lib/databasePerformance", () => ({
    databasePerformanceNow: () => Date.now(),
    markDatabasePerformance: vi.fn(),
    recordDatabasePerformance: vi.fn(),
    startDatabasePerformance: () => ({ requestId: "integration-test" }),
}));

describe("query API with an actual SQLite database", () => {
    const userId = "vitest-sqlite-user";
    let root;
    let connectionString;
    let handler;
    let invalidateExternalSequelize;
    let storage;
    let previousStoragePath;
    let previousGlobalLimit;

    beforeEach(async () => {
        previousStoragePath = process.env.DATABASE_SQLITE_STORAGE_DIR;
        previousGlobalLimit = process.env.DATABASE_EXTERNAL_GLOBAL_LIMIT;
        root = await mkdtemp(path.join(os.tmpdir(), "pdv-query-integration-"));
        process.env.DATABASE_SQLITE_STORAGE_DIR = root;
        process.env.DATABASE_EXTERNAL_GLOBAL_LIMIT = "0";
        vi.resetModules();

        storage = await import("../lib/sqliteStorage.js");
        const filePath = await storage.createSqliteUploadPath(userId);
        connectionString = storage.createSqliteConnectionString(filePath);

        const setup = new Sequelize({ dialect: "sqlite", storage: filePath, logging: false });
        await setup.authenticate();
        await setup.query("CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL)");
        await setup.query("INSERT INTO notes (title) VALUES ('first note'), ('second note')");
        await setup.close();

        mocks.findDatabase.mockResolvedValue({
            id: "dataset-test",
            user_id: userId,
            db_name: "Temporary integration dataset",
            db_url_connection: "encrypted-test-connection",
            preferences: { sensitiveColumns: [] },
        });
        mocks.decrypt.mockReturnValue(connectionString);
        mocks.requireTwoFactorApi.mockResolvedValue({ id: userId });
        mocks.startAudit.mockResolvedValue({ id: "audit-test" });
        mocks.finishAudit.mockResolvedValue(undefined);

        ({ default: handler } = await import("../pages/api/playground/query/index.js"));
        ({ invalidateExternalSequelize } = await import("../lib/externalDatabase.js"));
    });

    afterEach(async () => {
        invalidateExternalSequelize?.(connectionString);
        if (previousStoragePath === undefined) delete process.env.DATABASE_SQLITE_STORAGE_DIR;
        else process.env.DATABASE_SQLITE_STORAGE_DIR = previousStoragePath;
        if (previousGlobalLimit === undefined) delete process.env.DATABASE_EXTERNAL_GLOBAL_LIMIT;
        else process.env.DATABASE_EXTERNAL_GLOBAL_LIMIT = previousGlobalLimit;
        await rm(root, { recursive: true, force: true });
        vi.clearAllMocks();
    });

    async function callQuery(query) {
        const response = {
            headers: {},
            setHeader(name, value) { this.headers[name] = value; },
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; },
        };
        await handler({ method: "POST", body: { query, db_id: "dataset-test" } }, response);
        return response;
    }

    it("reads and updates records through the authenticated app API", async () => {
        const initial = await callQuery("SELECT id, title FROM notes ORDER BY id");
        expect(initial.statusCode).toBe(200);
        expect(initial.body.data).toEqual([
            { id: 1, title: "first note" },
            { id: 2, title: "second note" },
        ]);

        const update = await callQuery("UPDATE notes SET title = 'updated note' WHERE id = 1");
        expect(update.statusCode).toBe(200);

        const afterUpdate = await callQuery("SELECT title FROM notes WHERE id = 1");
        expect(afterUpdate.statusCode).toBe(200);
        expect(afterUpdate.body.data).toEqual([{ title: "updated note" }]);
        expect(mocks.findDatabase).toHaveBeenCalledWith({
            where: { id: "dataset-test", user_id: userId },
        });
        expect(mocks.finishAudit).toHaveBeenCalled();
    });
});
