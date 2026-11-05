import db from "@/lib/db";
import { LOCAL_USER_ID } from "@/lib/requireTwoFactorApi";
import { setTwoFactorSession } from "@/lib/twoFactorSession";
import {
    consumeTotpStep,
    decryptTwoFactorSecret,
    getVerifiedTotpStep,
    isPendingSetupExpired,
    isTwoFactorLocked,
    recordTwoFactorFailure,
} from "@/lib/twoFactor";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
        const user = await db.user.findUnique({
            where: { id: LOCAL_USER_ID },
            select: {
                id: true,
                is2FAEnabled: true,
                twoFASecret: true,
                twoFAPendingSecret: true,
                twoFAPendingExpiresAt: true,
                twoFAFailedAttempts: true,
                twoFALockedUntil: true,
            },
        });
        if (!user) return res.status(404).json({ error: "The local profile is unavailable." });
        if (isTwoFactorLocked(user)) return res.status(429).json({ error: "Too many incorrect codes. Try again in 15 minutes." });

        if (user.is2FAEnabled) {
            if (!user.twoFASecret) return res.status(409).json({ error: "The authenticator setup is incomplete. Disable and set it up again." });
            const secret = decryptTwoFactorSecret(user.twoFASecret);
            const step = getVerifiedTotpStep(req.body?.token, secret);
            if (step === null || !(await consumeTotpStep(user.id, step))) {
                await recordTwoFactorFailure(user.id);
                return res.status(400).json({ error: "The authenticator code is invalid or already used." });
            }
        } else {
            if (isPendingSetupExpired(user)) {
                await db.user.update({ where: { id: user.id }, data: { twoFAPendingSecret: null, twoFAPendingExpiresAt: null } });
                return res.status(410).json({ error: "The setup expired. Start 2FA setup again." });
            }
            const secret = decryptTwoFactorSecret(user.twoFAPendingSecret);
            const step = getVerifiedTotpStep(req.body?.token, secret);
            if (step === null || !(await consumeTotpStep(user.id, step, user.twoFAPendingSecret))) {
                await recordTwoFactorFailure(user.id);
                return res.status(400).json({ error: "The authenticator code is invalid or already used." });
            }
            await db.user.update({
                where: { id: user.id },
                data: {
                    is2FAEnabled: true,
                    twoFAPendingSecret: null,
                    twoFAPendingExpiresAt: null,
                    twoFAFailedAttempts: 0,
                    twoFALockedUntil: null,
                },
            });
        }

        await setTwoFactorSession(res, user.id);
        return res.status(200).json({ enabled: true, unlocked: true });
    } catch (error) {
        console.error("Unable to verify local authenticator code", error?.code || error?.name || "unknown");
        return res.status(500).json({ error: "Unable to verify the authenticator code." });
    }
}
