import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  getAddress,
  http,
  keccak256,
  parseEther,
  toEventSelector,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { snapshotParameters } from "@commitpass/shared";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const rpc = "http://127.0.0.1:8547";
const api = "http://127.0.0.1:8091";
const windows = process.platform === "win32";
const local = new URL("../.local/", import.meta.url);
mkdirSync(local, { recursive: true });
const toWSL = (path) =>
  path
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
    .replaceAll("\\", "/");
const client = createPublicClient({
  chain: monadTestnet,
  transport: http(rpc),
  pollingInterval: 100,
});
// Ephemeral local signers; the user's Foundry keystore is never read by this runner.
const relayerKey = generatePrivateKey();
const organizer = privateKeyToAccount(relayerKey);
const treasury = privateKeyToAccount(generatePrivateKey());
const guests = [
  privateKeyToAccount(generatePrivateKey()),
  privateKeyToAccount(generatePrivateKey()),
];
const token = keccak256(toHex(generatePrivateKey()));
const cliEnv = {
  ...process.env,
  CRE_ETH_PRIVATE_KEY: relayerKey,
  ATTENDANCE_API_TOKEN_ALL: token,
};
const wallets = [organizer, ...guests].map((account) =>
  createWalletClient({ account, chain: monadTestnet, transport: http(rpc) }),
);
const [owner, guestA, guestB] = wallets;
const mockForwarder = "0xB9F79d863261869B234c481D1f9A7af84AeAd192";
const snapshots = new Map();
const evidence = {
  environment: "local Anvil only; not Monad testnet or a DON deployment",
  chainId: 10143,
  rpc,
  steps: [],
};
let unavailable = false;
let snapshotReads = 0;
let anvil;
let server;

