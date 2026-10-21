import Busboy from "busboy";
import { createWriteStream } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import db from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize, validateExternalDatabaseUrl } from "@/lib/externalDatabase";
import { createSqliteConnectionString, createSqliteUploadPath } from "@/lib/sqliteStorage";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { DATABASE_AUTHORIZATION_VERSION } from "@/lib/databaseAuthorization";

const MAX_SQLITE_UPLOAD_BYTES = 512 * 1024 * 1024;
const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "binary");

export const config = { api: { bodyParser: false, responseLimit: false } };

async function parseUpload(req, temporaryPath) {
    const parser = Busboy({
        headers: req.headers,
        limits: { files: 1, fields: 2, fileSize: MAX_SQLITE_UPLOAD_BYTES },
    });
    const fields = {};
    let fileFound = false;
    let extraFileFound = false;
    let fileWasTooLarge = false;
    let fileWrite = Promise.resolve();
    const parserDone = new Promise((resolve, reject) => {
        parser.once("close", resolve);
        parser.once("error", reject);
        req.once("error", reject);
    });
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (name, file) => {
        if (name !== "file" || fileFound) {
            extraFileFound = true;
            file.resume();
            return;
        }
        fileFound = true;
        file.once("limit", () => { fileWasTooLarge = true; });
        fileWrite = pipeline(file, createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }));
    });
    req.pipe(parser);
    let parseError;
    await parserDone.catch((error) => { parseError = error; });
    await fileWrite.catch((error) => { parseError ||= error; });
    if (parseError) throw parseError;
    if (!fileFound) throw new Error("Choose a SQLite database file to upload.");
    if (extraFileFound) throw new Error("Upload one SQLite database file at a time.");
    if (fileWasTooLarge) throw new Error("SQLite files must be 512 MB or smaller.");
    if (typeof fields.db_name !== "string" || !fields.db_name.trim() || fields.db_name.trim().length > 120) {
        throw new Error("Dataset name must be between 1 and 120 characters.");
    }
    if (fields.authorizationConfirmed !== "true") {
        throw new Error("Confirm that you are authorised to connect this database.");
    }
    return { dbName: fields.db_name.trim(), authorizationConfirmed: true };
}

async function hasSqliteHeader(filePath) {
    const handle = await open(filePath, "r");
    try {
        const header = Buffer.alloc(SQLITE_HEADER.length);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        return bytesRead === SQLITE_HEADER.length && header.equals(SQLITE_HEADER);
    } finally {
        await handle.close();
    }
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed." });
    }
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    let finalPath;
    let temporaryPath;
    let sequelize;
    let releaseConnectionSlot;
    let savedDataset = false;
    try {
        releaseConnectionSlot = await acquireExternalConnectionSlot();
        finalPath = await createSqliteUploadPath(session.id);
        temporaryPath = `${finalPath}.upload`;
        const { dbName } = await parseUpload(req, temporaryPath);
        if (!await hasSqliteHeader(temporaryPath)) throw new Error("The uploaded file is not a valid SQLite database.");
        await rename(temporaryPath, finalPath);
        const connectionString = createSqliteConnectionString(finalPath);
        await validateExternalDatabaseUrl(connectionString, session.id);
        sequelize = await acquireExternalSequelize(connectionString, session.id);
        await sequelize.authenticate();
        const dataset = await db.database.create({
            data: {
                user_id: session.id,
                db_name: dbName,
                db_url_connection: encrypt(connectionString),
                authorizationConfirmedAt: new Date(),
                authorizationVersion: DATABASE_AUTHORIZATION_VERSION,
            },
        });
        savedDataset = true;
        return res.status(201).json({ id: dataset.id, db_name: dataset.db_name, dialect: "sqlite", createdAt: dataset.createdAt });
    } catch (error) {
        console.error("Unable to add uploaded SQLite database", error?.code || error?.name || "SQLITE_UPLOAD_FAILED");
        return res.status(error.statusCode || 400).json({ error: error.message || "Unable to add the SQLite database." });
    } finally {
        if (sequelize) releaseExternalSequelize(sequelize);
        await releaseConnectionSlot?.();
        if (temporaryPath) await rm(temporaryPath, { force: true }).catch(() => {});
        // The saved connection owns the uploaded file after the database row exists.
        if (finalPath && !savedDataset) await rm(finalPath, { force: true }).catch(() => {});
    }
}
