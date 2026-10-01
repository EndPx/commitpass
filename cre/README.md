# CommitPass CRE lifecycle

Target: **Monad testnet (10143)**. SDK 1.22.0. Execution currently uses the authenticated CRE CLI with `--broadcast` on the VPS, not a deployed DON workflow.

## Flow

1. `factory.createEvent(stakeAmount, registrationDeadline, eventDate, maxParticipant, settleAt)` creates a registered vault with immutable lifecycle authorization.
2. The organizer calls `vault.requestStart()`, or its scheduled start becomes due. CRE reads finalized state. Organizer requests close registration immediately.
3. CRE delivers its report through the forwarder to **that vault's `onReport`**. The vault validates it and deposits the pooled USDC into its configured ERC-4626 yield vault.
4. The organizer calls `vault.requestSettlement()`, or its settlement deadline becomes due. The earliest authoritative cutoff is used to freeze attendance through the Go API.
5. CRE validates the immutable attendance snapshot with identical consensus, then delivers a settlement report to the vault. The vault redeems its shares, allocates claims and transfers platform revenue.
6. Participants claim through `vault.claimReward()`. Envio indexes confirmed events for event pages and user profiles.

Only the original organizer can request lifecycle changes. Financial execution is only through authorized reports. Factory `LifecycleRequested` logs feed a finalized EVM log trigger; a one-minute cron sweeps two vaults per invocation. With N vaults, a complete sweep takes approximately ceil(N/2) minutes plus finality and execution latency.

## Receiver security

`contracts/src/cre/ReceiverTemplate.sol` is an abstract consumer base inherited by each vault. It is not an additional deployment. It adapts Chainlink's receiver pattern with immutable authorization.

Standard DON execution checks the production forwarder and the actual workflow ID in 64-byte metadata. CLI broadcast mode uses the official Monad MockForwarder plus a payload signature bound to chain 10143 and the destination vault. The public mock alone is not sufficient authorization. No DON workflow identity is fabricated.

Standard CRE can deliver reports without a confidential wallet inside the workflow. Confidential Workflows become relevant when computation over private data or keys must be protected from operators; direct EVM writes alone do not require them.

## Source layout and official examples

The source follows Chainlink's [Keeper Bot](https://github.com/smartcontractkit/cre-templates/tree/main/starter-templates/keeper-bot/keeper-bot-ts/my-workflow) and [Event Reactor](https://github.com/smartcontractkit/cre-templates/tree/main/starter-templates/event-reactor/event-reactor-ts/my-workflow) structure:

- `commitpass/main.ts`: Runner entry point.
- `commitpass/workflow.ts`: cron/log registration and the shared read → decide → write lifecycle.
- `commitpass/config.ts`: required factory, schedule, API and gas configuration with runtime validation.
- `commitpass/attendance.ts`: authenticated HTTP, identical consensus, snapshot domain and digest validation.
- `commitpass/simulation.ts`: signing only for the explicit CLI broadcast target.
- `contracts/evm/ts/generated/`: CLI-generated bindings for the few ABI members this workflow consumes. Regenerate with `pnpm --filter @commitpass/cre bindings` after shared ABI changes.

Finalized reads, finalized request logs, replay protection, vault-bound simulation signatures and successful receipt/hash checks remain required. The educational templates' zero-hash fallback is deliberately not used.

`commitpass/health-check.ts` is a separate receiver-free entry point selected only by the `local-simulation` target. Its config contains the API URL and explicit local mode; it requires no factory, gas limit or secret. Production configuration has no health-check mode and rejects unknown fields.

## Commands

```sh
# Repository root
pnpm --filter @commitpass/shared build
pnpm --filter @commitpass/cre bindings
pnpm --filter @commitpass/cre typecheck
pnpm --filter @commitpass/cre compile:wasm

# CRE project root; receiver-free real HTTP health check, no writes
cd cre
cre workflow simulate commitpass --target local-simulation --non-interactive --trigger-index 0

# Full local Anvil lifecycle from repository root
pnpm cre:local
```

The receiver-free target fetches public API health using the native HTTP capability. It does not prove settlement. If passing `--wasm` manually, use `dist/health-check.wasm` for this target and `dist/commitpass.wasm` for lifecycle targets. The Anvil runner exercises the financial lifecycle using an explicitly local forwarder fixture and real vault bytecode.

## Monad testnet configuration

Copy `commitpass/config.testnet.example.json` to its ignored runtime config. Set the current **factory**, HTTPS attendance API and gas limit. The zero example factory deliberately fails validation. Secret files contain references; CLI/systemd consume their environment values without committing credentials.

The active manifest and code hash must match the direct vault contract model before the testnet wrapper broadcasts. Run the configured wrapper explicitly:

```sh
# No broadcast; wrapper refuses nonempty registries to avoid snapshot mutations.
node scripts/simulate-testnet.mjs
# Authorized testnet writes; not DON activation.
node scripts/simulate-testnet.mjs --broadcast
```

The VPS timer invokes the second command. For a finalized organizer log, select trigger 1 with `--evm-tx-hash` and `--evm-event-index`. For a future DON migration, obtain deployment access and the real workflow identity, then deploy a factory using the production forwarder and that identity. Existing vault permissions cannot be silently switched.

After contract changes run `forge build`, then `pnpm contracts:abi` from the repository root. ABI exports come from compiler artifacts.

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

## Boundaries

Public execution is signed CLI broadcast simulation, not DON execution. Circle USDC is the actual Monad testnet asset; the ERC-4626 yield source remains a mock. Attendance remains organizer-attested. Local financial tests and public browser receipts are recorded separately under `evidence/`.
