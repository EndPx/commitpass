---
description: Shared trigger logic, validated snapshots and real testnet broadcasts.
---

# Chainlink CRE

CRE orchestrates two actions: starting an event and settling it from a finalized attendance snapshot. The contracts decide whether the requested action is authorized and due.

## Two triggers, one processing path

| Trigger | Callback input                                | Use                                              |
| ------- | --------------------------------------------- | ------------------------------------------------ |
| Cron    | Recurring time slot                           | Discover registered events whose actions are due |
| EVM log | Finalized `LifecycleRequested(address,uint8)` | Process an organizer's lifecycle request         |

The cron expression is `0 * * * * *`, once per minute. The EVM log trigger uses finalized confidence. Both callbacks read current contract state before acting.

For bounded cron work, the receiver returns up to two registered vaults per time slot using round-robin discovery. As the event registry grows, an eligible event may wait for its slot; the current demo is not an instant-processing guarantee.

## Start

The workflow reads eligibility from the receiver and constructs a start report. The receiver validates the report and calls the vault to close registration and deposit pooled assets. Duplicate execution does not deposit again.

## Settle

The workflow requests a frozen attendance snapshot from the authenticated HTTPS API, validates its domain and digest, reads the event state and constructs a settlement report.

A failed attendance API or invalid snapshot defers settlement. An accepted empty snapshot explicitly invokes the zero-attendance policy. These are separate outcomes.

The write path checks both transaction success and receiver execution success before reporting completion.

## Current execution mode

The VPS runs **CRE CLI simulation with `--broadcast`**. This sends real Monad testnet transactions through the official MockForwarder to `CommitPassSimulationAutomation`.

The CLI selects and immediately executes a simulation trigger. The VPS timer provides the repeated invocation. A deployed Workflow DON would monitor trigger conditions continuously; the current timer is not a deployed DON.

The completed live run used the EVM log callback for the host's start request and a recurring cron invocation for settlement. [Receipts](../deployments/live-execution.md) show both onchain writes.

## Signed simulation reports

The workflow wraps its lifecycle payload as `(bytes payload, bytes signature)`. The EIP-712 domain is `CommitPass CRE simulation`, version `1`, chain ID `10143` and the active receiver address. The signed type is `SimulationReport(bytes payload)`.

Signing credentials and the attendance API token are configured outside Git. The receiver accepts only its immutable signer and the configured MockForwarder. Normal schedule, cutoff, expiry, snapshot and accounting checks still apply.

## Project structure

The workflow follows the official `cre init` structure and lives in `cre/commitpass/`:

```text
cre/
  project.yaml
  commitpass/
    main.ts
    workflow.yaml
    package.json
    config.testnet.example.json
  scripts/simulate-testnet.mjs
```

From the repository root:

```sh
pnpm --filter @commitpass/cre compile:wasm
pnpm --filter @commitpass/cre simulate:broadcast
```

Run broadcast only with the documented testnet configuration, an authenticated CLI and the required signing environment. The preflight checks chain ID, receiver bytecode, signer, forwarder and gas balance.

[Trigger capability](https://docs.chain.link/cre/capabilities/triggers) · [CLI simulation](https://docs.chain.link/cre/reference/cli/workflow) · [Consumer simulation requirements](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts#4-working-with-simulation)
