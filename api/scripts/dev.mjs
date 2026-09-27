import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const env = new URL("../.env", import.meta.url);
if (existsSync(env)) loadEnvFile(fileURLToPath(env));
const target = process.argv[2] ?? "server";
if (!["server", "migrate"].includes(target))
  throw new Error("Unknown API command");
const child = spawn("go", ["run", `./cmd/${target}`], {
  cwd,
  env: { ...process.env, CGO_ENABLED: "0" },
  stdio: "inherit",
});
child.on("error", () => {
  console.error("Unable to start Go API");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
