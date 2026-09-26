import { spawnSync } from "node:child_process";

const result = spawnSync("gofmt", ["-l", "apps/api", "packages/shared"], {
  encoding: "utf8",
});

if (result.error || result.status !== 0) {
  console.error(result.error?.message || result.stderr);
  process.exit(1);
}

if (result.stdout.trim()) {
  console.error("Run pnpm format to format these Go files:\n" + result.stdout);
  process.exit(1);
}
