import CryptoJS from "crypto-js";
import { authenticator } from "@otplib/preset-default";
import { decrypt, encrypt, isEncryptedWithCurrentKey } from "@/lib/crypto";
import db from "@/lib/db";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const PENDING_SETUP_MINUTES = 10;

export function encryptTwoFactorSecret(secret) {
    return `v2:${encrypt(secret)}`;
}

export function decryptTwoFactorSecret(value) {
    if (typeof value !== "string" || !value) return "";
    if (value.startsWith("v1:") || value.startsWith("v2:")) return decrypt(value.slice(3));

    // Existing accounts used CryptoJS passphrase encryption. Keep reading it
    // until successful verification upgrades the stored secret to AES-GCM.
    return CryptoJS.AES.decrypt(value, process.env.NEXTAUTH_SECRET).toString(CryptoJS.enc.Utf8);
}

export function isTwoFactorSecretCurrent(value) {
    return typeof value === "string" && value.startsWith("v2:")
        && isEncryptedWithCurrentKey(value.slice(3));
}

export function getVerifiedTotpStep(token, secret, now = Date.now()) {
    if (typeof token !== "string" || !/^\d{6}$/.test(token)) return null;
    // otplib captures its default epoch when the singleton is created. Clone it
    // with the current time for each check, otherwise a long-running app server
    // keeps validating against the time it started.
    const verifier = authenticator.clone({ epoch: now, window: 1 });
    const delta = verifier.checkDelta(token, secret);
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
    const user = await db.user.findUnique({ where: { id: userId }, select: { twoFAFailedAttempts: true } });
    if (!user) return;
    await db.user.update({
        where: { id: userId },
        data: {
            twoFAFailedAttempts: { increment: 1 },
            ...(user.twoFAFailedAttempts + 1 >= MAX_FAILED_ATTEMPTS
                ? { twoFALockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
                : {}),
        },
    });
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
