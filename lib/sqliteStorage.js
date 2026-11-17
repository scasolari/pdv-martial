import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";

const configuredStoragePath = process.env.DATABASE_SQLITE_STORAGE_DIR || path.join(process.cwd(), ".data", "sqlite");
const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "binary");

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

export async function validateSqliteConnectionFile(filePath, userId) {
    try {
        return await validateSqliteUserFile(filePath, userId);
    } catch (error) {
        // Desktop users can explicitly open a SQLite file from any local path.
        // Keep browser/server deployments restricted to app-managed uploads.
        if (process.env.PDV_DESKTOP_APP !== "1") throw error;
    }

    const realFilePath = await realpath(filePath);
    const fileStats = await stat(realFilePath);
    if (!fileStats.isFile()) throw new Error("SQLite database path must point to a file.");
    if (!/\.(?:db|sqlite|sqlite3)$/i.test(realFilePath)) throw new Error("Choose a .db, .sqlite, or .sqlite3 file.");
    const handle = await open(realFilePath, "r");
    try {
        const header = Buffer.alloc(SQLITE_HEADER.length);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        if (bytesRead !== SQLITE_HEADER.length || !header.equals(SQLITE_HEADER)) {
            throw new Error("The selected file is not a valid SQLite database.");
        }
    } finally {
        await handle.close();
    }
    return realFilePath;
}

export async function removeSqliteUserFile(filePath, userId) {
    try {
        const realFilePath = await realpath(filePath);
        const userDirectory = await getSqliteUserDirectory(userId, true);
        const relative = path.relative(userDirectory, realFilePath);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return;
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
