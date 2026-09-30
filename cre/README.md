# CommitPass CRE lifecycle

Target: **Monad testnet (10143)**. SDK 1.22.0. Shared receiver ABI and wire formats live in `@commitpass/shared`.

**Current execution choice:** CRE CLI simulation with explicit `--broadcast`
on Monad testnet, run by the VPS service. DON deployment remains deferred.
The simulation receiver uses the official Monad MockForwarder and requires a
receiver/chain-bound EIP-712 signature on every payload from an immutable operator
signer. The public mock forwarder alone is not financial authorization. No DON
workflow ID is fabricated; `isConfigured()` describes receiver readiness.
The production `CommitPassAutomation` keeps its forwarder/workflow validation.

## Flow

1. Create an event through `factory.createAutomatedEvent(stakeAmount, registrationDeadline, eventDate, maxParticipant, receiver, settleAt)`. Creation and automation registration happen atomically, before any deposit can occur. Start time is `eventDate`.
2. Organizer calls `receiver.requestStart(vault)`, or start time passes. The manual request closes registration immediately. CRE reads finalized contract state and submits a signed report through KeystoneForwarder.
3. The receiver validates the report and calls `depositToYieldSource()`, depositing assets into the configured ERC-4626 vault.
4. Organizer calls `receiver.requestSettlement(vault)`, or settlement time passes. The earliest cutoff is authoritative. The backend freezes attendance for that cutoff.
5. CRE fetches that snapshot through authenticated HTTP with identical consensus. It validates the event domain, attendee ordering and digest, then submits a settlement report. The receiver checks deposited membership and calls `settleEvent(attendees)`.
6. The event vault redeems all yield shares and allocates claims. Both transaction status and receiver execution must succeed. Envio should index confirmed lifecycle, settlement and claim events.

The log trigger reacts to finalized organizer requests. Cron runs every minute, rotating across two events per invocation, including newly registered events. A stable registry of N events takes approximately `ceil(N/2)` minutes to sweep, plus finality and execution latency. This is a bounded demo design; increase throughput or partition the registry for a larger service.

## Build

For the local start/settle/claim simulation, run `pnpm --filter @commitpass/cre local` from the repository root. See [the local runner](local/README.md) for its fixture boundary and assertions. It requires CLI authentication but no DON deployment access.

Install Bun 1.3.8+, CRE CLI 1.30+ and root pnpm dependencies.

```sh
# Repository root
pnpm --filter @commitpass/shared build
pnpm --filter @commitpass/cre typecheck
pnpm --filter @commitpass/cre compile:wasm
```

Ordinary monorepo builds typecheck CRE. Explicit WASM compilation produces `cre/dist/commitpass.wasm` through Javy. A build is not workflow execution evidence.

## Monad testnet simulation

The VPS cron runs `node scripts/simulate-testnet.mjs --broadcast` with a prebuilt
WASM, the public Monad testnet RPC, reachable HTTPS attendance API and private
signing credentials in its environment. It processes organizer requests and
scheduled events using the same callback logic. A deployment access grant is not
required for CLI simulation; the authenticated CLI is required.

For a read-only check, `pnpm --filter @commitpass/cre simulate` omits broadcast
and retains the empty-registry guard to avoid freezing attendance by accident.
An empty-registry sweep proves only trigger/read execution. Financial writes
require successful onchain receipts and receiver execution, recorded separately.

After receiver signature changes, run `forge build` in `contracts`, then `node packages/shared/tools/export-automation-abi.mjs` from the root and format its output. The ABI comes from the Solidity compiler artifact.

## Configuration and activation

1. Prepare testnet assets, factory and receiver using `contracts/script/DeployTestnet.s.sol`. It requires chain 10143, an explicit treasury and the trusted Monad testnet **deployed-workflow KeystoneForwarder**. Verify that forwarder in the official directory for the selected CRE environment.
2. Copy `commitpass/config.testnet.example.json` to `commitpass/config.testnet.json`. Set the receiver address, reachable HTTPS attendance API and gas limit. The zero receiver deliberately fails validation.
3. Copy `secrets.example.yaml` to `secrets.yaml`. Supply `ATTENDANCE_API_TOKEN_ALL` through the environment for simulation. Deployed workflows use the Vault DON secrets mechanism.
4. Register/deploy the workflow with this receiver address. Record its resulting workflow ID. The receiver deployer calls `configureWorkflow(workflowId)` exactly once, then activates the workflow. Events cannot attach automation before configuration. An update changing the workflow ID requires a new receiver; there is no permission bypass for existing events.
5. Use `createAutomatedEvent` and find its vault via `factory.vaultByEventId(id)`. The legacy two-step `createEvent` plus `setAutomation` path can be interrupted by a deposit and should not be used by the application.

From `cre`, after configuration and working CLI authentication:

```sh
# No broadcast flag; trigger 0 is cron.
cre workflow simulate commitpass --target testnet-settings --trigger-index 0 --non-interactive
# Trigger 1 consumes a finalized organizer request log.
cre workflow simulate commitpass --target testnet-settings --trigger-index 1 --evm-tx-hash <request-tx> --evm-event-index <log-index> --non-interactive
```

