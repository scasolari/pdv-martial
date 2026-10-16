import { getToken } from "next-auth/jwt";
import db from "@/lib/db";
import {
    consumeTotpStep,
    decryptTwoFactorSecret,
    encryptTwoFactorSecret,
    getVerifiedTotpStep,
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
    const { status, token } = req.body || {};
    if (typeof status !== "boolean" || typeof token !== "string" || !/^\d{6}$/.test(token)) {
        return res.status(400).json({ message: "A six-digit authenticator code is required." });
    }

    try {
        const user = await db.user.findUnique({
            where: { id: session.id },
            select: {
                is2FAActive: true,
                is2FAEnabled: true,
                twoFASecret: true,
                twoFAFailedAttempts: true,
                twoFALockedUntil: true,
            },
        });
        if (!user?.is2FAActive || !user.twoFASecret) {
            return res.status(409).json({ message: "Set up two-factor authentication first." });
        }
        if (user.is2FAEnabled === status) return res.status(200).json({ is2FAEnabled: status });
        if (isTwoFactorLocked(user)) return res.status(429).json({ message: "Too many attempts. Try again later." });

        let secret = "";
        try { secret = decryptTwoFactorSecret(user.twoFASecret); } catch {}
        const step = secret ? getVerifiedTotpStep(token, secret) : null;
        if (step === null) {
            await recordTwoFactorFailure(session.id);
            return res.status(401).json({ message: "Invalid code." });
        }

        const upgradedSecret = user.twoFASecret.startsWith("v1:") ? undefined : encryptTwoFactorSecret(secret);
        const consumed = await consumeTotpStep(session.id, step, upgradedSecret);
        if (!consumed) {
            await recordTwoFactorFailure(session.id);
            return res.status(401).json({ message: "Invalid or already used code." });
        }

        await db.user.update({ where: { id: session.id }, data: { is2FAEnabled: status } });
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        res.setHeader("Set-Cookie", `2fa_session=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`);
        return res.status(200).json({ is2FAEnabled: status });
    } catch (error) {
        console.error("Unable to update 2FA status", error?.code || error?.name || "unknown");
        return res.status(500).json({ message: "Unable to update 2FA status." });
    }
}
