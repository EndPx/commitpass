# Development guide

The repository contains the web app, Go API, Solidity contracts, CRE workflow, and Envio indexer. Each module owns its configuration and tooling. This guide separates process startup from configuring a connected product.

## Requirements

| Tool                      | Use                                                                       |
| ------------------------- | ------------------------------------------------------------------------- |
| Node.js 24                | `.node-version` pins the CI runtime; supported engine range is Node 22–24 |
| pnpm 10.21.0              | Workspace package manager, pinned in root `package.json`                  |
| Go 1.25+                  | API and shared Go module, resolved through root `go.work`                 |
| Foundry                   | Solidity compilation and disposable Anvil fixtures; CI pins Foundry 1.8.3 |
| Bun 1.3.8+ and CRE CLI    | CRE WASM compilation and simulation; CLI authentication required          |
| Linux/macOS or Ubuntu WSL | Envio local runtime; the wrapper uses WSL on Windows                      |

## Install

```sh
git clone --recurse-submodules https://github.com/EndPx/commitpass.git
cd commitpass
pnpm install --frozen-lockfile
```

For an existing clone without contract dependencies:

```sh
git submodule update --init --recursive
```

## Configure the connected services

Copy each module's example to its corresponding ignored runtime environment file. Use credentials for your own development services. The examples contain public identifiers and placeholders, not working server secrets.

| Module                              | Configuration                                                                  | Main responsibilities                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| [Web](../apps/web/README.md)        | [Web environment example](../apps/web/.env.example)                            | Privy public app ID, server-side API URL, and optional media service credentials                        |
| [API](../api/README.md)             | [API environment example](../api/.env.example)                                 | Privy verification, Neon application data, RPC, Envio Cloud GraphQL, CORS, and attendance service token |
| [Indexer](../indexer/README.md)     | [Indexer environment example](../indexer/.env.example)                         | Optional self-hosted indexer database; Cloud uses its platform-managed storage                          |
| [Contracts](../contracts/README.md) | [Contract environment example](../contracts/.env.example)                      | RPC and explicitly authorized deployment configuration                                                  |
| [CRE](../cre/README.md)             | [Testnet configuration example](../cre/commitpass/config.testnet.example.json) | Factory, schedule, attendance API, and gas settings; credentials supplied separately                    |

`DATABASE_URL` is for application records. `ENVIO_GRAPHQL_URL` selects hosted chain reads; a missing Cloud endpoint retains the explicitly configured self-hosted SQL mode. These are separate from participant wallet balances and onchain allocations.

Do not put server credentials into `NEXT_PUBLIC_*` variables. Creating environment files does not authorize deployment or broadcast. The CRE read-only testnet wrapper refuses nonempty registries because lifecycle simulation can freeze snapshots; follow its documented execution boundary.

## Start the application processes

```sh
pnpm dev
```

- Web: `http://localhost:3000`; sign-in at `/signin` and event discovery at `/discover`.
- API: `http://localhost:8080` by default.
- `/health` on either process establishes liveness and shared imports, not database connectivity, active automation, or financial execution.

`pnpm dev` does not provision Privy, Neon, Envio, Cloudinary, or a CRE runner. The root shared TypeScript watcher builds imports used by the app. See module READMEs for migrations and provider configuration.

## Choose the lifecycle environment

### Disposable local application

```sh
pnpm local:app
```

The [interactive launcher](../cre/local/INTERACTIVE.md) builds and deploys fresh contracts on loopback Anvil, creates isolated application/indexer schemas, and runs the real CRE CLI/WASM. It still uses configured online Privy/Neon services; it is not entirely offline. Ports 3000, 8080, 8092, and 8547 must be available. Confirm the Local mode banner before interacting.

### Isolated CRE fixture

```sh
pnpm cre:local
```

The [fixture guide](../cre/local/README.md) describes disposable Anvil lifecycle scenarios. Local injected surplus is synthetic. This command does not configure or activate public Monad automation.

### Public testnet MVP

The current app uses Circle native testnet USDC and the direct-vault deployment in the [canonical manifest](../packages/shared/src/deployments/monad-testnet.json). The server runs signed CRE CLI broadcast simulations. The deployed MockForwarder alone does not authorize arbitrary reports; the vault checks a chain- and destination-bound signature. Workflow DON deployment is a separate future step.

## Workspace commands

| Command                                      | Purpose                                                 |
| -------------------------------------------- | ------------------------------------------------------- |
| `pnpm dev:web`                               | Build shared dependencies and start Next.js             |
| `pnpm dev:api`                               | Build shared dependencies and start Go                  |
| `pnpm build`                                 | Build active TypeScript workspaces and Go API           |
| `pnpm typecheck`                             | TypeScript checking and Go vet                          |
| `pnpm format`                                | Prettier formatting and Go source formatting            |
| `pnpm check`                                 | Formatting, types, Go vet, and builds                   |
| `pnpm contracts:build`                       | Foundry compilation                                     |
| `pnpm contracts:abi`                         | Export canonical contract ABIs and downstream snapshots |
| `pnpm indexer:codegen`                       | Generate Envio types                                    |
| `pnpm --filter @commitpass/cre compile:wasm` | Compile the CRE lifecycle artifact                      |

The existing [CI workflow](../.github/workflows/ci.yml) checks the monorepo and runs a separate Solidity build/test job. Historical fixture results are evidence for their recorded revision and environment, not a guarantee for arbitrary new changes or a real Morpho deployment.

## Public source and private operations

Commit module-owned source, schemas, migrations, ABIs, public manifests, lockfiles, and deliberately curated public evidence. Credentials, dependency output, contract broadcasts, deployment operations, raw logs, video exports, and slide deliverables remain ignored. `/deliverables/`, `/deploy/`, and root `/scripts/` are local; reproducible tooling belongs in its owning module.

Canonical shared packages must not import applications. After changing Solidity, rebuild/export ABIs before regenerating CRE or Envio bindings. After changing schema or indexer configuration, review migration/reindex behavior before applying it to populated storage.

[Web](../apps/web/README.md) · [API](../api/README.md) · [Contracts](../contracts/README.md) · [CRE](../cre/README.md) · [Indexer](../indexer/README.md) · [Shared boundaries](../packages/shared/README.md)
