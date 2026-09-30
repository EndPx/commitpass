import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cwd = fileURLToPath(new URL("../", import.meta.url));
const local = new URL("../.interactive/", import.meta.url);
const windows = process.platform === "win32";
const pnpm = process.env.npm_execpath;
if (!pnpm || !existsSync(pnpm))
  throw new Error("Run through pnpm local:app from the repository root.");
for (const path of ["api/.env", "indexer/.env"]) {
  const file = root + path;
  if (existsSync(file)) loadEnvFile(file);
}
mkdirSync(local, { recursive: true });
const rpc = "http://127.0.0.1:8547";
const runId = randomBytes(8).toString("hex");
const relayKey = generatePrivateKey();
const owner = privateKeyToAccount(relayKey);
const treasury = privateKeyToAccount(generatePrivateKey());
const controlToken = randomBytes(32).toString("hex");
const attendanceToken = randomBytes(32).toString("hex");
const client = createPublicClient({
  chain: monadTestnet,
  transport: http(rpc),
  pollingInterval: 250,
});
const wallet = createWalletClient({
  account: owner,
  chain: monadTestnet,
  transport: http(rpc),
});
const toWSL = (path) =>
  path
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
    .replaceAll("\\", "/");
const children = new Set();
let stopping = false;
let runningWorkflow = false;
let timer;
let control;
let status = "starting";
function child(program, args, options = {}) {
  const proc = spawn(program, args, {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    ...options,
  });
  children.add(proc);
  proc.once("exit", () => children.delete(proc));
  proc.stdout?.on("data", (data) => process.stdout.write(data));
  proc.stderr?.on("data", (data) => process.stderr.write(data));
  return proc;
}
async function command(program, args, options = {}) {
  const proc = child(program, args, options);
  return new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${program} exited with code ${code}`)),
    );
  });
}
const packageProgram = /\.exe$/i.test(pnpm) ? pnpm : process.execPath;
const packageArgs = (...args) =>
  /\.exe$/i.test(pnpm) ? args : [pnpm, ...args];
const packageCommand = (name, action, env) =>
  command(packageProgram, packageArgs("--filter", name, action), { env });
const compiled = (source, name) =>
  JSON.parse(
    readFileSync(
      new URL(`../../contracts/out/${source}/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
async function confirmed(hash) {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: 60000,
  });
  if (receipt.status !== "success")
    throw new Error("Local transaction reverted");
  return receipt;
}
async function deploy(artifact, args = []) {
  return (
    await confirmed(
      await wallet.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode.object,
        args,
      }),
    )
  ).contractAddress;
}
async function requireAnvil() {
  if (
    (await client.getChainId()) !== 10143 ||
    !/anvil/i.test(await client.request({ method: "web3_clientVersion" }))
  )
    throw new Error("Local runtime requires Anvil on loopback");
}
async function waitFor(url) {
  for (let n = 0; n < 120; n++) {
    if (stopping) throw new Error("Stopping");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Local service did not become ready: ${url}`);
}
function requireLocalTarget() {
  const project = readFileSync(
    new URL("../project.yaml", import.meta.url),
    "utf8",
  );
  const target =
    project.split(/^interactive-settings:\s*$/m)[1]?.split(/^\S/m)[0] ?? "";
  const urls = [...target.matchAll(/^\s+url:\s*(\S+)\s*$/gm)].map((match) =>
    match[1].replaceAll('"', "").replaceAll("'", ""),
  );
  if (urls.length !== 1 || urls[0] !== rpc)
    throw new Error(
      "The interactive CRE target must contain only the loopback Anvil RPC.",
    );
}
async function main() {
  requireLocalTarget();
  // Refuse occupied service ports; never stop an unrelated process.
  for (const port of [8547, 8080, 3000, 8092]) {
    const net = await import("node:net");
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", () =>
        reject(
          new Error(
            `Port ${port} is busy. Stop the existing local service first.`,
          ),
        ),
      );
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
  }
  await packageCommand("@commitpass/shared", "build");
  await packageCommand("@commitpass/cre", "compile:wasm");
  await command(
    windows ? "wsl" : "forge",
    windows
      ? [
          "-d",
          "Ubuntu",
          "--cd",
          toWSL(root + "contracts"),
          "--",
          "bash",
          "-lc",
          '"$HOME/.foundry/bin/forge" build --silent',
        ]
      : ["build", "--root", root + "contracts", "--silent"],
  );
  writeFileSync(
    new URL("start-anvil.sh", local),
    '#!/usr/bin/env bash\nset -e\necho $$ > .interactive/anvil.pid\nexec "$HOME/.foundry/bin/anvil" --host 127.0.0.1 --port 8547 --chain-id 10143 --slots-in-an-epoch 1 --block-time 1 --mixed-mining --silent\n',
  );
  child(
    windows ? "wsl" : "bash",
    windows
      ? [
          "-d",
          "Ubuntu",
          "--cd",
          toWSL(cwd),
          "--",
          "bash",
          ".interactive/start-anvil.sh",
        ]
      : [".interactive/start-anvil.sh"],
    { cwd, stdio: "ignore" },
  );
  for (let n = 0; ; n++) {
    try {
      await requireAnvil();
      break;
    } catch {
      if (n > 60) throw new Error("Anvil did not start");
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await client.request({
    method: "anvil_setBalance",
    params: [owner.address, toHex(parseEther("100"))],
  });
  const assetAbi = compiled("MockYieldVault.sol", "MockUSDC");
  const forwarderAbi = compiled("LocalCREForwarder.sol", "LocalCREForwarder");
  const factoryAbi = compiled("CommitPassFactory.sol", "CommitPassFactory");
  const vaultAbi = compiled("CommitPassVault.sol", "CommitPassVault");
  const forwarder = "0xB9F79d863261869B234c481D1f9A7af84AeAd192";
  const fixture = await deploy(forwarderAbi, [owner.address]);
  await client.request({
    method: "anvil_setCode",
    params: [forwarder, await client.getBytecode({ address: fixture })],
  });
  const asset = await deploy(assetAbi);
  const yieldVault = await deploy(
    compiled("MockYieldVault.sol", "MockYieldVault"),
    [asset],
  );
  const workflowId = await client.readContract({
    address: forwarder,
    abi: forwarderAbi.abi,
    functionName: "WORKFLOW_ID",
  });
  const factory = await deploy(factoryAbi, [
    yieldVault,
    treasury.address,
    forwarder,
    workflowId,
    "0x0000000000000000000000000000000000000000",
  ]);
  const manifest = {
    environment: "local-anvil",
    runId,
    chainId: 10143,
    startBlock: 1,
    contracts: {
      USDC: { address: asset },
      MockYieldVault: { address: yieldVault },
      CommitPassFactory: { address: factory },
    },
  };
  const manifestPath = fileURLToPath(new URL("deployment.json", local));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(
    new URL("project.yaml", local),
    `interactive-settings:\n  rpcs:\n    - chain-name: monad-testnet\n      url: ${rpc}\n`,
  );
  writeFileSync(
    new URL("config.json", local),
    JSON.stringify(
      {
        factory,
        attendanceApi: "http://127.0.0.1:8080",
        attendanceSecretId: "ATTENDANCE_API_TOKEN",
        gasLimit: "5000000",
      },
      null,
      2,
    ),
  );
  writeFileSync(new URL("empty.env", local), "");
  const env = {
    ...process.env,
    COMMITPASS_LOCAL: "1",
    COMMITPASS_LOCAL_RUN: runId,
    COMMITPASS_LOCAL_MANIFEST: manifestPath,
    MONAD_RPC_URL: rpc,
    ATTENDANCE_API_TOKEN: attendanceToken,
    ENVIO_FACTORY_ADDRESS: factory,
    ENVIO_START_BLOCK: "1",
    ENVIO_RPC_URL: rpc,
    ENVIO_PG_SCHEMA: `envio_local_${runId}`,
    ENVIO_LOCAL_PID_FILE: toWSL(fileURLToPath(new URL("indexer.pid", local))),
  };
  await packageCommand("@commitpass/api", "db:migrate", env);
  await packageCommand("@commitpass/indexer", "codegen", env);
  await packageCommand("@commitpass/indexer", "db:setup", env);
  child(
    packageProgram,
    packageArgs("--filter", "@commitpass/indexer", "start"),
    {
      env,
    },
  );
  child(packageProgram, packageArgs("--filter", "@commitpass/api", "dev"), {
    env,
  });
  await waitFor("http://127.0.0.1:8080/health");
  const funded = new Set();
  let queue = Promise.resolve();
  control = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ status, runId }));
      return;
    }
    if (
      req.method !== "POST" ||
      req.url !== "/fund" ||
      req.headers.authorization !== `Bearer ${controlToken}`
    ) {
      res.writeHead(403).end();
      return;
    }
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 256) throw new Error("Invalid request");
      }
      const { wallet: address } = JSON.parse(body);
      if (!/^0x[0-9a-fA-F]{40}$/.test(address))
        throw new Error("Invalid wallet");
      const work = queue.then(async () => {
        await requireAnvil();
        if (funded.has(address.toLowerCase())) return;
        await client.request({
          method: "anvil_setBalance",
          params: [address, toHex(parseEther("10"))],
        });
        await confirmed(
          await wallet.writeContract({
            address: asset,
            abi: assetAbi.abi,
            functionName: "faucet",
          }),
        );
        await confirmed(
          await wallet.writeContract({
            address: asset,
            abi: assetAbi.abi,
            functionName: "transfer",
            args: [address, 1000_000_000n],
          }),
        );
        funded.add(address.toLowerCase());
      });
      queue = work.catch(() => {});
      await work;
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ funded: true }));
    } catch {
      res
        .writeHead(503)
        .end(JSON.stringify({ error: "Local funding unavailable" }));
    }
  });
  await new Promise((resolve, reject) => {
    control.once("error", reject);
    control.listen(8092, "127.0.0.1", resolve);
  });
  child(
    packageProgram,
    packageArgs(
      "--filter",
      "@commitpass/web",
      "dev",
      "--hostname",
      "127.0.0.1",
    ),
    {
      env: {
        ...env,
        NEXT_PUBLIC_COMMITPASS_LOCAL_DEPLOYMENT: JSON.stringify(manifest),
        NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS: "1",
        COMMITPASS_API_URL: "http://127.0.0.1:8080",
        COMMITPASS_LOCAL_CONTROL_TOKEN: controlToken,
      },
    },
  );
  await waitFor("http://127.0.0.1:3000/health");
  status = "ready";
  console.log(
    `\nLocal CommitPass ready at http://localhost:3000 — run ${runId}. Sign in with Privy and use Get local test funds. Ctrl+C stops this run.\n`,
  );
  const cliEnv = {
    ...env,
    CRE_ETH_PRIVATE_KEY: relayKey,
    ATTENDANCE_API_TOKEN_ALL: attendanceToken,
  };
  async function tick() {
    if (stopping || runningWorkflow) return;
    try {
      requireLocalTarget();
      await requireAnvil();
      const vaults = await client.readContract({
        address: factory,
        abi: factoryAbi.abi,
        functionName: "getBatch",
        args: [BigInt(Math.floor(Date.now() / 60000))],
      });
      const states = await Promise.all(
        vaults.map((vault) =>
          client.readContract({
            address: vault,
            abi: vaultAbi.abi,
            functionName: "getState",
          }),
        ),
      );
      if (!states.some((state) => state[1] !== 0)) return;
      runningWorkflow = true;
      status = "running-workflow";
      await command(
        windows ? "cre.exe" : "cre",
        [
          "workflow",
          "simulate",
          fileURLToPath(new URL("../commitpass", import.meta.url)),
          "--project-root",
          fileURLToPath(local),
          "--target",
          "interactive-settings",
          "--env",
          fileURLToPath(new URL("empty.env", local)),
          "--wasm",
          fileURLToPath(new URL("../dist/commitpass.wasm", import.meta.url)),
          "--non-interactive",
          "--trigger-index",
          "0",
          "--broadcast",
        ],
        { cwd, env: cliEnv },
      );
      status = "ready";
    } catch {
      status = "workflow-pending";
      console.error(
        "Local workflow pending; it will retry. Check attendance and service availability.",
      );
    } finally {
      runningWorkflow = false;
    }
  }
  timer = setInterval(() => void tick(), 15000);
}
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  control?.close();
  for (const proc of [...children].reverse())
    if (proc.exitCode === null && proc.pid) {
      try {
        if (windows)
          execFileSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true,
          });
        else proc.kill("SIGTERM");
      } catch {}
    }
  if (windows)
    for (const [file, expectedCwd, exe] of [
      ["indexer.pid", root + "indexer", "node"],
      ["anvil.pid", cwd, "anvil"],
    ]) {
      const path = new URL(file, local);
      if (!existsSync(path)) continue;
      const pid = Number(readFileSync(path, "utf8").trim());
      if (!Number.isInteger(pid) || pid < 2) continue;
      try {
        execFileSync(
          "wsl",
          [
            "-d",
            "Ubuntu",
            "--exec",
            "python3",
            "-c",
            'import os,signal,sys; p="/proc/"+sys.argv[1]; active=os.path.exists(p); assert not active or (os.readlink(p+"/cwd")==sys.argv[2] and os.path.basename(os.readlink(p+"/exe"))==sys.argv[3]); active and os.kill(int(sys.argv[1]),signal.SIGTERM)',
            String(pid),
            toWSL(expectedCwd).replace(/\/$/, ""),
            exe,
          ],
          { stdio: "ignore", windowsHide: true },
        );
      } catch {}
    }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => void stop().then(() => process.exit(0)));
try {
  await main();
} catch (error) {
  console.error(error.message);
  await stop();
  process.exitCode = 1;
}
