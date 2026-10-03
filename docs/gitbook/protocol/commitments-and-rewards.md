---
description: The immutable payout policy and how each outcome allocates USDC.
---

# Commitments and rewards

Every guest commits the same fixed USDC amount for an event. The contract records the depositing address and fixes its claim allocation when the event is finalized.

## Normal settlement

When at least one participant attends:

- Attendees receive their own principal back.
- **50% of no-show principal goes to CommitPass.**
- **The remaining no-show principal goes to attendees.**
- All recovered surplus goes to attendees, with no platform fee on surplus.
- No-shows receive zero.

The treasury address and the 50% no-show share are fixed for the event. The host cannot change the distribution at settlement.

The treasury share transfers as part of settlement. Participant allocations are collected later through individual claim transactions.

## Worked example

This example explains the policy; it is not the recorded live demo.

Ten guests each commit **5 USDC**. Eight attend and two do not. Assume the vault recovers exactly the **50 USDC** deposited and has no surplus.

| Allocation                | Amount     |
| ------------------------- | ---------- |
| Attendees' principal      | 40 USDC    |
| No-show principal         | 10 USDC    |
| CommitPass share          | 5 USDC     |
| Attendee bonus pool       | 5 USDC     |
| Bonus per attendee        | 0.625 USDC |
| Total return per attendee | 5.625 USDC |

The eight attendee returns total **45 USDC**. Together with the **5 USDC** treasury share, all **50 USDC** are accounted for.

If that same event recovered an additional **2 USDC** of surplus, each attendee would receive another **0.25 USDC**, for **5.875 USDC** in total. The treasury share would still be **5 USDC**.

## Other outcomes

| Outcome                          | Participant allocation                                               | CommitPass share                       |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| Eligible host cancellation       | Original principal for every depositor                               | Zero                                   |
| Valid zero-attendance settlement | Principal plus recovered surplus for every depositor                 | Zero                                   |
| Normal settlement with attendees | Attendee principal, attendee share of no-show principal, all surplus | 50% of no-show principal, rounded down |

The zero-attendance exception takes precedence over the normal no-show policy. It requires a valid finalized empty snapshot, with the same authentication and domain checks as a nonempty snapshot.

## Exact accounting

USDC has six decimals. Contract calculations operate on integer token units. The platform fee rounds down. Eligible participants receive equal floor allocations; remaining raw units are assigned in registration order. Claim order does not change the allocation.

All yield shares must redeem and the recovered assets must cover the deposited principal before normal or zero-attendance settlement completes. Redemption failure or principal shortfall reverts the transaction. This implementation does not guarantee a payout during a loss or unavailable-liquidity condition.

Every eligible participant claims from the original depositing wallet, at most once. Gas is separate and is never part of the refund.

[Current contract policy](https://github.com/EndPx/commitpass/blob/main/contracts/SETTLEMENT.md)
