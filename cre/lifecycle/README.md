# CommitPass lifecycle workflow

This workflow folder follows the official `cre init --template hello-world-ts`
project/workflow layout. It retains CommitPass's cron and finalized EVM-log
callbacks, immutable attendance snapshot checks and signed Monad testnet reports.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @commitpass/cre compile:wasm
pnpm --filter @commitpass/cre simulate:broadcast
```

From `cre/`, with authenticated CRE CLI and signing environment configured:

```sh
cre workflow simulate lifecycle --target testnet-settings --trigger-index 0 --broadcast --non-interactive
```

`project.yaml` contains the public Monad testnet RPC. `workflow.yaml` selects the
entry point, config and secret mappings. `package.json` declares this workflow's
dependencies; `tsconfig.json` inherits repository compiler settings. Live config
and signing secrets remain outside Git. See [CRE operations and report format](../README.md).
