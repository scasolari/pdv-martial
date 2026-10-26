import db from "@/lib/db";

export const LOCAL_USER_ID = "placedv-local-user";

// Retain the user relation used by saved connections and audit history, but
// make it a local singleton instead of an authenticated remote account.
export async function requireTwoFactorApi(_req, _res) {
    await db.user.upsert({
        where: { id: LOCAL_USER_ID },
        create: { id: LOCAL_USER_ID, name: "Local user" },
        update: {},
    });
    return { id: LOCAL_USER_ID };
}
