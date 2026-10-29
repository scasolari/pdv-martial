import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const stageRoot = join(projectRoot, ".desktop-package");

await rm(stageRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });

const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
delete packageJson.devDependencies;
delete packageJson.scripts;
await writeFile(join(stageRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

// Build a clean production dependency tree instead of copying the development
// checkout's entire node_modules (which can overwhelm electron-builder's file
// copying/signing step on GitHub macOS runners).
await cp(join(projectRoot, "package-lock.json"), join(stageRoot, "package-lock.json"));

const copyDirectory = async (name, shouldCopy = () => true) => {
  const source = join(projectRoot, name);
  await cp(source, join(stageRoot, name), {
    recursive: true,
    filter: (path) => shouldCopy(relative(source, path)),
  });
};

// Source maps are only useful for debugging and account for thousands of
// extra files in Next.js and dependency packages. The macOS signing walk scans
// every packaged file concurrently, so omitting maps avoids exhausting the
// file descriptors available on GitHub-hosted macOS runners.
const removeSourceMaps = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await removeSourceMaps(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".map")) {
      await rm(entryPath, { force: true });
    }
  }
};

await copyDirectory(".next", (path) => !["cache", "dev", "diagnostics", "types"].includes(path.split(/[\\/]/)[0]));
await copyDirectory("prisma", (path) => !path.startsWith("migrations.mysql-legacy"));

// Windows exposes npm through npm.cmd, which Node must launch through a shell.
const installResult = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--omit=dev"], {
  shell: process.platform === "win32",
  cwd: stageRoot,
  stdio: "inherit",
  env: process.env,
});
if (installResult.error) throw installResult.error;
if ((installResult.status ?? 1) !== 0) process.exit(installResult.status ?? 1);

// ssh2 treats cpu-features as an optional optimization and falls back when it
// is unavailable. Its legacy NAN binding does not build against Electron 45,
// so omit it from the packaged runtime and let ssh2 use its portable fallback.
await rm(join(stageRoot, "node_modules", "cpu-features"), { recursive: true, force: true });
// electron-builder also scans the workspace root when rebuilding native
// dependencies. Remove the optional module there on Linux as well, otherwise
// it attempts to rebuild the incompatible copy from the development install.
if (process.platform === "linux") {
  await rm(join(projectRoot, "node_modules", "cpu-features"), { recursive: true, force: true });
}

// Preserve the Prisma client generated for the production build. It contains
// the platform-specific engine selected on the packaging runner.
await cp(join(projectRoot, "node_modules", ".prisma"), join(stageRoot, "node_modules", ".prisma"), { recursive: true });
await copyDirectory("electron");
await copyDirectory("public");
await cp(join(projectRoot, "next.config.mjs"), join(stageRoot, "next.config.mjs"));
await mkdir(join(stageRoot, "scripts"), { recursive: true });
await cp(join(projectRoot, "scripts", "desktop-bootstrap.mjs"), join(stageRoot, "scripts", "desktop-bootstrap.mjs"));
await removeSourceMaps(stageRoot);

console.log(`Prepared desktop runtime in ${stageRoot}`);
