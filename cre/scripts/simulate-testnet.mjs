import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, isAddress } from "viem";

const root = new URL("../", import.meta.url);
const cwd = fileURLToPath(root);
const wasm = fileURLToPath(new URL("dist/lifecycle.wasm", root));
const config = JSON.parse(
  readFileSync(new URL("lifecycle/config.testnet.json", root), "utf8"),
);
const deployment = JSON.parse(
  readFileSync(
    new URL("../packages/shared/src/deployments/monad-testnet.json", root),
    "utf8",
  ),
);

if (!existsSync(wasm)) throw new Error("Compile the CRE workflow first");
if (
  !isAddress(config.receiver) ||
  config.receiver.toLowerCase() !==
    deployment.contracts.CommitPassAutomation.address.toLowerCase()
)
  throw new Error("Simulation receiver must match the Monad testnet manifest");

const rpc = createPublicClient({
  transport: http("https://testnet-rpc.monad.xyz"),
});
if ((await rpc.getChainId()) !== 10143)
  throw new Error("RPC is not Monad testnet");
const code = await rpc.getBytecode({ address: config.receiver });
if (!code || code === "0x")
  throw new Error("Receiver has no code on Monad testnet");

const vaultCount = await rpc.readContract({
  address: config.receiver,
  abi: [
    {
      type: "function",
      name: "vaultCount",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint256" }],
    },
  ],
  functionName: "vaultCount",
});
if (vaultCount !== 0n)
  throw new Error(
    "Public receiver has events. Use an explicit manual simulation after reviewing possible attendance snapshot writes.",
  );

console.log("Monad testnet 10143 confirmed; receiver has no events.");
console.log("Running one cron simulation without --broadcast.");
const result = spawnSync(
  process.platform === "win32" ? "cre.exe" : "cre",
  [
    "workflow",
    "simulate",
    "lifecycle",
    "--target",
    "testnet-settings",
    "--trigger-index",
    "0",
    "--wasm",
    wasm,
    "--non-interactive",
  ],
  { cwd, stdio: "inherit", windowsHide: true },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
