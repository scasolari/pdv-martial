import { getToken } from "next-auth/jwt";
import db from "@/lib/db";
import { createTwoFactorProof } from "@/lib/twoFactorProof";
import { clearTwoFactorIpAttempts, consumeTwoFactorIpAttempt } from "@/lib/twoFactorIpRateLimit";
import {
    consumeTotpStep,
    decryptTwoFactorSecret,
    encryptTwoFactorSecret,
    getVerifiedTotpStep,
    isTwoFactorSecretCurrent,
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
    if (!session?.id) return res.status(401).json({ verified: false, message: "Authentication required." });
    const { token } = req.body || {};
    if (typeof token !== "string" || !/^\d{6}$/.test(token)) {
        return res.status(400).json({ verified: false, message: "Enter a valid six-digit code." });
    }

    try {
        if (await consumeTwoFactorIpAttempt(req)) {
            return res.status(429).json({ verified: false, message: "Too many attempts from this IP. Try again in 15 minutes." });
        }
        const user = await db.user.findUnique({
            where: { id: session.id },
            select: {
                is2FAEnabled: true,
                is2FAActive: true,
                twoFASecret: true,
                twoFAFailedAttempts: true,
                twoFALockedUntil: true,
            },
        });
        if (!user?.is2FAEnabled || !user.is2FAActive || !user.twoFASecret) {
            return res.status(403).json({ verified: false, message: "Two-factor authentication is not enabled." });
        }
        if (isTwoFactorLocked(user)) return res.status(429).json({ verified: false, message: "Too many attempts. Try again later." });

        let secret = "";
        try { secret = decryptTwoFactorSecret(user.twoFASecret); } catch { secret = ""; }
        const step = secret ? getVerifiedTotpStep(token, secret) : null;
        if (step === null) {
            await recordTwoFactorFailure(session.id);
            return res.status(401).json({ verified: false, message: "Invalid code." });
        }

        const upgradedSecret = isTwoFactorSecretCurrent(user.twoFASecret) ? undefined : encryptTwoFactorSecret(secret);
        const consumed = await consumeTotpStep(session.id, step, upgradedSecret);
        if (!consumed) {
            await recordTwoFactorFailure(session.id);
            return res.status(401).json({ verified: false, message: "Invalid or already used code." });
        }

        const proof = await createTwoFactorProof(session.id, process.env.NEXTAUTH_SECRET);
        await clearTwoFactorIpAttempts(req);
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        res.setHeader("Set-Cookie", `2fa_session=${proof}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=28800`);
        return res.status(200).json({ verified: true });
    } catch (error) {
        console.error("Unable to verify 2FA code", error?.code || error?.name || "unknown");
        return res.status(500).json({ verified: false, message: "Unable to verify code." });
    }
}
