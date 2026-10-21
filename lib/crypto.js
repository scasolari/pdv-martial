import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT_PREFIX = "enc:v2:";
const LEGACY_FORMAT_PREFIX = "enc:v1:";
const LEGACY_KEY_ID = "legacy";

function parseKey(value, name) {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new Error(`${name} must be a 32-byte hexadecimal key`);
    }
    return Buffer.from(value, "hex");
}

function getKeyRing() {
    const keys = new Map();
    const serializedKeys = process.env.DB_ENCRYPTION_KEYS;
    if (serializedKeys) {
        let configured;
        try {
            configured = JSON.parse(serializedKeys);
        } catch {
            throw new Error("DB_ENCRYPTION_KEYS must be a JSON object mapping key IDs to hexadecimal keys");
        }
        if (!configured || typeof configured !== "object" || Array.isArray(configured)) {
            throw new Error("DB_ENCRYPTION_KEYS must be a JSON object mapping key IDs to hexadecimal keys");
        }
        for (const [keyId, value] of Object.entries(configured)) {
            if (!/^[a-zA-Z0-9_-]{1,64}$/.test(keyId)) throw new Error("Invalid database encryption key ID");
            keys.set(keyId, parseKey(value, `DB_ENCRYPTION_KEYS[${keyId}]`));
        }
    }

    // Keep the original variable as the legacy key during a staged migration.
    if (process.env.DB_ENCRYPTION_KEY && !keys.has(LEGACY_KEY_ID)) {
        keys.set(LEGACY_KEY_ID, parseKey(process.env.DB_ENCRYPTION_KEY, "DB_ENCRYPTION_KEY"));
    }
    if (keys.size === 0) throw new Error("Configure DB_ENCRYPTION_KEY or DB_ENCRYPTION_KEYS");
    return keys;
}

export function getCurrentEncryptionKeyId() {
    const keyId = process.env.DB_ENCRYPTION_CURRENT_KEY_ID || LEGACY_KEY_ID;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(keyId)) throw new Error("Invalid DB_ENCRYPTION_CURRENT_KEY_ID");
    if (!getKeyRing().has(keyId)) throw new Error("DB_ENCRYPTION_CURRENT_KEY_ID is missing from DB_ENCRYPTION_KEYS");
    return keyId;
}

function additionalData(keyId) {
    return Buffer.from(`placedv:${FORMAT_PREFIX}${keyId}`, "utf8");
}

export function encrypt(plainText) {
    const keyId = getCurrentEncryptionKeyId();
    const key = getKeyRing().get(keyId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(additionalData(keyId));

    const ciphertext = Buffer.concat([
        cipher.update(String(plainText), "utf8"),
        cipher.final(),
    ]);

    return `${FORMAT_PREFIX}${keyId}:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

function decryptVersioned(payload) {
    const parts = payload.split(":");
    const [scheme, version, keyId, ivB64, tagB64, dataB64, ...extra] = parts;
    if (scheme !== "enc" || version !== "v2" || !keyId || !ivB64 || !tagB64 || dataB64 === undefined || extra.length) {
        throw new Error("Invalid encrypted payload");
    }
    const key = getKeyRing().get(keyId);
    if (!key) throw new Error(`Encryption key '${keyId}' is unavailable`);

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted payload");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(additionalData(keyId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function decryptLegacy(payload) {
    const [ivB64, tagB64, dataB64, ...extra] = payload.split(":");
    if (!ivB64 || !tagB64 || dataB64 === undefined || extra.length) throw new Error("Invalid encrypted payload");
    const key = getKeyRing().get(LEGACY_KEY_ID);
    if (!key) throw new Error("Legacy database encryption key is unavailable");

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted payload");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function decrypt(payload) {
    if (typeof payload !== "string" || !payload) throw new Error("Invalid encrypted payload");
    if (payload.startsWith(FORMAT_PREFIX)) return decryptVersioned(payload);
    if (payload.startsWith(LEGACY_FORMAT_PREFIX)) return decrypt(payload.slice(LEGACY_FORMAT_PREFIX.length));
    return decryptLegacy(payload);
}

export function isEncryptedWithCurrentKey(payload) {
    if (typeof payload !== "string" || !payload.startsWith(FORMAT_PREFIX)) return false;
    const keyId = payload.slice(FORMAT_PREFIX.length).split(":", 1)[0];
    return keyId === getCurrentEncryptionKeyId();
}

export function isEncryptedValue(payload) {
    if (typeof payload !== "string") return false;
    if (payload.startsWith(FORMAT_PREFIX) || payload.startsWith(LEGACY_FORMAT_PREFIX)) return true;
    const parts = payload.split(":");
    return parts.length === 3 && Buffer.from(parts[0], "base64").length === 12 && Buffer.from(parts[1], "base64").length === 16;
}

export function getEncryptionKeyId(payload) {
    if (typeof payload !== "string") return null;
    if (payload.startsWith(FORMAT_PREFIX)) return payload.slice(FORMAT_PREFIX.length).split(":", 1)[0] || null;
    if (payload.startsWith(LEGACY_FORMAT_PREFIX)) return LEGACY_KEY_ID;
    return isEncryptedValue(payload) ? LEGACY_KEY_ID : null;
}
