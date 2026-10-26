import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaCli = resolve(projectRoot, "node_modules/prisma/build/index.js");
const nextCli = resolve(projectRoot, "node_modules/next/dist/bin/next");
const env = { ...process.env, PDV_DESKTOP_APP: "1" };
const prismaResult = spawnSync(process.execPath, [prismaCli, "generate"], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
});

if (prismaResult.error) throw prismaResult.error;
if ((prismaResult.status ?? 1) !== 0) process.exit(prismaResult.status ?? 1);

const result = spawnSync(process.execPath, [nextCli, "build", "--webpack"], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
