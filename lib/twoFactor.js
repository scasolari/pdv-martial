import CryptoJS from "crypto-js";
import { authenticator } from "@otplib/preset-default";
import { decrypt, encrypt } from "@/lib/crypto";
import db from "@/lib/db";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const PENDING_SETUP_MINUTES = 10;

export function encryptTwoFactorSecret(secret) {
    return `v1:${encrypt(secret)}`;
}

export function decryptTwoFactorSecret(value) {
    if (typeof value !== "string" || !value) return "";
    if (value.startsWith("v1:")) return decrypt(value.slice(3));

    // Existing accounts used CryptoJS passphrase encryption. Keep reading it
    // until successful verification upgrades the stored secret to AES-GCM.
    return CryptoJS.AES.decrypt(value, process.env.NEXTAUTH_SECRET).toString(CryptoJS.enc.Utf8);
}

export function getVerifiedTotpStep(token, secret, now = Date.now()) {
    if (typeof token !== "string" || !/^\d{6}$/.test(token)) return null;
    const delta = authenticator.checkDelta(token, secret);
    return typeof delta === "number" ? BigInt(Math.floor(now / 30_000) + delta) : null;
}

export function isTwoFactorLocked(user, now = Date.now()) {
    return user?.twoFALockedUntil && new Date(user.twoFALockedUntil).getTime() > now;
}

export function isPendingSetupExpired(user, now = Date.now()) {
    return !user?.twoFAPendingSecret
        || !user?.twoFAPendingExpiresAt
        || new Date(user.twoFAPendingExpiresAt).getTime() <= now;
}

export async function recordTwoFactorFailure(userId) {
    await db.$executeRaw`
        UPDATE User
        SET twoFALockedUntil = IF(
                twoFAFailedAttempts + 1 >= ${MAX_FAILED_ATTEMPTS},
                DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${LOCKOUT_MINUTES} MINUTE),
                twoFALockedUntil
            ),
            twoFAFailedAttempts = twoFAFailedAttempts + 1
        WHERE id = ${userId}
    `;
}

export async function consumeTotpStep(userId, step, encryptedSecret) {
    const result = await db.user.updateMany({
        where: {
            id: userId,
            OR: [
                { twoFALastVerifiedStep: null },
                { twoFALastVerifiedStep: { lt: step } },
            ],
        },
        data: {
            ...(encryptedSecret ? { twoFASecret: encryptedSecret } : {}),
            twoFALastVerifiedStep: step,
            twoFAFailedAttempts: 0,
            twoFALockedUntil: null,
        },
    });
    return result.count === 1;
}

export function pendingSecretExpiry(now = Date.now()) {
    return new Date(now + PENDING_SETUP_MINUTES * 60_000);
}
