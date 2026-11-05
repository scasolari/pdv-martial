import db from "@/lib/db";
import { hasValidTwoFactorSession } from "@/lib/twoFactorSession";

export const LOCAL_USER_ID = "placedv-local-user";

// Retain the user relation used by saved connections and audit history, but
// make it a local singleton instead of an authenticated remote account.
export async function requireTwoFactorApi(req, res) {
    const user = await db.user.upsert({
        where: { id: LOCAL_USER_ID },
        create: { id: LOCAL_USER_ID, name: "Local user" },
        update: {},
        select: { id: true, is2FAEnabled: true },
    });
    if (user.is2FAEnabled && !(await hasValidTwoFactorSession(req, user.id))) {
        res.status(403).json({ error: "Unlock the app with your authenticator code to continue." });
        return null;
    }
    return { id: user.id };
}
