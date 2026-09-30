import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, isAddress, keccak256, parseAbi } from "viem";

const broadcast = process.argv.includes("--broadcast");
const root = new URL("../", import.meta.url);
const cwd = fileURLToPath(root);
const wasm = fileURLToPath(new URL("dist/commitpass.wasm", root));
const config = JSON.parse(
  readFileSync(new URL("commitpass/config.testnet.json", root), "utf8"),
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
if (!broadcast && vaultCount !== 0n)
  throw new Error(
    "Public receiver has events. Use an explicit manual simulation after reviewing possible attendance snapshot writes.",
  );

if (broadcast) {
  if (
    deployment.execution?.mode !== "cre-cli-simulation-broadcast" ||
    !config.simulationSigningSecretId
  )
    throw new Error(
      "Broadcast requires the signed simulation deployment/config",
    );
  if (
    keccak256(code).toLowerCase() !==
    deployment.contracts.CommitPassAutomation.runtimeCodeHash.toLowerCase()
  )
    throw new Error("Receiver bytecode differs from the deployment manifest");
  const { privateKeyToAccount } = await import("viem/accounts");
  const key = process.env.CRE_ETH_PRIVATE_KEY;
  if (
    !key ||
    !/^0x[0-9a-fA-F]{64}$/.test(key) ||
    process.env.SIMULATION_SIGNING_KEY_ALL !== key
  )
    throw new Error(
      "Broadcast/signing credentials are unavailable or inconsistent",
    );
  const sender = privateKeyToAccount(key).address;
  const [signer, forwarder] = await Promise.all([
    rpc.readContract({
      address: config.receiver,
      abi: parseAbi([
        "function simulationReportSigner() view returns (address)",
      ]),
      functionName: "simulationReportSigner",
    }),
    rpc.readContract({
      address: config.receiver,
      abi: parseAbi(["function forwarder() view returns (address)"]),
      functionName: "forwarder",
    }),
  ]);
  if (
    signer.toLowerCase() !== sender.toLowerCase() ||
    forwarder.toLowerCase() !== "0xb9f79d863261869b234c481d1f9a7af84aead192"
  )
    throw new Error("Simulation signer/forwarder mismatch");
  const block = await rpc.getBlock();
  const requiredGasBalance =
    BigInt(config.gasLimit) * ((block.baseFeePerGas ?? 0n) * 2n + 1n);
  if ((await rpc.getBalance({ address: sender })) < requiredGasBalance)
    throw new Error(
      "Simulation sender needs enough testnet MON for the configured gas ceiling",
    );
}
console.log(`Monad testnet 10143 confirmed; ${vaultCount} registered events.`);
console.log(
  broadcast
    ? "Running signed CRE CLI simulation with --broadcast."
    : "Running one cron simulation without --broadcast.",
);
const result = spawnSync(
  process.platform === "win32" ? "cre.exe" : "cre",
  [
    "workflow",
    "simulate",
    "commitpass",
    "--target",
    "testnet-settings",
    "--trigger-index",
    "0",
    "--wasm",
    wasm,
    "--non-interactive",
    ...(broadcast ? ["--broadcast"] : []),
  ],
  { cwd, stdio: "inherit", windowsHide: true },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
