import { spawnSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) loadEnvFile(fileURLToPath(envFile));
const deployment = JSON.parse(
  readFileSync(
    new URL(
      "../../packages/shared/src/deployments/monad-testnet.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
process.env.ENVIO_FACTORY_ADDRESS ||=
  deployment.contracts.CommitPassFactory.address;
process.env.ENVIO_START_BLOCK ||= String(deployment.startBlock);
const args = process.argv.slice(2);
if (args[0] === "start") {
  for (const key of ["ENVIO_FACTORY_ADDRESS"]) {
    if (
      !/^0x[0-9a-fA-F]{40}$/.test(process.env[key] ?? "") ||
      /^0x0{40}$/.test(process.env[key])
    ) {
      throw new Error(
        `${key} must identify the deployed Monad testnet contract`,
      );
    }
  }
  if (!/^[1-9][0-9]*$/.test(process.env.ENVIO_START_BLOCK ?? "")) {
    throw new Error(
      "Set ENVIO_START_BLOCK to the earliest deployment block before indexing",
    );
  }
}
if (args[0] === "start" || args.includes("db-migrate")) {
  const localSchema =
    process.env.COMMITPASS_LOCAL === "1" &&
    /^envio_local_[a-z0-9]{12,32}$/.test(process.env.ENVIO_PG_SCHEMA ?? "") &&
    process.env.ENVIO_RPC_URL === "http://127.0.0.1:8547";
  const hostedSchema =
    process.env.COMMITPASS_LOCAL !== "1" &&
    [
      "envio_hosted",
      "envio_usdc",
      "envio_usdc_simulation",
      "envio_usdc_vault",
    ].includes(process.env.ENVIO_PG_SCHEMA);
  if (
    process.env.ENVIO_PG_DATABASE !== "commitpass_indexer" ||
    (process.env.ENVIO_PG_SCHEMA !== "envio" &&
      !localSchema &&
      !hostedSchema) ||
    (process.env.COMMITPASS_LOCAL === "1" && !localSchema)
  ) {
    throw new Error(
      "Use the dedicated commitpass_indexer database and envio schema",
    );
  }
  if (
    ["envio_usdc", "envio_usdc_simulation", "envio_usdc_vault"].includes(
      process.env.ENVIO_PG_SCHEMA,
    ) &&
    (process.env.ENVIO_FACTORY_ADDRESS?.toLowerCase() !==
      deployment.contracts.CommitPassFactory.address.toLowerCase() ||
      deployment.contracts.USDC?.address.toLowerCase() !==
        "0x534b2f3a21130d7a60830c2df862319e593943a3")
  ) {
    throw new Error(
      "USDC indexing must use the current Monad USDC factory manifest",
    );
  }
}
const windows = process.platform === "win32";
// WSL does not inherit arbitrary Windows variables unless explicitly listed.
if (windows) {
  process.env.WSLENV = [
    process.env.WSLENV,
    ...Object.keys(process.env).filter((key) => key.startsWith("ENVIO_")),
  ]
    .filter(Boolean)
    .join(":");
}
const result = windows
  ? spawnSync(
      "wsl",
      [
        "-d",
        "Ubuntu",
        "--cd",
        cwd
          .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
          .replaceAll("\\", "/"),
        "--",
        "bash",
        "./scripts/envio.sh",
        ...args,
      ],
      { cwd, stdio: "inherit" },
    )
  : spawnSync(process.execPath, ["node_modules/envio/bin.mjs", ...args], {
      cwd,
      stdio: "inherit",
    });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
