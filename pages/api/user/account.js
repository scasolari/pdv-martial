import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { invalidateExternalSequelize } from "@/lib/externalDatabase";
import { parseStoredConnectionConfig } from "@/lib/databaseConnectionConfig";
import { clearTwoFactorIpAttempts, consumeTwoFactorIpAttempt } from "@/lib/twoFactorIpRateLimit";
import { decryptTwoFactorSecret, getVerifiedTotpStep, isTwoFactorLocked, recordTwoFactorFailure, consumeTotpStep } from "@/lib/twoFactor";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";
import { removeSqliteUserDirectory } from "@/lib/sqliteStorage";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "DELETE") {
        res.setHeader("Allow", "DELETE");
        return res.status(405).json({ error: "Method not allowed." });
    }

    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation.trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code : "";

    try {
        if (await consumeTwoFactorIpAttempt(req)) {
            return res.status(429).json({ error: "Too many attempts from this IP. Try again in 15 minutes." });
        }
        const user = await db.user.findUnique({
            where: { id: session.id },
            select: {
                id: true,
                email: true,
                is2FAEnabled: true,
                is2FAActive: true,
                twoFASecret: true,
                twoFAFailedAttempts: true,
                twoFALockedUntil: true,
                Database: { select: { db_url_connection: true } },
            },
        });
        if (!user) return res.status(401).json({ error: "Not authenticated." });

        if (!user.is2FAActive || !user.is2FAEnabled || !user.twoFASecret) {
            return res.status(403).json({
                code: "TWO_FACTOR_REQUIRED",
                error: "Configure and enable two-factor authentication before deleting your account.",
            });
        }

        if (!user.email || confirmation.toLowerCase() !== user.email.trim().toLowerCase()) {
            return res.status(400).json({ error: "Enter the account email to confirm deletion." });
        }

        if (isTwoFactorLocked(user)) {
            return res.status(429).json({ error: "Too many attempts. Try again later." });
        }
        let secret = "";
        try { secret = decryptTwoFactorSecret(user.twoFASecret); } catch { secret = ""; }
        const step = secret ? getVerifiedTotpStep(code, secret) : null;
        if (step === null) {
            await recordTwoFactorFailure(session.id);
            return res.status(401).json({ error: "Enter a valid current authenticator code." });
        }
        const consumed = await consumeTotpStep(session.id, step);
        if (!consumed) {
            await recordTwoFactorFailure(session.id);
            return res.status(401).json({ error: "This authenticator code has already been used." });
        }
        await clearTwoFactorIpAttempts(req);

        for (const savedDatabase of user.Database) {
            try {
                invalidateExternalSequelize(parseStoredConnectionConfig(decrypt(savedDatabase.db_url_connection)).connectionString);
            } catch {
                // Account deletion must still remove saved data if a legacy
                // connection string cannot be decrypted for pool cleanup.
            }
        }

        // Do not report account deletion as complete if uploaded SQLite files
        // could not be removed. A retry remains possible because the account
        // records have not been deleted yet.
        await removeSqliteUserDirectory(user.id);

        await db.$transaction(async (tx) => {
            if (user.email) {
                await tx.verificationToken.deleteMany({ where: { identifier: user.email } });
            }
            await tx.session.deleteMany({ where: { userId: user.id } });
            await tx.user.delete({ where: { id: user.id } });
        });

        return res.status(200).json({ deleted: true });
    } catch (error) {
        console.error("Unable to delete account", error?.code || error?.name || "unknown");
        return res.status(500).json({ error: "Unable to delete account." });
    }
}
