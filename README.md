# Placedv Query

Placedv Query is a free, self-hosted database workspace for browsing tables, filtering and grouping records, editing rows, and running SQL queries. Run the application on your own computer or server and connect it to databases you are authorized to use.

The application is not a hosted service. Each installation manages its own account database, SQLite uploads, encryption key, and connected database credentials. GitHub OAuth is used for sign-in.

## Features

- Connect to MySQL, MariaDB, PostgreSQL, and Microsoft SQL Server.
- Upload and browse SQLite databases.
- Browse, filter, group, sort, edit, insert, and export table data.
- Run SQL queries and inspect activity history.
- Optional two-factor authentication and sensitive-column masking.

## Requirements

- Node.js and npm.
- A MySQL database for the application's accounts, saved connections, preferences, and activity history. This can run locally.
- A GitHub OAuth application for sign-in.

For local GitHub OAuth, set the callback URL to `http://localhost:3000/api/auth/callback/github`.

## Install and run locally

```bash
git clone <repository-url>
cd placedv-query
npm ci
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL`, `NEXTAUTH_SECRET`, `DB_ENCRYPTION_KEY`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET`. Generate secrets locally:

```bash
openssl rand -base64 32  # NEXTAUTH_SECRET
openssl rand -hex 32     # DB_ENCRYPTION_KEY
```

Then prepare the Prisma client and application database and start Next.js:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep `.env` private and back up `DB_ENCRYPTION_KEY` securely. If you lose or replace that key, saved database credentials, activity queries, and encrypted two-factor secrets may become unreadable.

### Rotate the encryption key

Keep the existing key available while rotating. Add both the old and new 64-character hexadecimal keys to `DB_ENCRYPTION_KEYS` as a JSON object, and set `DB_ENCRYPTION_CURRENT_KEY_ID` to the new key's ID. Keep a protected backup of the database and `.env`, then run a dry run followed by the actual rotation:

```bash
node scripts/rotate-encryption-key.mjs
node scripts/rotate-encryption-key.mjs --execute
```

The script reports how many connection strings, history queries, and two-factor secrets it will rotate. After a successful run and verification, remove old keys from the keyring and remove `DB_ENCRYPTION_KEY` if it only held the old legacy key. Never remove a key while encrypted values still depend on it.

SQLite uploads are stored under `.data/sqlite` by default. Set `DATABASE_SQLITE_STORAGE_DIR` to use another local directory. The app connects to external databases from the machine running the application; use database credentials with the least privileges needed.

## Configuration

See [.env.example](.env.example) for required and optional settings. `DATABASE_AUDIT_RETENTION_DAYS` defaults to 90 days, and the application keeps at most 100 history entries per database. Inactive history is removed on access. A self-hosted installation may optionally schedule `POST /api/internal/maintenance/prune-audit` with `DATABASE_AUDIT_CLEANUP_SECRET` to clean inactive history even when it is not opened.

## Development

```bash
npm run dev
npm run lint
npm test
```

The test suite uses temporary databases and does not require access to a production database. See [the test report](docs/TESTS_RECAP.md) for the scope and last recorded results. That report is a historical snapshot; rerun the suite before relying on it for a release.

## Security

Do not commit `.env` files, database dumps, SQLite uploads, OAuth secrets, or encryption keys. If you find a vulnerability, report it privately to `info@placedv.com`; please do not include credentials or personal data in the report.

## License

Placedv Query is released under the MIT License. See [LICENSE](LICENSE).
