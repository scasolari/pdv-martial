import { authenticator } from "@otplib/preset-default";
import QRCode from "qrcode";
import { getToken } from "next-auth/jwt";
import db from "@/lib/db";
import { encryptTwoFactorSecret, pendingSecretExpiry } from "@/lib/twoFactor";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ message: "Method not allowed." });
    }

    const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!session?.id) return res.status(401).json({ message: "Authentication required." });

    try {
        const user = await db.user.findUnique({
            where: { id: session.id },
            select: { email: true, is2FAActive: true },
        });
        if (!user) return res.status(401).json({ message: "Authentication required." });
        if (user.is2FAActive) return res.status(409).json({ message: "Two-factor authentication is already configured." });

        const secret = authenticator.generateSecret();
        const encryptedSecret = encryptTwoFactorSecret(secret);
        const otpauth = authenticator.keyuri(user.email || session.email || session.id, "PDV Query", secret);
        const qrCodeImage = await QRCode.toDataURL(otpauth);

        await db.user.update({
            where: { id: session.id },
            data: {
                twoFAPendingSecret: encryptedSecret,
                twoFAPendingExpiresAt: pendingSecretExpiry(),
            },
        });

        return res.status(200).json({ secret, qrCodeImage });
    } catch (error) {
        console.error("Unable to start 2FA setup", error?.code || error?.name || "unknown");
        return res.status(500).json({ message: "Unable to start 2FA setup." });
    }
}
