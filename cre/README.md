# CommitPass CRE lifecycle

Target: **Monad testnet (10143)**. SDK 1.22.0. Shared receiver ABI and wire formats live in `@commitpass/shared`.

**Current execution choice:** local CRE simulation. DON deployment and its access
process are deferred. Use `pnpm cre:local` at the repository root. The Anvil runner
is described in [local/README.md](local/README.md); public activation instructions
below are retained for a later deployment and are not required for the local run.

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

Ordinary monorepo builds typecheck CRE. Explicit WASM compilation produces `cre/dist/lifecycle.wasm` through Javy. A build is not workflow execution evidence.

After receiver signature changes, run `forge build` in `contracts`, then `node scripts/export-automation-abi.mjs` from the root and format its output. The ABI comes from the Solidity compiler artifact.

## Configuration and activation

1. Prepare testnet assets, factory and receiver using `contracts/script/DeployTestnet.s.sol`. It requires chain 10143, an explicit treasury and the trusted Monad testnet **deployed-workflow KeystoneForwarder**. Verify that forwarder in the official directory for the selected CRE environment.
2. Copy `lifecycle/config.testnet.example.json` to `lifecycle/config.testnet.json`. Set the receiver address, reachable HTTPS attendance API and gas limit. The zero receiver deliberately fails validation.
3. Copy `secrets.example.yaml` to `secrets.yaml`. Supply `ATTENDANCE_API_TOKEN_ALL` through the environment for simulation. Deployed workflows use the Vault DON secrets mechanism.
4. Register/deploy the workflow with this receiver address. Record its resulting workflow ID. The receiver deployer calls `configureWorkflow(workflowId)` exactly once, then activates the workflow. Events cannot attach automation before configuration. An update changing the workflow ID requires a new receiver; there is no permission bypass for existing events.
5. Use `createAutomatedEvent` and find its vault via `factory.vaultByEventId(id)`. The legacy two-step `createEvent` plus `setAutomation` path can be interrupted by a deposit and should not be used by the application.

From `cre`, after configuration and working CLI authentication:

```sh
# No broadcast flag; trigger 0 is cron.
cre workflow simulate lifecycle --target testnet-settings --trigger-index 0 --non-interactive
# Trigger 1 consumes a finalized organizer request log.
cre workflow simulate lifecycle --target testnet-settings --trigger-index 1 --evm-tx-hash <request-tx> --evm-event-index <log-index> --non-interactive
```

The receiver validates its forwarder and workflow ID in **64-byte production KeystoneForwarder metadata**. Simulation reports do not establish deployed DON identity. The local runner uses an explicit Anvil-only forwarder fixture with a local workflow ID while leaving the receiver unchanged. A local simulation is separate evidence from a deployed DON write.

## Attendance API contract

The Go/Neon service implements idempotent snapshot freezing. CRE uses POST to create or retrieve the frozen snapshot; GET reads an existing snapshot without creating it:

```text
POST /v1/attendance-snapshots/{chainId}/{vault}/{eventId}/{cutoff}
Authorization: Bearer <CRE secret>
```

Exact JSON shape: `AttendanceSnapshot` in `packages/shared/src/automation.ts`. Numeric fields are canonical decimal strings; `version` is the number 1 and `frozen` must be true. `attendees` contains 1-500 deposited wallet addresses, sorted numerically and without duplicates.

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

Failed HTTP requests, malformed data, unknown fields, digest mismatch, empty attendance and consensus disagreement defer settlement. They never mean nobody attended. The receiver cannot independently prove physical presence or DB immutability; those remain organizer/backend responsibilities.

## Current boundaries

- The receiver and mock-asset contracts are deployed on Monad testnet; see `contracts/DEPLOYMENT.md`. No deployed DON execution or completed public event lifecycle is claimed. Local testnet config points at the Go API on loopback; deployed workflows require a reachable HTTPS endpoint. A real Privy-authorized check-in/snapshot run is still pending.
- Testnet uses mockAUSD and a mock yield vault. It has no mainnet Clearstar connection or organic yield; token donations can model yield.
- Empty attendance, cancellation and permanent loss/liquidity recovery need explicit policies. Automatic settlement rejects empty lists. Redemption failure or principal shortfall reverts atomically, leaving settlement pending.
- Equal-share rounding dust remains in the event vault under the inherited formula.
- Privy/Mera login choices do not change participant identity: claims belong to the depositing wallet.

References: [receiver contracts](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts), [EVM writes](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/overview-ts), [secrets](https://docs.chain.link/cre/guides/workflow/secrets/using-secrets-simulation-ts).
