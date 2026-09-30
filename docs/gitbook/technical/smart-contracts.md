---
description: Factory discovery, dedicated event vaults and report authorization.
---

# Smart contracts

## CommitPassFactory

The factory creates and registers event vaults. `createAutomatedEvent(...)` creates an event and registers its automation schedule atomically. The factory's vault registry lets the API, receiver and indexer distinguish supported events from arbitrary addresses.

Each event records a fixed commitment amount, owner, registration deadline, start time, capacity, treasury and configured yield vault.

## CommitPassVault

The event vault:

* Accepts one fixed USDC commitment per depositor while registration is open.
* Tracks the original depositing address independently of transferable vault shares.
* Closes registration and deposits pooled assets into the configured ERC-4626 yield source at start.
* Redeems all yield shares and calculates deterministic allocations at settlement.
* Finalizes eligible cancellation refunds directly onchain.
* Allows each entitled depositor to call `claimReward()` once.

`ClaimAllocated` describes entitlement. `RewardClaimed` describes an actual payout. `SettlementFinalized` records the outcome and financial totals.

## CommitPassAutomation

The production receiver registers event schedules, accepts owner lifecycle requests and validates reports from its configured forwarder and workflow ID. It enforces timing, expiry, participant membership, the snapshot digest and one-time execution.

The original DON receiver is retained but unconfigured. The active application uses the separate simulation receiver below.

## CommitPassSimulationAutomation

This receiver is restricted to Monad testnet chain ID `10143`. It accepts calls from the official simulation MockForwarder and verifies an EIP-712 signature from its immutable operator signer.

The signature binds the report to the chain, receiver and payload. The receiver then runs the shared lifecycle and accounting checks inherited from the production receiver.

Simulation metadata does not carry a production DON workflow ID. The implementation therefore uses explicit signed simulation authorization rather than substituting an invented workflow identity.

## MockYieldVault

The current yield vault is an ERC-4626 fixture backed by Circle's native testnet USDC. It provides the deposit/redeem lifecycle used by the demo, but does not invest in Morpho or generate organic yield.

## Source and deployment

[Contract source](../../../contracts/src/) · [Current addresses](../deployments/monad-testnet.md) · [Payout rules](../protocol/commitments-and-rewards.md)

The factory and mock yield vault have recorded source verification. The active signed simulation receiver has a recorded deployment receipt and runtime hash; explorer source verification for that receiver is not claimed. None of these statements constitutes an independent audit.
