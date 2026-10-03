---
description: Understand the external ERC-4626 source and its shares.
---

# Yield Vault Lifecycle

The event vault is the lifecycle consumer and claim allocator. Its external yield source implements ERC-4626; these are two separate contracts.

```mermaid
sequenceDiagram
    participant Guests as Guest wallets
    participant Event as CommitPass event vault
    participant Yield as ERC-4626 yield source
    Guests->>Event: Fixed USDC commitments
    Event->>Yield: Approve and deposit pooled assets at start
    Yield-->>Event: Yield-source shares
    Note over Event,Yield: Shares remain owned by the event vault
    Event->>Yield: Redeem all shares at settlement
    Yield-->>Event: Recovered underlying assets
    Event->>Event: Check principal and allocate outcome
    Event-->>Guests: Pay individual claims when requested
```

The vault derives the underlying asset from the configured source's `asset()` method. Start deposits pooled assets, then clears allowance. Settlement redeems the source shares before calculating allocations.

## Current source and integration boundary

The active source is `MockYieldVault` on Monad testnet. It validates supply/redemption plumbing without proving organic yield or a Morpho investment. A compatible real vault needs its asset, liquidity, redemption behavior and loss handling evaluated before use.

## Morpho integration tested with Tenderly

[Hyperithm USDC Apex](https://app.morpho.org/monad/vault/0x78999cc96d2Ba0341588C60CcB0E91c6C33CF371/hyperithm-usdc-apex) is a Morpho USDC vault on **Monad mainnet**, at [0x78999cc96d2Ba0341588C60CcB0E91c6C33CF371](https://monadscan.com/address/0x78999cc96d2Ba0341588C60CcB0E91c6C33CF371).

**The Morpho integration path has been tested using Tenderly simulation by the CommitPass team.** This provides a team-reported simulation milestone for connecting the event commitment flow to Hyperithm USDC Apex.

The public demo currently uses MockYieldVault on Monad testnet. Tenderly testing and the public demo are separate environments; the simulation milestone does not represent a production mainnet deployment or a realized yield payment from the public demo.

All recovered surplus is assigned under the payout policy; no yield rate or return is guaranteed. A treasury share applies to no-show principal in normal settlement, not to surplus.
