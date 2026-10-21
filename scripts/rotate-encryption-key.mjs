import crypto from "node:crypto";
import prismaPackage from "@prisma/client";

const { PrismaClient } = prismaPackage;
const ALGORITHM = "aes-256-gcm";
const FORMAT_PREFIX = "enc:v2:";
const LEGACY_PREFIX = "enc:v1:";
const LEGACY_KEY_ID = "legacy";
const BATCH_SIZE = 200;
const execute = process.argv.includes("--execute");

function parseKey(value, label) {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new Error(`${label} must be a 32-byte hexadecimal key`);
    }
    return Buffer.from(value, "hex");
}

function readKeyRing() {
    const keys = new Map();
    if (process.env.DB_ENCRYPTION_KEYS) {
        const configured = JSON.parse(process.env.DB_ENCRYPTION_KEYS);
        if (!configured || typeof configured !== "object" || Array.isArray(configured)) {
            throw new Error("DB_ENCRYPTION_KEYS must be a JSON object mapping key IDs to hexadecimal keys");
        }
        for (const [keyId, value] of Object.entries(configured)) {
            if (!/^[a-zA-Z0-9_-]{1,64}$/.test(keyId)) throw new Error("Invalid encryption key ID");
            keys.set(keyId, parseKey(value, `DB_ENCRYPTION_KEYS[${keyId}]`));
        }
    }
    if (process.env.DB_ENCRYPTION_KEY && !keys.has(LEGACY_KEY_ID)) {
        keys.set(LEGACY_KEY_ID, parseKey(process.env.DB_ENCRYPTION_KEY, "DB_ENCRYPTION_KEY"));
    }
    const currentKeyId = process.env.DB_ENCRYPTION_CURRENT_KEY_ID || LEGACY_KEY_ID;
    if (!keys.size || !keys.has(currentKeyId)) {
        throw new Error("Configure DB_ENCRYPTION_KEYS and DB_ENCRYPTION_CURRENT_KEY_ID, keeping the legacy key available");
    }
    return { keys, currentKeyId };
}

const { keys, currentKeyId } = readKeyRing();

function getKey(keyId) {
    const key = keys.get(keyId);
    if (!key) throw new Error(`Encryption key '${keyId}' is unavailable; no data was changed for this value`);
    return key;
}

function aad(keyId) {
    return Buffer.from(`placedv:${FORMAT_PREFIX}${keyId}`, "utf8");
}

function encrypt(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(currentKeyId), iv);
    cipher.setAAD(aad(currentKeyId));
    const data = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    return `${FORMAT_PREFIX}${currentKeyId}:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

function decryptLegacy(value) {
    const [ivB64, tagB64, dataB64, ...extra] = value.split(":");
    if (!ivB64 || !tagB64 || dataB64 === undefined || extra.length) throw new Error("Invalid legacy ciphertext format");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid legacy ciphertext format");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(LEGACY_KEY_ID), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

function decrypt(value) {
    if (value.startsWith(LEGACY_PREFIX)) return decrypt(value.slice(LEGACY_PREFIX.length));
    if (!value.startsWith(FORMAT_PREFIX)) return decryptLegacy(value);
    const [scheme, version, keyId, ivB64, tagB64, dataB64, ...extra] = value.split(":");
    if (scheme !== "enc" || version !== "v2" || !keyId || !ivB64 || !tagB64 || dataB64 === undefined || extra.length) {
        throw new Error("Invalid versioned ciphertext format");
    }
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid versioned ciphertext format");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(keyId), iv);
    decipher.setAAD(aad(keyId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

function keyIdOf(value) {
    if (value.startsWith(FORMAT_PREFIX)) return value.slice(FORMAT_PREFIX.length).split(":", 1)[0];
    return LEGACY_KEY_ID;
}

function isCiphertext(value) {
    if (value.startsWith(FORMAT_PREFIX) || value.startsWith(LEGACY_PREFIX)) return true;
    const parts = value.split(":");
    return parts.length === 3
        && Buffer.from(parts[0], "base64").length === 12
        && Buffer.from(parts[1], "base64").length === 16;
}

async function forEachBatch(model, select, callback) {
    let cursor;
    while (true) {
        const rows = await model.findMany({
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { id: "asc" },
            take: BATCH_SIZE,
            select,
        });
        if (!rows.length) break;
        for (const row of rows) await callback(row);
        cursor = rows.at(-1).id;
        if (rows.length < BATCH_SIZE) break;
    }
}

const db = new PrismaClient();
const counts = { databaseConnections: 0, auditQueries: 0, twoFactorSecrets: 0, legacyTwoFactorSecretsSkipped: 0 };

async function update(model, id, field, oldValue, newValue) {
    if (!execute || oldValue === newValue) return;
    await model.updateMany({ where: { id, [field]: oldValue }, data: { [field]: newValue } });
}

try {
    await forEachBatch(db.database, { id: true, db_url_connection: true }, async (row) => {
        if (keyIdOf(row.db_url_connection) === currentKeyId && row.db_url_connection.startsWith(FORMAT_PREFIX)) return;
        const rotated = encrypt(decrypt(row.db_url_connection));
        await update(db.database, row.id, "db_url_connection", row.db_url_connection, rotated);
        counts.databaseConnections += 1;
    });

    await forEachBatch(db.databaseAuditLog, { id: true, query: true }, async (row) => {
        if (typeof row.query !== "string") return;
        if (isCiphertext(row.query) && row.query.startsWith(FORMAT_PREFIX) && keyIdOf(row.query) === currentKeyId) return;
        const plainQuery = isCiphertext(row.query) ? decrypt(row.query) : row.query;
        await update(db.databaseAuditLog, row.id, "query", row.query, encrypt(plainQuery));
        counts.auditQueries += 1;
    });

    await forEachBatch(db.user, { id: true, twoFASecret: true, twoFAPendingSecret: true }, async (row) => {
        for (const field of ["twoFASecret", "twoFAPendingSecret"]) {
            const stored = row[field];
            if (typeof stored !== "string") continue;
            if (!stored.startsWith("v1:") && !stored.startsWith("v2:")) {
                // The pre-AES-GCM CryptoJS format uses NEXTAUTH_SECRET and is intentionally out of scope.
                counts.legacyTwoFactorSecretsSkipped += 1;
                continue;
            }
            const payload = stored.slice(3);
            if (stored.startsWith("v2:") && payload.startsWith(FORMAT_PREFIX) && keyIdOf(payload) === currentKeyId) continue;
            const rotated = `v2:${encrypt(decrypt(payload))}`;
            await update(db.user, row.id, field, stored, rotated);
            counts.twoFactorSecrets += 1;
        }
    });

    console.log(`${execute ? "Rotation applied" : "Dry run only; no data changed"}.`);
    console.log(`Current encryption key ID: ${currentKeyId}`);
    console.log(`Database connections to rotate: ${counts.databaseConnections}`);
    console.log(`Audit queries to rotate/encrypt: ${counts.auditQueries}`);
    console.log(`2FA secrets to rotate: ${counts.twoFactorSecrets}`);
    console.log(`Legacy CryptoJS 2FA secrets skipped: ${counts.legacyTwoFactorSecretsSkipped}`);
    if (!execute) console.log("Review the counts, then rerun with --execute to apply the rotation.");
} finally {
    await db.$disconnect();
}
