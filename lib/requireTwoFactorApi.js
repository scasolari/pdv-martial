import { getToken } from "next-auth/jwt";
import db from "@/lib/db";
import { verifyTwoFactorProof } from "@/lib/twoFactorProof";
export async function requireTwoFactorApi(req, res) {
    const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!session?.id) {
        res.status(401).json({ error: "Not authenticated." });
        return null;
    }

    try {
        const user = await db.user.findUnique({
            where: { id: session.id },
            select: { is2FAEnabled: true },
        });
        if (!user) {
            res.status(401).json({ error: "Not authenticated." });
            return null;
        }
        if (user.is2FAEnabled) {
            const proof = req.cookies?.["2fa_session"] || "";
            const verified = await verifyTwoFactorProof(proof, session.id, process.env.NEXTAUTH_SECRET);
            if (!verified) {
                res.status(403).json({ error: "Two-factor verification required." });
                return null;
            }
        }
        return session;
    } catch (error) {
        console.error("Unable to verify API authentication", error?.code || error?.name || "unknown");
        res.status(500).json({ error: "Unable to verify authentication." });
        return null;
    }
}
