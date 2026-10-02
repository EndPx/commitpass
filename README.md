# CommitPass

**Commit to show up. Get rewarded when you do.**

An event platform on Monad where guests reserve a spot with a refundable deposit and share rewards from people who don't show up.

[Live documentation](https://sama-3.gitbook.io/commitpass-docs/documentation/) · [Documentation source](docs/gitbook/README.md) · [Documentation contents](docs/gitbook/SUMMARY.md)

Participants reserve a place by depositing a fixed commitment into an event contract. Organizers record attendance. At settlement, attendees become eligible to claim their commitment, half of forfeited no-show deposits, and all recovered yield. The other half of no-show commitments goes to CommitPass. Valid zero-attendance settlement refunds all depositors; a host cancellation before start opens full refunds. See [settlement policy](contracts/SETTLEMENT.md). The legacy deployment retains its immutable pre-policy behavior; the current USDC deployment includes the updated policy.

## Status

CommitPass targets Monad testnet (10143) with Circle's native testnet USDC. The factory, USDC-backed MockYieldVault and signed simulation receiver are deployed. Envio and the Go API serve indexed event and profile data alongside Privy identity, owner-authorized check-ins and immutable attendance snapshots. A one-attendee journey completed through the live frontend and Privy, with CRE simulation broadcasting the start and settlement transactions and the attendee claiming their return. See [live execution evidence](cre/evidence/frontend-monad-broadcast-2026-10-01.json), [deployment evidence](contracts/DEPLOYMENT.md), [contract boundaries](contracts/README.md) and [CRE setup](cre/README.md). Deployed DON execution and organic yield are not claimed.

The interactive local application has completed create → reserve → start →
check-in → settlement → claim through Privy, Go/Neon, Envio and CRE CLI on Anvil.
See [the recorded local application flow](cre/evidence/interactive-local-2026-09-28.json).
Use `pnpm local:app` to run it with a local MockUSDC fixture. The public deployment uses Circle's native Monad testnet USDC; historical local evidence retains its original token and deployment identifiers.

The frontend is now hosted at [commitpass-kappa.vercel.app](https://commitpass-kappa.vercel.app).
The Go API, Envio indexer and recurring signed CRE simulation run on the Hostinger
VPS, with [HTTPS API](https://commitpass-api.endpx.cloud/health). Google sign-in
and the deployed account workspace were checked in the browser. The broadcast path uses a Monad-testnet-only simulation receiver with signed
lifecycle payloads; it does not claim deployed DON execution.

## Repository layout

```text
apps/
  web/                  Next.js 15 landing, Privy sign-in and event workspace
api/                    Go API; metadata, attendance, and snapshot endpoints
cre/                    Chainlink CRE start/settlement workflow
indexer/                Envio HyperIndex, schema and event handlers
contracts/              Event contracts, CRE receiver, scripts and inherited tests
packages/
  shared/               Public shared code and language-neutral project data
  typescript-config/    Common TypeScript compiler settings
```

`apps/web`, `api`, `cre`, and `indexer` may depend on `packages/*`. Shared packages must not import application code. Each workspace declares local package dependencies with `workspace:*`.

The API and shared Go package are connected through `go.work`. Project identity is defined once in `packages/shared/src/project.json`, imported by TypeScript and embedded by Go. Both health endpoints consume this source. See [shared package boundaries](packages/shared/README.md).

## Local development

### Current CRE execution choice

The hosted application uses recurring CRE CLI simulation with `--broadcast` on
the VPS and the signed Monad testnet receiver. DON deployment is deferred.
For a separate disposable local fixture, start the lifecycle runner from the
repository root:

```sh
pnpm cre:local
```

This runs the real CRE CLI/WASM against a disposable Anvil chain and the local
attendance fixture. It requires CLI login, not deployment access. See
[local setup](cre/local/README.md) and [recorded evidence](cre/evidence/README.md).
For the interactive frontend + Privy + Go/Neon + Envio + CRE environment, use
`pnpm local:app`. See [interactive local setup](cre/local/INTERACTIVE.md).
The normal application commands target public Monad testnet with event creation
enabled through the signed simulation receiver. The two Anvil fixture commands
do not configure or submit transactions to that public receiver.

### Application development

Requirements: Node.js 22 or 24 (CI uses `.node-version`), pnpm 10.21.0, and Go 1.25 or newer. Foundry is needed when working on Solidity. Bun 1.3.8+ is also needed for CRE WASM compilation.

```sh
pnpm install --frozen-lockfile
git submodule update --init --recursive
pnpm dev
```

- Web liveness: `http://localhost:3000/health`
- API liveness: `http://localhost:8080/health`
- These endpoints prove the processes and shared imports work. They do not check a database or chain connection.
- Landing page: `http://localhost:3000/`. Includes an animated event-poster hero,
  interactive RSVP walkthrough, host section, and FAQ. The preview does not submit
  bookings or payments. Privy sign-in is at `/signin`, with event pages at
  `/events`, `/discover`, `/events/[vault]`, `/events/[vault]/manage` and `/events/new`. Event creation is
  enabled for the configured signed simulation receiver; local drafts also work. See
  [web setup and execution boundaries](apps/web/README.md).

| Command                | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `pnpm dev`             | Run web, API, and the shared TypeScript watcher  |
| `pnpm dev:web`         | Build shared dependencies and run Next.js        |
| `pnpm dev:api`         | Build shared dependencies and run the Go API     |
| `pnpm build`           | Build shared TypeScript, Next.js, and the Go API |
| `pnpm typecheck`       | Run TypeScript checks and Go vet                 |
| `pnpm format`          | Format repository files and Go source            |
| `pnpm check`           | Check formatting, types, Go vet, and builds      |
| `pnpm contracts:build` | Run Foundry separately; requires `forge`         |

Use `pnpm contracts:test` to run the inherited Foundry tests. Indexer codegen and TypeScript compilation participate in builds; indexing starts explicitly after deployment configuration. CRE participates in TypeScript builds; run `pnpm --filter @commitpass/cre compile:wasm` for its executable artifact. CI checks the active JS/Go code and runs a separate Solidity build/test job. The inherited mock vault tests do not verify real Morpho integration.

## Event lifecycle

1. **Create:** an organizer configures an event, capacity, commitment amount, registration deadline, start time, check-in window, and settlement time.
2. **Commit:** participants deposit the event's supported stablecoin into its contract through a Privy embedded wallet.
3. **Start:** an authorized organizer request or the scheduled start time makes a Chainlink CRE action eligible. The contract closes registration and deposits pooled funds into the configured ERC-4626 vault, currently a mock on testnet.
4. **Check in:** the organizer verifies attendance through the application. The Go backend records check-ins in Neon PostgreSQL.
5. **Settle:** an authorized organizer request or the scheduled settlement time triggers CRE. The workflow retrieves a finalized attendance snapshot and submits it to the contract, which withdraws vault assets and calculates claims.
6. **Claim:** eligible participants claim their return through Privy. Envio indexes confirmed contract events so the application reflects deposits, lifecycle transitions, settlements, and claims.

The contract must enforce timing, authorization, and one-time execution. Scheduled timestamps establish eligibility; active CRE workflows submit the transactions.

## Trust and accounting

- **Attendance:** the organizer attests who attended. QR check-in is not independent proof of physical presence.
- **Funds:** event contracts manage commitments and enforce distributions. The database does not determine whether an onchain payment succeeded.
- **Yield:** distributions use recovered assets and realized yield. Morpho withdrawal availability and potential losses must be handled explicitly; a settlement deadline is not a guarantee of immediate liquidity.
- **Data:** Envio owns indexed chain data. The backend owns metadata, profiles, check-ins, and immutable settlement snapshots in separate database schemas.

The current target uses Circle USDC (`0x534b2f3A21130d7a60830c2Df862319e593943A3`, 6 decimals) and a mock ERC-4626 vault on Monad testnet. Mainnet Clearstar is not part of this deployment configuration. Cancellation and zero-attendance policies are present in the current USDC contracts; their funded public execution still needs an end-to-end run. Permanent loss/liquidity recovery still needs an explicit policy.

## Stack

| Component              | Role                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| Monad and Solidity     | Event factory, event contracts, and financial settlement               |
| Next.js and TypeScript | Participant and organizer application                                  |
| Privy                  | Onboarding, embedded wallets, and transaction signing                  |
| Go                     | Metadata, organizer authorization, attendance, and snapshot APIs       |
| Envio HyperIndex       | Contract discovery and indexing of confirmed onchain activity          |
| Neon PostgreSQL        | Indexed data and application data                                      |
| Chainlink CRE          | Event start and settlement orchestration                               |
| ERC-4626 yield vault   | Mock testnet deposit/redeem lifecycle; real yield integration deferred |

## Implementation references

CommitPass adopts the event commitment mechanism from ATFI and uses ShowOrSow as the frontend reference:

- [ATFI contracts, commit `1c57d35`](https://github.com/ATFi-Event/smart-contract/tree/1c57d35b80bb67afc04ee3d9a26292721695aed5)
- [ATFI backend, commit `3413119`](https://github.com/ATFi-Event/backend/tree/3413119726c2fd3038253020f940378c192ae2b6)
- [ShowOrSow frontend, commit `8fbe3f0`](https://github.com/EndPx/ShowOrSow/tree/8fbe3f04a05eb19eca10710173057f65d9aadf84/web)

The implementation should retain their direct product flows while adapting account access, indexing, automation, and accounting to CommitPass.

## Metropolis integration targets

- [Best Use of Envio](https://hackathon.monad.xyz/tracks/best-use-of-envio)
- [Best workflow with CRE](https://hackathon.monad.xyz/tracks/best-workflow-with-cre)
- [Privy](https://hackathon.monad.xyz/tracks/privy)

Privy is the primary account and wallet integration. Mera is deferred until we have a useful role for it in the core attendance flow; alternate login methods and Agora bounty work are outside the current scope.

## Live frontend execution evidence

The current direct-vault model completed a one-attendee happy path on Monad testnet through the live frontend
and the authorized Privy wallet: create → approve 0.1 USDC → deposit → host start
request → CRE simulation broadcast start → host check-in → end request → CRE
simulation broadcast settlement → claim. The wallet's funded 1 USDC balance
returned to 1 USDC after claiming. Allocation and claimed amount were both
100,000 units; protocol revenue and realized yield were zero for this scenario.

[Structured receipts, frozen snapshot and final accounting](cre/evidence/frontend-direct-vault-2026-10-01.json)
record the scope. This confirms the single-attendee normal flow; it does not
claim a public DON, organic yield, or browser coverage of every no-show/refund
scenario. The VPS uses the isolated `envio_usdc_vault` indexer namespace;
previous namespaces are preserved. Operational `deploy/` and root `scripts/`
folders remain local; module-owned tooling is committed for reproducible builds.
