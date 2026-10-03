---
description: Follow the cutoff, immutable snapshot, allocation and actual payout.
---

# Settlement and Claims

An organizer end request fixes the cutoff to the earlier of request time and scheduled settlement time. The scheduled cutoff can also make settlement due. Check-in closes at that boundary.

```mermaid
sequenceDiagram
    participant Vault as Event vault
    participant CRE as CRE workflow
    participant API as Snapshot API
    participant Yield as Yield source
    participant Guest as Eligible guest
    CRE->>Vault: Read due settlement and cutoff
    CRE->>API: Freeze attendance for exact event domain
    API-->>CRE: Sorted attendees and snapshot digest
    CRE->>Vault: Report via configured forwarder
    Vault->>Yield: Redeem all held shares
    Vault->>Vault: Validate recovered principal and fix allocations
    Vault-->>Guest: Claim allocation becomes available
    Guest->>Vault: claimReward
    Vault-->>Guest: Transfer allocated USDC
```

## Which outcome applies?

```mermaid
flowchart TB
    Finalize[Finalization] --> Cancel{Eligible pre-start cancellation?}
    Cancel -->|Yes| Refund[Principal refunds, no platform fee]
    Cancel -->|No| Snapshot[Valid frozen attendance snapshot]
    Snapshot --> Present{Any attendees?}
    Present -->|No| Zero[Principal plus recovered surplus to all depositors]
    Present -->|Yes| Normal[Attendee principal plus no-show share and surplus]
    Normal --> Platform[50 percent of no-show principal to treasury]
    Refund --> Claims[Individual guest claims]
    Zero --> Claims
    Normal --> Claims
```

Unavailable or malformed attendance data defers settlement; it is not interpreted as zero attendance. Redemption failure or a principal shortfall reverts finalization. The current implementation does not guarantee an exit during illiquidity or loss.

`ClaimAllocated` records entitlement. `RewardClaimed` records a completed payment. The guest claims from the original depositing wallet, at most once; MON gas is separate.

[Exact payout rules](../protocol/commitments-and-rewards.md)
