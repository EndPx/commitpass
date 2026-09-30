# Local CRE lifecycle

For a persistent environment operated through the web app, use `pnpm local:app`
and follow [INTERACTIVE.md](INTERACTIVE.md). This page describes the separate,
disposable scripted runner.

Run the real CRE CLI and WASM workflow against a disposable Anvil chain and an authenticated loopback attendance server:

```sh
# Repository root
pnpm cre:local
```

Prerequisites: pnpm dependencies, Bun, a logged-in CRE CLI, and Foundry. Windows uses Ubuntu WSL with Foundry in its standard home directory. Ports **8547** and **8091** must be free. The command builds the shared package, WASM and Solidity, runs the scenarios, then stops its Anvil and HTTP processes.

## What runs

1. Deploy the actual factory, event vault implementation, receiver and mock ERC-4626 assets to a fresh local chain.
2. Create an event and deposit 10 mock USDC from each of two ephemeral participants.
3. Execute CRE's EVM-log trigger for an organizer start request; assert funds entered the yield vault.
4. Repeat the request; assert no second deposit occurred.
5. Donate 2 mock USDC to model yield. Freeze attendance with one attendee.
6. Return HTTP 503 from the attendance server; require CRE to fail for that reason and the event to remain unsettled.
7. Restore the same frozen snapshot; execute settlement through CRE and assert the attendee can claim **16.999999 mock USDC** (10 principal + 5 from no-shows + 1.999999 realized surplus after ERC-4626 rounding; treasury receives 5).
8. Repeat settlement; assert the claim allocation is unchanged.
9. Create a second event and execute scheduled start and settlement through the cron trigger, with both guests attending.

Each CRE invocation uses a generated project configuration containing only `http://127.0.0.1:8547`. Transactions use freshly generated, in-memory local keys funded through Anvil. The user's Foundry keystore, Neon database and public deployment are not used. Chain ID 10143 is reused solely to exercise the Monad selector and report domain against local RPC; these are **not public Monad transactions**.

## Forwarder fixture

`contracts/test/fixtures/LocalCREForwarder.sol` implements the simulator-facing `report` and transmission-status ABI. The runner installs its code at the simulator's Monad forwarder address using `anvil_setCode` after confirming it is connected to Anvil.

The fixture accepts only the ephemeral local relayer. It substitutes a fixed **local fixture workflow ID** into the 64-byte metadata passed to the unmodified receiver. This allows execution of the receiver's forwarder, workflow-ID, expiry, chain, schedule and snapshot checks while using CLI reports. It does not validate DON signatures or prove real workflow identity. Never deploy this fixture on a public network or use its identity to configure the public receiver.

The ABI/header layout follows Chainlink's [MockKeystoneForwarder](https://github.com/smartcontractkit/chainlink-evm/blob/develop/contracts/cre/src/dev/MockKeystoneForwarder.sol) and [IRouter](https://github.com/smartcontractkit/chainlink-evm/blob/develop/contracts/cre/src/v1/interfaces/IRouter.sol).

## Evidence and limits

Generated logs, config and `result.json` are in git-ignored `cre/.local/`. The result records a fresh running/failed/passed status, each CLI exit code, local contract addresses, the attendance hash and claim transaction. Anvil state is disposable; those transaction hashes are not explorer links.

The HTTP server serves one immutable JSON string per snapshot key. It is a fixture, not the Go/Neon check-in implementation. A deployed DON, public testnet execution, production authorization, durable snapshot creation and real yield-vault liquidity require separate evidence.

Local execution exposed and fixed two workflow runtime issues: Zod's URL validator depends on a global URL constructor unavailable in this WASM runtime, and `writeReport` expects a hex receiver address rather than base64.
