import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("SQLite upload storage", () => {
    let root;
    let storage;
    const previousStoragePath = process.env.DATABASE_SQLITE_STORAGE_DIR;

    beforeEach(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), "pdv-sqlite-tests-"));
        process.env.DATABASE_SQLITE_STORAGE_DIR = root;
        vi.resetModules();
        storage = await import("../lib/sqliteStorage.js");
    });

    afterEach(async () => {
        if (previousStoragePath === undefined) delete process.env.DATABASE_SQLITE_STORAGE_DIR;
        else process.env.DATABASE_SQLITE_STORAGE_DIR = previousStoragePath;
        await rm(root, { recursive: true, force: true });
    });

    it("creates private per-user upload directories and round-trips encoded paths", async () => {
        const filePath = await storage.createSqliteUploadPath("user-one");
        const connectionString = storage.createSqliteConnectionString(filePath);
        const userDirectory = await storage.getSqliteUserDirectory("user-one");

        expect(filePath).toContain(userDirectory);
        expect(storage.getSqlitePathFromConnectionString(connectionString)).toBe(filePath);
        expect(storage.getSqlitePathFromConnectionString("mysql://db.example.test/app")).toBeNull();
    });

    it("allows access only to files owned by the given user", async () => {
        const ownFile = await storage.createSqliteUploadPath("owner");
        await writeFile(ownFile, "sqlite test file");
        await storage.getSqliteUserDirectory("another-user", true);

        await expect(storage.validateSqliteUserFile(ownFile, "owner")).resolves.toBe(ownFile);
        await expect(storage.validateSqliteUserFile(ownFile, "another-user"))
            .rejects.toThrow("SQLite files must belong to the current account.");
    });

    it("rejects symlinks that escape the user storage directory", async () => {
        const userDirectory = await storage.getSqliteUserDirectory("owner", true);
        const outsideFile = path.join(root, "outside.sqlite");
        const linkPath = path.join(userDirectory, "linked.sqlite");
        await writeFile(outsideFile, "not owned");
        await symlink(outsideFile, linkPath);

        await expect(storage.validateSqliteUserFile(linkPath, "owner"))
            .rejects.toThrow("SQLite files must belong to the current account.");
    });

    it("removes only the requested user's uploaded file and directory", async () => {
        const filePath = await storage.createSqliteUploadPath("owner");
        await writeFile(filePath, "sqlite test file");
        const directory = await storage.getSqliteUserDirectory("owner");

        await storage.removeSqliteUserFile(filePath, "owner");
        await expect(readFile(filePath)).rejects.toMatchObject({ code: "ENOENT" });
        await storage.removeSqliteUserDirectory("owner");
        await expect(storage.getSqliteUserDirectory("owner")).rejects.toMatchObject({ code: "ENOENT" });
        await expect(readFile(path.join(directory, "missing.sqlite"))).rejects.toMatchObject({ code: "ENOENT" });
    });
});
