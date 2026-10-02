---
description: Shared trigger logic, validated snapshots and real testnet broadcasts.
---

# Chainlink CRE

CRE orchestrates start and settlement using frozen attendance snapshots. Each event vault is its own consumer and enforces the financial transition.

## Triggers and discovery

The cron schedule is `0 * * * * *`. It reads `getBatch(slot)` from the factory: at most two vaults per minute slot, rotated through the registry. Larger registries may wait for their slot.

The finalized EVM log trigger listens to factory `LifecycleRequested(address,uint8)`. Both handlers share processing logic and read the current vault state. Old request logs do not override current eligibility.

## Start and settlement

Start reports go directly to the vault, which closes registration and deposits pooled commitments into its ERC-4626 source.

For settlement, CRE fetches a frozen snapshot from the authenticated HTTPS API and checks version, event domain, cutoff, address ordering and digest. The vault independently validates the report before redemption and allocation.

An unavailable API or invalid snapshot defers settlement. A valid empty snapshot follows the zero-attendance refund policy. Report-delivery transaction status and vault lifecycle execution are checked separately.

## Current execution mode

The VPS runs CRE CLI simulation with `--broadcast`. These are real Monad testnet writes through the official simulation MockForwarder to each vault's `onReport`. No separate automation receiver is deployed for the active application.

A timer repeatedly invokes simulation callbacks. It is not a deployed Workflow DON.

Simulation reports wrap `(bytes payload, bytes signature)`. Their EIP-712 domain is `CommitPass CRE simulation`, version `1`, chain ID `10143`, and the receiving vault address. The signed type is `SimulationReport(bytes payload)`.

The receiver base first checks the immutable forwarder, then the immutable signer. Standard mode instead validates a nonzero workflow ID in metadata. The current simulation configuration deliberately uses workflow ID zero. Credentials are configured outside Git.

## Workflow source

`main.ts` constructs the SDK Runner. `workflow.ts` registers handlers; separate modules implement configuration, EVM processing, snapshot validation and report delivery.

[Workflow source](https://github.com/EndPx/commitpass/tree/main/cre/commitpass) · [Confirmed execution](../deployments/live-execution.md) · [Official consumer guide](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts) · [Forwarder directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts)
