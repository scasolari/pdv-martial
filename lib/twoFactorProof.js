const PROOF_TTL_SECONDS = 8 * 60 * 60;

function toHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value) {
    if (!/^(?:[a-f0-9]{2})+$/i.test(value)) return null;
    return Uint8Array.from(value.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
}

async function importSigningKey(secret) {
    if (!secret) throw new Error("NEXTAUTH_SECRET is required.");
    return globalThis.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

function proofMessage(userId, issuedAt, expiresAt) {
    return `2fa:v1:${userId}:${issuedAt}:${expiresAt}`;
}

export async function createTwoFactorProof(userId, secret, now = Date.now()) {
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + PROOF_TTL_SECONDS;
    const key = await importSigningKey(secret);
    const signature = await globalThis.crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(proofMessage(userId, issuedAt, expiresAt))
    );
    return `${issuedAt}.${expiresAt}.${toHex(new Uint8Array(signature))}`;
}

export async function verifyTwoFactorProof(proof, userId, secret, now = Date.now()) {
    if (typeof proof !== "string" || typeof userId !== "string") return false;
    const match = /^(\d{10})\.(\d{10})\.([a-f0-9]{64})$/i.exec(proof);
    if (!match) return false;
    const issuedAt = Number(match[1]);
    const expiresAt = Number(match[2]);
    const nowSeconds = Math.floor(now / 1000);
    if (issuedAt > nowSeconds + 60 || expiresAt <= nowSeconds || expiresAt - issuedAt !== PROOF_TTL_SECONDS) return false;

    const signature = fromHex(match[3]);
    if (!signature) return false;
    const key = await importSigningKey(secret);
    return globalThis.crypto.subtle.verify(
        "HMAC",
        key,
        signature,
        new TextEncoder().encode(proofMessage(userId, issuedAt, expiresAt))
    );
}
