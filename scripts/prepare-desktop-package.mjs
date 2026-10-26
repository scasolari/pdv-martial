import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const stageRoot = join(projectRoot, ".desktop-package");

await rm(stageRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });

const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
delete packageJson.devDependencies;
delete packageJson.scripts;
await writeFile(join(stageRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

const copyDirectory = async (name, shouldCopy = () => true) => {
  const source = join(projectRoot, name);
  await cp(source, join(stageRoot, name), {
    recursive: true,
    filter: (path) => shouldCopy(relative(source, path)),
  });
};

await copyDirectory(".next", (path) => !["cache", "dev", "diagnostics", "types"].includes(path.split(/[\\/]/)[0]));
await copyDirectory("node_modules");
await copyDirectory("electron");
await copyDirectory("public");
await copyDirectory("prisma", (path) => !path.startsWith("migrations.mysql-legacy"));
await cp(join(projectRoot, "next.config.mjs"), join(stageRoot, "next.config.mjs"));
await mkdir(join(stageRoot, "scripts"), { recursive: true });
await cp(join(projectRoot, "scripts", "desktop-bootstrap.mjs"), join(stageRoot, "scripts", "desktop-bootstrap.mjs"));

console.log(`Prepared desktop runtime in ${stageRoot}`);
