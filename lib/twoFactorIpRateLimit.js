import { createHmac } from "crypto";
import { isIP } from "node:net";
import db from "@/lib/db";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const RECORD_RETENTION_MS = 24 * 60 * 60 * 1000;

function getClientIp(req) {
    // In a server deployment, X-Real-IP must be set by a trusted reverse proxy.
    // Avoid parsing X-Forwarded-For because it can include client-supplied values.
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && isIP(realIp.trim())) return realIp.trim();

    const remoteAddress = req.socket?.remoteAddress || "";
    return isIP(remoteAddress) ? remoteAddress : "unknown";
}

function getIpHash(req) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error("NEXTAUTH_SECRET is required for IP-based 2FA throttling.");
    return createHmac("sha256", secret).update(getClientIp(req)).digest("hex");
}

export async function consumeTwoFactorIpAttempt(req) {
    const ipHash = getIpHash(req);
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MS);

    return db.$transaction(async (tx) => {
        await tx.$executeRaw`
            INSERT IGNORE INTO TwoFactorIpAttempt
                (ipHash, failedAttempts, windowStartedAt, lockedUntil, updatedAt)
            VALUES (${ipHash}, 0, ${now}, NULL, ${now})
        `;

        const [record] = await tx.$queryRaw`
            SELECT failedAttempts, windowStartedAt, lockedUntil
            FROM TwoFactorIpAttempt
            WHERE ipHash = ${ipHash}
            FOR UPDATE
        `;

        if (record.lockedUntil && new Date(record.lockedUntil).getTime() > now.getTime()) {
            return true;
        }

        const startsNewWindow = new Date(record.windowStartedAt).getTime() <= windowStart.getTime();
        const failedAttempts = startsNewWindow ? 1 : record.failedAttempts + 1;
        const lockedUntil = failedAttempts >= MAX_ATTEMPTS
            ? new Date(now.getTime() + LOCKOUT_MS)
            : null;

        await tx.$executeRaw`
            UPDATE TwoFactorIpAttempt
            SET failedAttempts = ${failedAttempts},
                windowStartedAt = ${startsNewWindow ? now : record.windowStartedAt},
                lockedUntil = ${lockedUntil},
                updatedAt = ${now}
            WHERE ipHash = ${ipHash}
        `;
        await tx.$executeRaw`
            DELETE FROM TwoFactorIpAttempt
            WHERE updatedAt < ${new Date(now.getTime() - RECORD_RETENTION_MS)}
        `;

        return Boolean(lockedUntil);
    });
}

export async function clearTwoFactorIpAttempts(req) {
    const ipHash = getIpHash(req);
    const now = new Date();
    try {
        await db.$executeRaw`
            UPDATE TwoFactorIpAttempt
            SET failedAttempts = 0, windowStartedAt = ${now}, lockedUntil = NULL, updatedAt = ${now}
            WHERE ipHash = ${ipHash}
        `;
    } catch (error) {
        console.error("Unable to reset 2FA IP rate limit", error?.code || error?.name || "unknown");
    }
}
