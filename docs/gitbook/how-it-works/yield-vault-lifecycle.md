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

All recovered surplus is assigned under the payout policy; no yield rate or return is guaranteed. A treasury share applies to no-show principal in normal settlement, not to surplus.

[Contract architecture](../technical/smart-contracts.md) · [Roadmap](../mission/roadmap.md)
