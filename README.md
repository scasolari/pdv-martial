# Placedv Query

Placedv Query is a local desktop workspace for browsing tables, editing records, and running SQL against databases you are authorized to use. The app runs in Electron and stores its own settings, saved connections, and activity history in a SQLite database created on first launch.

## Desktop development

Requirements: Node.js 20.9 or later and npm.

```bash
npm ci
npm run desktop:dev
```

The desktop launcher initializes the local SQLite database and a per-installation encryption key in Electron's user data directory. Development mode uses a separate `placedv-query-dev` profile and a random key file with owner-only permissions; the signed production app protects its key with the OS keychain. It starts the Next.js server on a free loopback port (`127.0.0.1`) and opens the app in a desktop window. The app server is not exposed to other devices on the local network.

Create a packaged app for the current platform with:

```bash
npm run desktop:package
```

Builds are written to `release/`. The first packaged builds should be produced and smoke-checked on each target operating system because Electron and database drivers include platform-specific binaries.

## Features

- Connect to MySQL, MariaDB, PostgreSQL, Microsoft SQL Server, and SQLite.
- Browse, filter, group, sort, edit, insert, and export table data.
- Run SQL queries and inspect activity history.
- Upload and browse SQLite databases.
- Mask selected sensitive columns.

## Local data and security

The app does not use accounts or remote authentication. Its SQLite file and uploaded SQLite databases live in Electron's per-user application data directory. Saved database credentials are encrypted with a per-installation key protected by the operating system keychain (macOS Keychain, Windows DPAPI, or a Linux Secret Service/KWallet backend). Back up the application data directory and keep access to the same OS account/keychain to preserve settings and saved connections. Losing the OS-protected key makes saved connection credentials unreadable. On Linux, configure GNOME Keyring or KWallet before launching the app.

The local web server binds only to `127.0.0.1`, uses a random available port, accepts only loopback hostnames, and rejects cross-origin API requests. Electron adds a per-launch API token to requests in its main process; the renderer cannot read the token. The app also sends a nonce-based Content Security Policy. These measures help prevent unrelated websites and other devices from using the local API, but do not protect data from malware or another process already running as the same user on the same computer.

SQLite uploads and external connection credentials are stored on the local computer. Use database credentials with the least privileges needed and connect only to databases you are authorized to access.

## License

Placedv Query is released under the MIT License.
