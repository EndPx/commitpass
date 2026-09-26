# Contracts

Naming-only port of [ATFI at `1c57d35b80bb67afc04ee3d9a26292721695aed5`](https://github.com/ATFi-Event/smart-contract/tree/1c57d35b80bb67afc04ee3d9a26292721695aed5). The original logic, function signatures, events, constants, and configuration addresses are preserved.

| Original           | CommitPass               |
| ------------------ | ------------------------ |
| `FactoryATFi`      | `CommitPassFactory`      |
| `VaultATFi`        | `CommitPassVault`        |
| `ATFi Vault Share` | `CommitPass Vault Share` |
| `ATFi-VS`          | `CommitPass-VS`          |

Deployment scripts, tests, their identifiers, and imports follow the renamed contracts. The original author attribution is retained. Interfaces in `src/interfaces/` are unchanged.

## Setup

```sh
git submodule update --init --recursive
```

Dependencies use the exact commits recorded by ATFI:

- forge-std: `8bbcf6e3f8f62f419e5429a0bd89331c85c37824`
- OpenZeppelin: `c64a1edb67b6e3f4a15cca8909c9482ad33a02b0`

With Foundry installed:

```sh
# From the repository root
pnpm contracts:build
pnpm contracts:test
```

Alternatively, run `forge build` and `forge test` from `contracts/`. Windows users with Foundry installed only in WSL should run these commands inside WSL.

Compilation uses the monorepo's pinned Solidity 0.8.28 compiler, `via_ir` as in the original project, and explicit import remappings. CI runs the contract build and inherited tests separately from the JS/Go checks.

## Current boundaries

- Base Sepolia USDC, Morpho market parameters, treasury, and deployment-script addresses remain exactly as supplied by ATFI. Monad deployment configuration has not been introduced.
- Existing timing checks, yield accounting, fees, zero-attendee behavior, and claim logic are unchanged.
- The inherited vault suite uses `TestCommitPassVault`, a separate test implementation with simulated yield. It does not establish live Morpho integration or full coverage of `CommitPassVault`.
- No deployment is performed by build or test commands. Historical ATFI broadcast files are not copied as CommitPass deployment evidence.

The root README describes the planned CommitPass product. Its scheduled lifecycle, CRE receiver, and other integration work are subsequent changes, not part of this naming-only port.