The receiver validates its forwarder and workflow ID in **64-byte production KeystoneForwarder metadata**. Simulation reports do not establish deployed DON identity. The local runner uses an explicit Anvil-only forwarder fixture with a local workflow ID while leaving the receiver unchanged. A local simulation is separate evidence from a deployed DON write.

## Attendance API contract

The Go/Neon service implements idempotent snapshot freezing. CRE uses POST to create or retrieve the frozen snapshot; GET reads an existing snapshot without creating it:

```text
POST /v1/attendance-snapshots/{chainId}/{vault}/{eventId}/{cutoff}
Authorization: Bearer <CRE secret>
```

Exact JSON shape: `AttendanceSnapshot` in `packages/shared/src/automation.ts`. Numeric fields are canonical decimal strings; `version` is the number 1 and `frozen` must be true. `attendees` contains 0-500 deposited wallet addresses, sorted numerically and without duplicates.

```text
snapshotHash = keccak256(abi.encode(
  uint256 chainId, address vault, uint256 eventId,
  uint256 cutoff, address[] attendees
))
```

Backend requirements:

- Authenticate the caller and confirm the onchain event and cutoff.
- Freeze once transactionally under a unique `(chainId, vault, eventId, cutoff)` key. Return the same data forever; do not recompute from mutable check-in rows on GET.
- Exclude check-ins after cutoff. A 200 response means a complete immutable snapshot; unavailable or incomplete data returns non-200.
- Do not add timestamps or transient fields to the response.

Failed HTTP requests, malformed data, unknown fields, digest mismatch and consensus disagreement defer settlement. They never mean nobody attended. A successfully frozen, validated empty snapshot is an explicit zero-attendance refund. The receiver cannot independently prove physical presence or DB immutability; those remain organizer/backend responsibilities.

## Current boundaries

- The factory, signed simulation receiver and mock yield vault are deployed on Monad testnet; see `contracts/DEPLOYMENT.md`. A single-attendee Privy-authorized frontend journey completed creation, commitment, check-in, CRE broadcast start/settlement and claim; see [the recorded receipts and accounting](evidence/frontend-monad-broadcast-2026-10-01.json). Hosted simulation config points at the HTTPS Go API. DON deployment and browser coverage of cancellation, zero attendance and the no-show split remain unverified.
- Testnet uses Circle USDC on Monad (`0x534b2f3A21130d7a60830c2Df862319e593943A3`, 6 decimals) and a mock yield vault. It has no mainnet Clearstar connection or organic yield; token donations can model yield.
- A valid empty attendance snapshot refunds all commitments plus recovered surplus without a platform fee. Owner cancellation before start opens principal refunds directly onchain. Redemption failure or principal shortfall reverts atomically, leaving settlement pending.
- Claim allocations include deterministic remainder distribution in registration order. Platform revenue is 50% of no-show principal only when attendance is nonzero; no yield fee applies.
- Privy authentication does not change participant identity: claims belong to the depositing wallet.

References: [receiver contracts](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts), [EVM writes](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/overview-ts), [secrets](https://docs.chain.link/cre/guides/workflow/secrets/using-secrets-simulation-ts).

## Signed testnet broadcast

`pnpm --filter @commitpass/cre simulate:broadcast` runs the cron handler with
`--broadcast`. The preflight confirms chain 10143, the deployed receiver bytecode,
MockForwarder, signing account and testnet MON balance. Signing credentials live
in the VPS environment, never in workflow config or Git. Without `--broadcast`,
the original empty-registry/read guard remains in place.

The simulation report wraps the existing lifecycle payload as `(bytes payload,
bytes signature)`. Its EIP-712 domain is `CommitPass CRE simulation`, version `1`,
chain 10143 and the deployed simulation receiver. The signed type is
`SimulationReport(bytes payload)`. Existing lifecycle, cutoff, membership, expiry,
snapshot and one-time accounting checks execute after signature validation.

The user's [EcoRound CRE workflow](https://github.com/eco-round/cre/tree/771eb69dbc8d092975104421bb21ca6c276ff5a6)
informs `GenerateReport`/`WriteReport` plus `simulate --broadcast`. That reference
uses a Tenderly Base fork. CommitPass targets the public Monad testnet RPC.
See Chainlink's [simulation consumer requirements](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts#4-working-with-simulation)
and [CLI broadcast option](https://docs.chain.link/cre/reference/cli/workflow).

## Scaffold provenance

The official project was generated with CRE CLI 1.34.0:

```sh
cre init --project-name cre --workflow-name lifecycle --template hello-world-ts --deployment-registry private --rpc-url monad-testnet=https://testnet-rpc.monad.xyz --non-interactive
```

The generated project/workflow layout is adopted here, with the existing financial
workflow retained. Generated Sepolia sample RPCs were replaced with Monad testnet;
the private registry field is configuration only, with no workflow deployment.

The generated workflow directory was subsequently renamed from `lifecycle/` to
`commitpass/`. Workflow names now use `commitpass-testnet`, `commitpass-local` and
`commitpass-interactive`; the repository project root stays `cre/`. For a fresh
standalone project with both names set to CommitPass, use:

```sh
cre init --project-name commitpass --workflow-name commitpass --template hello-world-ts --deployment-registry private --rpc-url monad-testnet=https://testnet-rpc.monad.xyz --non-interactive
```
