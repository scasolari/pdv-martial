import NextAuth from "next-auth";
import Github from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { createAuthOptions } from "@/lib/authOptions";

const prisma = new PrismaClient();

const authOptions = createAuthOptions({
    adapter: PrismaAdapter(prisma),
    providers: [
        Github({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            issuer: "https://github.com/login/oauth",
        }),
    ],
});

export default NextAuth(authOptions);
