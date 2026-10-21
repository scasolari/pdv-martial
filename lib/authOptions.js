export function createAuthOptions({ adapter, providers, secret = process.env.NEXTAUTH_SECRET }) {
    return {
        adapter,
        secret,
        session: { strategy: "jwt" },
        providers,
        callbacks: {
            session: async ({ session, token }) => {
                if (session?.user) {
                    session.user.id = token.id;
                    session.user.role = token.role;
                    session.user.provider = token.provider;
                    session.user.is2FAEnabled = token.is2FAEnabled;
                    session.user.is2FAActive = token.is2FAActive;
                }
                return session;
            },
            jwt: async ({ user, token, account }) => {
                if (user) {
                    token.id = user.id;
                    token.role = user.role;
                    token.provider = account.provider;
                    token.is2FAEnabled = user.is2FAEnabled;
                    token.is2FAActive = user.is2FAActive;
                }
                return token;
            },
        },
    };
}
