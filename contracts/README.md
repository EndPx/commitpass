# Contracts

Foundry workspace for the CommitPass factory and event vaults. `src/`, `script/`, and `test/` are prepared; no contracts have been ported, compiled, tested, or deployed yet.

With Foundry installed:

```sh
# From the repository root
pnpm contracts:build
```

This task is separate from the JS/Go bootstrap build. Add contract build and financial regression checks to CI when contract implementation begins.

Follow the direct structure of the pinned ATFI reference. Preserve explicit lifecycle checks, actual asset accounting, and claim authorization. Generate downstream ABIs from compiled artifacts once source contracts exist.
