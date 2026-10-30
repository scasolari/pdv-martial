import NextAuth from "next-auth";
import Github from "next-auth/providers/github";
import { createAuthOptions } from "@/lib/authOptions";

const authOptions = createAuthOptions({
    providers: [
        Github({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            issuer: "https://github.com/login/oauth",
        }),
    ],
});

export default NextAuth(authOptions);
