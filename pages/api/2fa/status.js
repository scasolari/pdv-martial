import db from "@/lib/db";
import { LOCAL_USER_ID } from "@/lib/requireTwoFactorApi";
import { clearTwoFactorSession, hasValidTwoFactorSession } from "@/lib/twoFactorSession";
import { consumeTotpStep, decryptTwoFactorSecret, getVerifiedTotpStep, isTwoFactorLocked, recordTwoFactorFailure } from "@/lib/twoFactor";

export default async function handler(req, res) {
    if (req.method === "GET") {
        try {
            const user = await db.user.upsert({
                where: { id: LOCAL_USER_ID },
                create: { id: LOCAL_USER_ID, name: "Local user" },
                update: {},
                select: { id: true, is2FAEnabled: true },
            });
            const unlocked = !user.is2FAEnabled || await hasValidTwoFactorSession(req, user.id);
            return res.status(200).json({ enabled: user.is2FAEnabled, unlocked });
        } catch (error) {
            console.error("Unable to read local two-factor status", error?.code || error?.name || "unknown");
            return res.status(500).json({ error: "Unable to read two-factor status." });
        }
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
        const user = await db.user.findUnique({
            where: { id: LOCAL_USER_ID },
            select: { id: true, is2FAEnabled: true, twoFASecret: true, twoFAFailedAttempts: true, twoFALockedUntil: true, twoFALastVerifiedStep: true },
        });
        if (!user?.is2FAEnabled || !user.twoFASecret) return res.status(400).json({ error: "Two-factor authentication is not enabled." });
        if (isTwoFactorLocked(user)) return res.status(429).json({ error: "Too many incorrect codes. Try again in 15 minutes." });

        const secret = decryptTwoFactorSecret(user.twoFASecret);
        const step = getVerifiedTotpStep(req.body?.token, secret);
        if (step === null || !(await consumeTotpStep(user.id, step))) {
            await recordTwoFactorFailure(user.id);
            return res.status(400).json({ error: "The authenticator code is invalid or already used." });
        }

        await db.user.update({
            where: { id: user.id },
            data: {
                is2FAEnabled: false,
                twoFASecret: null,
                twoFAPendingSecret: null,
                twoFAPendingExpiresAt: null,
                twoFAFailedAttempts: 0,
                twoFALockedUntil: null,
                twoFALastVerifiedStep: null,
            },
        });
        clearTwoFactorSession(res);
        return res.status(200).json({ enabled: false });
    } catch (error) {
        console.error("Unable to update local two-factor status", error?.code || error?.name || "unknown");
        return res.status(500).json({ error: "Unable to update two-factor status." });
    }
}
