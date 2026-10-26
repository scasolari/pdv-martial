const { spawn } = require("node:child_process");
const electronBinary = require("electron");
const env = { ...process.env };

// Electron uses this flag only for its internal Node child processes. Tooling
// environments may export it globally, which would make Electron run main.cjs
// as plain Node and leave the Electron APIs unavailable.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [".", ...process.argv.slice(2)], {
    env,
    stdio: "inherit",
    windowsHide: false,
});

child.once("error", (error) => {
    console.error("Unable to launch Electron", error);
    process.exitCode = 1;
});
child.once("exit", (code, signal) => {
    process.exitCode = signal ? 1 : code ?? 1;
});
