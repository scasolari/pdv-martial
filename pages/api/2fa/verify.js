import { getToken } from "next-auth/jwt";
import db from "@/lib/db";
import { clearTwoFactorIpAttempts, consumeTwoFactorIpAttempt } from "@/lib/twoFactorIpRateLimit";
import {
    decryptTwoFactorSecret,
    encryptTwoFactorSecret,
    getVerifiedTotpStep,
    isPendingSetupExpired,
    isTwoFactorLocked,
    recordTwoFactorFailure,
} from "@/lib/twoFactor";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ message: "Method not allowed." });
    }

    const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!session?.id) return res.status(401).json({ message: "Authentication required." });
    const { token } = req.body || {};
    if (typeof token !== "string" || !/^\d{6}$/.test(token)) {
        return res.status(400).json({ message: "Enter a valid six-digit code." });
    }

    try {
        if (await consumeTwoFactorIpAttempt(req)) {
            return res.status(429).json({ message: "Too many attempts from this IP. Try again in 15 minutes." });
        }
        const user = await db.user.findUnique({
            where: { id: session.id },
            select: {
                is2FAActive: true,
                twoFAPendingSecret: true,
                twoFAPendingExpiresAt: true,
                twoFAFailedAttempts: true,
                twoFALockedUntil: true,
            },
        });
        if (!user || user.is2FAActive || isPendingSetupExpired(user)) {
            return res.status(400).json({ message: "2FA setup expired. Start setup again." });
        }
        if (isTwoFactorLocked(user)) return res.status(429).json({ message: "Too many attempts. Try again later." });

        let secret = "";
        try { secret = decryptTwoFactorSecret(user.twoFAPendingSecret); } catch { secret = ""; }
        const step = secret ? getVerifiedTotpStep(token, secret) : null;
        if (step === null) {
            await recordTwoFactorFailure(session.id);
            return res.status(401).json({ message: "Invalid code." });
        }

        const result = await db.user.updateMany({
            where: {
                id: session.id,
                is2FAActive: false,
                twoFAPendingSecret: user.twoFAPendingSecret,
                twoFAPendingExpiresAt: { gt: new Date() },
            },
            data: {
                twoFASecret: encryptTwoFactorSecret(secret),
                twoFAPendingSecret: null,
                twoFAPendingExpiresAt: null,
                is2FAActive: true,
                is2FAEnabled: true,
                twoFAFailedAttempts: 0,
                twoFALockedUntil: null,
                twoFALastVerifiedStep: step,
            },
        });
        if (result.count !== 1) return res.status(409).json({ message: "2FA setup expired. Start setup again." });

        await clearTwoFactorIpAttempts(req);
        return res.status(200).json({ verified: true });
    } catch (error) {
        console.error("Unable to verify 2FA setup", error?.code || error?.name || "unknown");
        return res.status(500).json({ message: "Unable to verify 2FA setup." });
    }
}
