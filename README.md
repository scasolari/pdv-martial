This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

See [the app design system](docs/design-system.md) for the existing visual tokens, component patterns, and interaction conventions.

## Database connection safeguards

External MySQL connections use a 10 second connect timeout, one pooled connection per request, a 30 second SQL execution timeout, and a cap of five active external operations per server process. SQL result sets are streamed and capped at 1,000 rows. Production connections use verified TLS; set `DATABASE_SSL_CA_PEM` when a trusted custom CA is required. Database hosts must resolve to public addresses unless their exact hostname or IP is listed in `DATABASE_PRIVATE_HOST_ALLOWLIST` as a comma-separated value. Add private hosts only when the deployment is intentionally allowed to reach them.

The saved connection strings are encrypted with `DB_ENCRYPTION_KEY`. Set it to 64 hexadecimal characters and keep it outside source control. The activity history records data-changing SQL and cell edits, with table names, affected row counts, and outcomes; it does not store SQL text or cell values.

After deploying the audit schema, apply `prisma/migrations/20261014000000_add_database_audit_log/migration.sql` to the application's Prisma database and run `npx prisma generate` before deploying the code.

Before deploying the hardened two-factor flow, apply `prisma/migrations/20261015000300_harden_two_factor_authentication/migration.sql` to the application's Prisma database and run `npx prisma generate`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
