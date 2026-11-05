import { authenticator } from "@otplib/preset-default";
import QRCode from "qrcode";
import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { encryptTwoFactorSecret, pendingSecretExpiry } from "@/lib/twoFactor";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    try {
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri("Local user", "Placedv Query", secret);
        const qrCodeImage = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
        await db.user.update({
            where: { id: session.id },
            data: {
                twoFAPendingSecret: encryptTwoFactorSecret(secret),
                twoFAPendingExpiresAt: pendingSecretExpiry(),
                twoFAFailedAttempts: 0,
                twoFALockedUntil: null,
            },
        });
        return res.status(200).json({ secret, qrCodeImage, expiresInMinutes: 10 });
    } catch (error) {
        console.error("Unable to start local two-factor setup", error?.code || error?.name || "unknown");
        return res.status(500).json({ error: "Unable to start two-factor setup. Check the local encryption configuration." });
    }
}
