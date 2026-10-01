# CommitPass Envio indexer

## Envio Cloud deployment

Deploy this indexer in the **EndPx** organization, using repository `EndPx/commitpass`, branch `main`, root directory `indexer` and configuration `config.hosted.yaml`.

The Cloud package is self-contained: runtime imports, schema and ABI snapshots live inside `indexer/`. Shared contract ABIs remain canonical in `packages/shared/abi`; `node packages/shared/tools/export-indexer.mjs` exports the Cloud copies, public deployment manifest and concrete hosted configuration. `pnpm contracts:abi` invokes that exporter after contract compilation.

The hosted configuration indexes the active Monad testnet factory from its deployment block. It contains no database credentials, wallet key or attendance secret. Envio Cloud owns the indexer storage and exposes a GraphQL endpoint. The Go API selects that endpoint through `ENVIO_GRAPHQL_URL`; application check-ins and immutable attendance snapshots remain in Neon. Local Anvil runs continue to use their isolated SQL namespaces.

Set the project-owned Cloud flag `ENVIO_MANAGED_HOSTING=1` in the Envio Cloud environment. The launcher then accepts the platform-owned database only when Cloud starts it with `--config ./config.hosted.yaml`. It rejects local mode and manual database migration commands in this path. Self-hosted starts retain the dedicated Neon database/schema guards.

Use `envio-cloud deployment endpoint` to obtain the real deployed endpoint; do not construct or guess its URL. A connected repository and successful build are not indexing proof: check sync status and query actual event, participant and claim records before switching the Go API.

The Development tier is intended for hackathon/demo use and has platform retention and usage limits. No paid plan is required for the initial public deployment.

For the interactive local app, use `pnpm local:app` from the root. It supplies the
Anvil addresses/RPC and a new `envio_local_<runId>` schema without resetting the
public `envio` schema. The Go reader selects the matching namespace. Run public
codegen again before returning to the normal testnet indexer command.

HyperIndex **3.12.1**, targeting **Monad testnet (10143)**. This service discovers event vaults from the factory and materializes their chain state in Neon. The Go API consumes those tables for event pages, capacity, participant eligibility, rewards and transaction history.

## Data model

| Entity            | Purpose                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `CommitmentEvent` | Event metadata, lifecycle, capacity, commitments, attendance count, yield and claim aggregates |
| `Participant`     | Depositing wallet, deposited amount, settled attendance and paid claims                        |
| `ChainActivity`   | Contract address, block hash, transaction hash and log index for each action                   |

`VaultCreated` dynamically registers event vaults. Receiver events record schedules and requests; vault events establish actual start and settlement. A request does not mark an event settled. Reward estimates use the contract's integer formula; payments use `RewardClaimed` amounts.

All writes use HyperIndex entity operations and participate in reorg rollback. Handlers account for v3's preload pass. `AttendanceMarked` represents attendance accepted during settlement, not live application check-in. Share transfers do not transfer participant claim rights. New contract logs distinguish `CANCELLED`, `REFUNDED` (zero attendance) and `SETTLED`. `ClaimAllocated` stores each participant’s exact raw-token entitlement, including remainder units; `RewardClaimed` proves payout. Envio materializes confirmed logs, while host buttons and check-in rows never set financial status. Existing public testnet contracts do not emit the new events.

## Neon

Project: `withered-snow-61403908` (CommitPass). Branch: `br-restless-firefly-b398t5lv` (production). The blockchain target remains testnet despite the branch name.

- Dedicated database: `commitpass_indexer`; schema: `envio`.
- Application data can remain in `neondb`. Check-ins and frozen snapshots are not implemented here.
- Direct Neon connection with TLS certificate verification. Hasura is disabled; Go reads Postgres.
- Credentials are stored in git-ignored `indexer/.env` and `api/.env`.

The database and HyperIndex schema have been initialized for the deployed testnet contracts. The launcher reads addresses and the start block from `packages/shared/src/deployments/monad-testnet.json`, with environment overrides supported. No event has been created yet, so application entity tables remain empty.

## Commands

```sh
# Repository root
pnpm install --frozen-lockfile
pnpm --filter @commitpass/shared build
pnpm indexer:codegen
pnpm --filter @commitpass/indexer typecheck
# After configuring actual deployment addresses and block:
pnpm indexer:start
```

On Windows, the wrapper uses Ubuntu WSL because this Envio release has no Windows native package. Install Node.js 24 inside WSL. On the current machine, a verified Node 24.18.0 runtime is also available under the WSL user's `.cache/commitpass-node`; the wrapper uses it if Node is absent from PATH. Linux/macOS uses the current Node process. pnpm includes Linux optional dependencies for WSL.

Copy `.env.example` on another machine and supply credentials. To override the shared deployment, configure:

```dotenv
ENVIO_FACTORY_ADDRESS=<deployed CommitPassFactory>
ENVIO_START_BLOCK=<earliest deployment block>
```

Start refuses missing/zero addresses and an unset deployment block. The wrapper supplies deployment defaults for codegen and runtime. HyperIndex uses RPC ingestion, so no HyperSync API token is required. Public-RPC queries are capped at 99 blocks to respect Monad testnet's 100-block range limit. The five-block lag and reorg rollback are not a cryptographic finality guarantee.

`pnpm --filter @commitpass/indexer db:setup` runs `db-migrate up` against the dedicated database. It does not invoke the CLI's destructive `setup` or `down` commands. Review migration/reindex requirements before changing configuration on populated databases. The pre-deployment placeholder schema was restarted only after confirming all three application entities contained zero rows. Subsequent runs resume existing progress with `pnpm indexer:start`.

## Shared contracts and API

Config reads compiled ABIs from `packages/shared/abi`. After changing Solidity, compile contracts, run `pnpm contracts:abi`, then regenerate Envio types. The exporter also updates CRE's shared ABI.

Go exposes `/v1/events`, `/v1/events/{vault}`, `/v1/events/{vault}/participants`, and `/v1/events/{vault}/activity`. Lists return up to 100 records and a `nextCursor`; pass it as `?after=`. Onchain integers use decimal strings. Missing connection/schema returns 503.

## Remaining bounty evidence

The [Envio bounty](https://hackathon.monad.xyz/tracks/best-use-of-envio) requires live onchain data driving a useful feature. Source, codegen and empty tables do not establish that. Deploy CommitPass, configure its real addresses, start indexing, and show the API/UI reflecting actual deposits, settlement and claims with transaction references.

References: [AI migration guide](https://docs.envio.dev/docs/HyperIndex/migrate-with-ai), [handlers](https://docs.envio.dev/docs/HyperIndex/event-handlers), [dynamic discovery](https://docs.envio.dev/docs/HyperIndex/dynamic-contracts), [Postgres configuration](https://docs.envio.dev/docs/HyperIndex/environment-variables).
