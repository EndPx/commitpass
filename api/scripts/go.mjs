import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// The backend uses Go's crypto/ABI implementation; it needs no native C toolchain.
const child = spawn("go", process.argv.slice(2), {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  env: { ...process.env, CGO_ENABLED: "0" },
  stdio: "inherit",
});
child.on("error", () => {
  console.error("Unable to run Go");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
