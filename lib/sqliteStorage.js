import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, rm } from "node:fs/promises";
import path from "node:path";

const configuredStoragePath = process.env.DATABASE_SQLITE_STORAGE_DIR || path.join(process.cwd(), ".data", "sqlite");

export async function getSqliteUserDirectory(userId, create = false) {
    if (typeof userId !== "string" || !userId) throw new Error("A user is required for SQLite storage.");
    if (create) await mkdir(configuredStoragePath, { recursive: true, mode: 0o700 });
    const root = await realpath(/*turbopackIgnore: true*/ configuredStoragePath);
    const userKey = createHash("sha256").update(userId).digest("hex");
    const userDirectory = path.join(root, userKey);
    if (create) await mkdir(userDirectory, { recursive: true, mode: 0o700 });
    const realUserDirectory = await realpath(userDirectory);
    if (path.dirname(realUserDirectory) !== root) throw new Error("Invalid SQLite storage directory.");
    return realUserDirectory;
}

export async function createSqliteUploadPath(userId) {
    const directory = await getSqliteUserDirectory(userId, true);
    return path.join(directory, `${randomUUID()}.sqlite`);
}

export function createSqliteConnectionString(filePath) {
    const normalized = path.resolve(filePath).split(path.sep).filter(Boolean).map(encodeURIComponent).join("/");
    return `sqlite:///${normalized}`;
}

export function getSqlitePathFromConnectionString(connectionString) {
    try {
        const url = new URL(connectionString);
        return url.protocol === "sqlite:" ? decodeURIComponent(url.pathname) : null;
    } catch {
        return null;
    }
}

export async function validateSqliteUserFile(filePath, userId) {
    const userDirectory = await getSqliteUserDirectory(userId);
    const realFilePath = await realpath(filePath);
    const relative = path.relative(userDirectory, realFilePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("SQLite files must belong to the current account.");
    }
    return realFilePath;
}

export async function removeSqliteUserFile(filePath, userId) {
    try {
        const realFilePath = await validateSqliteUserFile(filePath, userId);
        await rm(realFilePath, { force: true });
    } catch (error) {
        if (error?.code !== "ENOENT") throw error;
    }
}

export async function removeSqliteUserDirectory(userId) {
    try {
        const directory = await getSqliteUserDirectory(userId);
        await rm(directory, { recursive: true, force: true });
    } catch (error) {
        if (error?.code !== "ENOENT") throw error;
    }
}
