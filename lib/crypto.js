// /lib/crypto.ts
import crypto from "crypto";

const ALGO = "aes-256-gcm";

// 32 bytes = 64 caratteri hex
function getKey() {
    const value = process.env.DB_ENCRYPTION_KEY;
    if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new Error("DB_ENCRYPTION_KEY must be a 32-byte hexadecimal key");
    }
    return Buffer.from(value, "hex");
}

export function encrypt(plainText) {
    const iv = crypto.randomBytes(12); // 12 bytes consigliati per GCM
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);

    const encrypted = Buffer.concat([
        cipher.update(plainText, "utf8"),
        cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // formato: iv:tag:ciphertext (tutto in base64)
    return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString(
        "base64"
    )}`;
}

export function decrypt(payload) {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload");

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");

    if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted payload");
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
}