async function command(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd, env: process.env, ...options });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
      process.stdout.write(data);
    });
    child.stderr.on("data", (data) => {
      output += data;
      process.stderr.write(data);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

function compiled(source, name) {
  return JSON.parse(
    readFileSync(
      new URL(`../../contracts/out/${source}/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
}

async function receipt(hash) {
  const result = await client.waitForTransactionReceipt({
    hash,
    timeout: 60_000,
  });
  assert.equal(result.status, "success", `Transaction reverted: ${hash}`);
  return result;
}
async function deploy(contract, args = []) {
  const result = await receipt(
    await owner.deployContract({
      abi: contract.abi,
      bytecode: contract.bytecode.object,
      args,
    }),
  );
  return getAddress(result.contractAddress);
}
async function write(wallet, contract, address, functionName, args = []) {
  return receipt(
    await wallet.writeContract({
      address,
      abi: contract.abi,
      functionName,
      args,
    }),
  );
}
const read = (contract, address, functionName, args = []) =>
  client.readContract({ address, abi: contract.abi, functionName, args });
async function mine() {
  await client.request({ method: "anvil_mine", params: ["0x4", "0x0"] });
}

async function simulate(name, request, expectedSuccess = true) {
  await mine();
  const args = [
    "workflow",
    "simulate",
    fileURLToPath(new URL("../commitpass", import.meta.url)),
    "--project-root",
    fileURLToPath(local),
    "--target",
    "local-settings",
    "--env",
    fileURLToPath(new URL("empty.env", local)),
    "--wasm",
    fileURLToPath(new URL("../dist/commitpass.wasm", import.meta.url)),
    "--non-interactive",
    "--trigger-index",
    request ? "1" : "0",
    "--broadcast",
  ];
  if (request)
    args.push(
      "--evm-tx-hash",
      request.transactionHash,
      "--evm-event-index",
      String(
        request.logs.findIndex(
          (log) =>
            log.topics[0] ===
            toEventSelector("LifecycleRequested(address,uint8)"),
        ),
      ),
    );
  console.log(`\n=== ${name} ===`);
  const result = await command(windows ? "cre.exe" : "cre", args, {
    env: cliEnv,
  });
  writeFileSync(new URL(`${name}.log`, local), result.output);
  if (expectedSuccess)
    assert.equal(result.code, 0, `${name} CRE simulation failed`);
  else {
    assert.notEqual(result.code, 0, `${name} unexpectedly succeeded`);
    assert.match(result.output, /Attendance API status 503/);
  }
  evidence.steps.push({ name, exitCode: result.code, expectedSuccess });
}

async function main() {
  // A failed rerun must not leave an earlier success result as its apparent output.
  writeFileSync(
    new URL("result.json", local),
    JSON.stringify({ status: "running", ...evidence }, null, 2),
  );
  // Fail instead of altering any pre-existing local chain.
  try {
    await client.getChainId();
    throw new Error(
      "Port 8547 already has a chain; stop it or use a free port",
    );
  } catch (error) {
    if (error.message.startsWith("Port 8547")) throw error;
  }
  const build = windows
    ? await command("wsl", [
        "-d",
        "Ubuntu",
        "--cd",
        toWSL(fileURLToPath(new URL("../../contracts", import.meta.url))),
        "--",
        "bash",
        "-lc",
        '"$HOME/.foundry/bin/forge" build --silent',
      ])
    : await command("forge", ["build", "--root", "../contracts", "--silent"]);
  assert.equal(build.code, 0, "Contract build failed");
  rmSync(new URL("anvil.pid", local), { force: true });
  writeFileSync(
    new URL("start-anvil.sh", local),
    '#!/usr/bin/env bash\nset -e\necho $$ > .local/anvil.pid\nexec "$HOME/.foundry/bin/anvil" --host 127.0.0.1 --port 8547 --chain-id 10143 --slots-in-an-epoch 1 --block-time 1 --mixed-mining --silent\n',
  );
  anvil = windows
    ? spawn(
        "wsl",
        [
          "-d",
          "Ubuntu",
          "--cd",
          toWSL(cwd),
          "--",
          "bash",
          ".local/start-anvil.sh",
        ],
        { cwd, stdio: "ignore" },
      )
    : spawn("bash", [".local/start-anvil.sh"], { cwd, stdio: "ignore" });
  for (let i = 0; ; i++) {
    try {
      await client.getChainId();
      break;
    } catch {
      if (i === 60) throw new Error("Anvil did not start");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert.equal(await client.getChainId(), 10143);
  assert.match(
    await client.request({ method: "web3_clientVersion" }),
    /anvil/i,
  );
  for (const wallet of wallets)
    await client.request({
      method: "anvil_setBalance",
      params: [wallet.account.address, toHex(parseEther("100"))],
    });

  const assetContract = compiled("MockYieldVault.sol", "MockUSDC");
  const yieldContract = compiled("MockYieldVault.sol", "MockYieldVault");
  const factoryContract = compiled(
    "CommitPassFactory.sol",
    "CommitPassFactory",
  );
  const receiverContract = compiled(
    "CommitPassAutomation.sol",
    "CommitPassAutomation",
  );
  const vaultContract = compiled("CommitPassVault.sol", "CommitPassVault");
  const forwarderContract = compiled(
    "LocalCREForwarder.sol",
    "LocalCREForwarder",
  );
  const fixture = await deploy(forwarderContract, [organizer.address]);
  await client.request({
    method: "anvil_setCode",
    params: [mockForwarder, await client.getBytecode({ address: fixture })],
  });
  const asset = await deploy(assetContract);
  const yieldVault = await deploy(yieldContract, [asset]);
  const factory = await deploy(factoryContract, [yieldVault, treasury.address]);
  const receiver = await deploy(receiverContract, [mockForwarder, factory]);
  const workflowId = await read(
    forwarderContract,
    mockForwarder,
    "WORKFLOW_ID",
  );
  await write(owner, receiverContract, receiver, "configureWorkflow", [
    workflowId,
  ]);
  for (const wallet of wallets)
    await write(wallet, assetContract, asset, "faucet");
  evidence.contracts = { asset, yieldVault, factory, receiver, mockForwarder };
  writeFileSync(
    new URL("config.json", local),
    JSON.stringify(
      {
        receiver,
        attendanceApi: api,
        attendanceSecretId: "ATTENDANCE_API_TOKEN",
        gasLimit: "5000000",
      },
      null,
      2,
    ),
  );
  // This generated project has only a loopback RPC, independent of the public testnet target.
  writeFileSync(
    new URL("project.yaml", local),
    `local-settings:\n  rpcs:\n    - chain-name: monad-testnet\n      url: ${rpc}\n`,
  );
  writeFileSync(new URL("empty.env", local), "");
  server = createServer((request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end();
      return;
    }
    if (unavailable) {
      response.writeHead(503).end();
      return;
    }
    const snapshot = snapshots.get(request.url);
    if (!snapshot) {
      response.writeHead(404).end();
      return;
    }
    snapshotReads++;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(snapshot);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(8091, "127.0.0.1", resolve);
  });

  async function createEvent(scheduled) {
    const now = (await client.getBlock()).timestamp;
    const deadline = now + (scheduled ? 30n : 600n);
    const startAt = deadline + 10n;
    const settleAt = startAt + (scheduled ? 10n : 600n);
    const id = await read(factoryContract, factory, "eventIdCounter");
    await write(owner, factoryContract, factory, "createAutomatedEvent", [
      10_000_000n,
      deadline,
      startAt,
      2n,
      receiver,
      settleAt,
    ]);
    const vault = await read(factoryContract, factory, "vaultByEventId", [id]);
    for (const wallet of [guestA, guestB]) {
      await write(wallet, assetContract, asset, "approve", [
        vault,
        10_000_000n,
      ]);
      await write(wallet, vaultContract, vault, "deposit");
    }
    return { id, vault, startAt, settleAt };
  }
  async function freeze(event, attendees) {
    const [, , cutoff] = await read(receiverContract, receiver, "getState", [
      event.vault,
    ]);
    const sorted = [...attendees]
      .map((value) => getAddress(value))
      .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    const hash = keccak256(
      encodeAbiParameters(snapshotParameters, [
        10143n,
        event.vault,
        event.id,
        cutoff,
        sorted,
      ]),
    );
    const snapshot = {
      version: 1,
      chainId: "10143",
      vault: event.vault,
      eventId: String(event.id),
      cutoff: String(cutoff),
      frozen: true,
      attendees: sorted,
      snapshotHash: hash,
    };
    snapshots.set(
      `/v1/attendance-snapshots/10143/${event.vault}/${event.id}/${cutoff}`,
      JSON.stringify(snapshot),
    );
    return snapshot;
  }

  const manual = await createEvent(false);
  const start = await write(owner, receiverContract, receiver, "requestStart", [
    manual.vault,
  ]);
  await simulate("manual-start", start);
  assert.equal(
    await read(vaultContract, manual.vault, "depositedToYield"),
    true,
  );
  const supplied = await read(
    vaultContract,
    manual.vault,
    "totalDepositedToYield",
  );
  await simulate("manual-start-retry", start);
  assert.equal(
    await read(vaultContract, manual.vault, "totalDepositedToYield"),
    supplied,
  );
  await write(owner, assetContract, asset, "transfer", [
    yieldVault,
    2_000_000n,
  ]);
  const end = await write(
    owner,
    receiverContract,
    receiver,
    "requestSettlement",
    [manual.vault],
  );
  const frozen = await freeze(manual, [guestA.account.address]);
  unavailable = true;
  await simulate("attendance-unavailable", end, false);
  assert.equal(await read(vaultContract, manual.vault, "eventSettled"), false);
  unavailable = false;
  await simulate("manual-settlement", end);
  assert.equal(await read(vaultContract, manual.vault, "eventSettled"), true);
  const reward = await read(vaultContract, manual.vault, "getUserReward", [
    guestA.account.address,
  ]);
  // Mock ERC-4626 share conversion rounds the 2-token donation down by one raw unit.
  assert.equal(reward, 16_999_999n);
  assert.equal(
    await read(assetContract, asset, "balanceOf", [treasury.address]),
    5_000_000n,
  );
  const beforeClaim = await read(assetContract, asset, "balanceOf", [
    guestA.account.address,
  ]);
  const claimReceipt = await write(
    guestA,
    vaultContract,
    manual.vault,
    "claimReward",
  );
  assert.equal(
    await read(assetContract, asset, "balanceOf", [guestA.account.address]),
    beforeClaim + reward,
  );
  await simulate("settlement-retry", end);
  assert.equal(
    await read(vaultContract, manual.vault, "getUserReward", [
      guestA.account.address,
    ]),
    reward,
  );
  evidence.manual = {
    vault: manual.vault,
    snapshotHash: frozen.snapshotHash,
    claimedRaw: String(reward),
    claimTransactionHash: claimReceipt.transactionHash,
  };

  const scheduled = await createEvent(true);
  await client.request({
    method: "evm_setNextBlockTimestamp",
    params: [Number(scheduled.startAt)],
  });
  await mine();
  await simulate("scheduled-start");
  assert.equal(
    await read(vaultContract, scheduled.vault, "depositedToYield"),
    true,
  );
  const timestamp = (await client.getBlock()).timestamp;
  if (timestamp < scheduled.settleAt)
    await client.request({
      method: "evm_setNextBlockTimestamp",
      params: [Number(scheduled.settleAt)],
    });
  await mine();
  await freeze(scheduled, [guestA.account.address, guestB.account.address]);
  await simulate("scheduled-settlement");
  assert.equal(
    await read(vaultContract, scheduled.vault, "eventSettled"),
    true,
  );
  assert.equal(
    await read(vaultContract, scheduled.vault, "getUserReward", [
      guestA.account.address,
    ]),
    10_000_000n,
  );
  evidence.scheduled = { vault: scheduled.vault, settled: true };

  const empty = await createEvent(false);
  const emptyStart = await write(
    owner,
    receiverContract,
    receiver,
    "requestStart",
    [empty.vault],
  );
  await simulate("zero-attendance-start", emptyStart);
  const emptyEnd = await write(
    owner,
    receiverContract,
    receiver,
    "requestSettlement",
    [empty.vault],
  );
  const emptySnapshot = await freeze(empty, []);
  await simulate("zero-attendance-settlement", emptyEnd);
  assert.equal(await read(vaultContract, empty.vault, "settlementOutcome"), 2);
  assert.equal(await read(vaultContract, empty.vault, "protocolRevenue"), 0n);
  assert.equal(
    await read(vaultContract, empty.vault, "getUserReward", [
      guestA.account.address,
    ]),
    10_000_000n,
  );
  assert.equal(
    await read(vaultContract, empty.vault, "getUserReward", [
      guestB.account.address,
    ]),
    10_000_000n,
  );
  evidence.zeroAttendance = {
    vault: empty.vault,
    snapshotHash: emptySnapshot.snapshotHash,
    allocatedRaw: String(
      await read(vaultContract, empty.vault, "totalAllocated"),
    ),
    protocolRevenueRaw: "0",
  };

  const cancelled = await createEvent(false);
  const cancelReceipt = await write(
    owner,
    vaultContract,
    cancelled.vault,
    "cancelEvent",
  );
  assert.equal(
    await read(vaultContract, cancelled.vault, "settlementOutcome"),
    3,
  );
  assert.equal(
    await read(vaultContract, cancelled.vault, "protocolRevenue"),
    0n,
  );
  assert.equal(
    await read(vaultContract, cancelled.vault, "getUserReward", [
      guestA.account.address,
    ]),
    10_000_000n,
  );
  assert.equal(
    await read(vaultContract, cancelled.vault, "getUserReward", [
      guestB.account.address,
    ]),
    10_000_000n,
  );
  await write(guestA, vaultContract, cancelled.vault, "claimReward");
  await write(guestB, vaultContract, cancelled.vault, "claimReward");
  assert.equal(
    await read(vaultContract, cancelled.vault, "totalClaimed"),
    20_000_000n,
  );
  evidence.cancelled = {
    vault: cancelled.vault,
    transactionHash: cancelReceipt.transactionHash,
    claimedRaw: "20000000",
    protocolRevenueRaw: "0",
  };
  evidence.snapshotReads = snapshotReads;
  evidence.completedAt = new Date().toISOString();
  evidence.status = "passed";
  writeFileSync(
    new URL("result.json", local),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    "\nLocal CRE lifecycle completed. Evidence: cre/.local/result.json",
  );
}

try {
  await main();
} catch (error) {
  writeFileSync(
    new URL("result.json", local),
    JSON.stringify(
      { ...evidence, status: "failed", error: error.message },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (anvil && existsSync(new URL("anvil.pid", local))) {
    const pid = Number(
      readFileSync(new URL("anvil.pid", local), "utf8").trim(),
    );
    if (Number.isInteger(pid) && pid > 1) {
      if (windows)
        execFileSync("wsl", [
          "-d",
          "Ubuntu",
          "--exec",
          "python3",
          "-c",
          'import os,signal,sys; p="/proc/"+sys.argv[1]; active=os.path.exists(p); assert not active or (os.readlink(p+"/cwd")==sys.argv[2] and os.path.basename(os.readlink(p+"/exe"))=="anvil"); active and os.kill(int(sys.argv[1]),signal.SIGTERM)',
          String(pid),
          toWSL(cwd).replace(/\/$/, ""),
        ]);
      else process.kill(pid, "SIGTERM");
    }
  }
}
