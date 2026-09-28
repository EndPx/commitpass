# Shared data and code

`@commitpass/shared` is the shared TypeScript package for web, indexer, and CRE code. Go consumers import `github.com/EndPx/commitpass/packages/shared` through the root Go workspace.

The first shared source is `src/project.json`: TypeScript imports it and Go embeds the same file. The web and API health endpoints consume it, so changing the project name or description has one source of truth.

```ts
import { project } from "@commitpass/shared";
```

```go
import "github.com/EndPx/commitpass/packages/shared"

project, err := shared.Project()
```

## Boundaries

Compiled contract ABIs live in `abi/` and are consumed by Envio. `src/automation.ts` defines the CRE wire formats. Run `pnpm contracts:abi` after compiling Solidity to refresh the canonical ABI files.

`src/network.ts` exports minimal Monad testnet chain metadata for frontend wallet
providers, reusing the chain ID from `src/automation.ts`. It has no runtime SDK
dependency, so web consumers do not need to import unrelated chain definitions.

`src/events.ts` defines web/API event wire types. `src/event-abi.ts` contains typed
ABI subsets generated from the compiled ABI snapshots in `abi/`; regenerate with
`node scripts/export-web-abi.mjs` and format the generated file before committing.

- Keep browser-safe constants, pure types, and public contract data here. Secrets, database clients, and signing keys belong in the relevant service.
- Consumers declare `workspace:*`; do not import another app's source through relative paths.
- Go cannot import TypeScript types. Use language-neutral files or an explicit API schema when cross-language contracts are introduced.
- Publish ABIs from compiled Solidity artifacts when the contracts exist. Do not maintain handwritten duplicate ABIs in each app.
- Add shared code when a real consumer needs it; event lifecycle rules and financial calculations remain contract responsibilities.

Run `pnpm --filter @commitpass/shared build` before running an individual TypeScript consumer outside Turbo. Root `pnpm dev` watches this package alongside the active services.
