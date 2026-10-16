import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;
    try {
        const fetchUser = await db.user.findUnique({
            where: { id: session.id },
            select: { token: true },
        });
        return res.status(200).json(fetchUser);
    } catch (error) {
        console.error("Unable to load user data", error?.code || error?.name || "unknown");
        return res.status(500).json({ message: "Unable to load user data." });
    }
}
