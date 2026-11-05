import { createTwoFactorProof, verifyTwoFactorProof } from "@/lib/twoFactorProof";

export const TWO_FACTOR_COOKIE = "placedv_2fa_proof";

function signingSecret() {
    const secret = process.env.LOCAL_API_TOKEN;
    if (!secret) throw new Error("The local desktop API token is unavailable.");
    return secret;
}

export async function hasValidTwoFactorSession(req, userId) {
    const proof = req.cookies?.[TWO_FACTOR_COOKIE];
    if (!proof) return false;
    try {
        return await verifyTwoFactorProof(proof, userId, signingSecret());
    } catch {
        return false;
    }
}

export async function setTwoFactorSession(res, userId) {
    const proof = await createTwoFactorProof(userId, signingSecret());
    res.setHeader("Set-Cookie", `${TWO_FACTOR_COOKIE}=${encodeURIComponent(proof)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`);
}

export function clearTwoFactorSession(res) {
    res.setHeader("Set-Cookie", `${TWO_FACTOR_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}
