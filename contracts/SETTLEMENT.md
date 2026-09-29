# Settlement and cancellation policy

Applies to newly deployed contracts from this source. Existing immutable public
testnet contracts and historical evidence retain their previous behavior.

| Outcome             | Eligibility                                                                         | Platform revenue                | Claim allocation                                                                              |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| Cancelled (3)       | Owner, before start time, no start request, never deposited to yield, not finalized | Zero                            | Original commitment for every depositor                                                       |
| Zero attendance (2) | Started, cutoff finalized, valid authenticated frozen snapshot with an empty list   | Zero                            | Original commitment plus recovered surplus for every depositor                                |
| Normal (1)          | Started, cutoff finalized, valid frozen snapshot with at least one attendee         | Floor(50% of no-show principal) | Attendees receive their principal, the remaining no-show principal, and all recovered surplus |

No-shows receive zero in a normal settlement. With zero attendance, the refund
exception takes precedence and no no-show fee is assessed. The yield fee is zero;
the previous 5% yield fee has been removed. The treasury address and 50% no-show
fee cannot be changed after creation. Gas paid for transactions is not refunded.

Cancellation is an owner transaction to `cancelEvent()`. The vault atomically
closes registration, finalizes as cancelled and allocates refund claims. The
automation receiver cannot subsequently start or settle it. The application does
not write a cancelled status to the database first: Envio consumes contract logs.

`eventSettled` means financially finalized for all three outcomes. Individual
`ClaimAllocated` events contain exact entitlement; `RewardClaimed` proves a payout.
`SettlementFinalized` identifies the reason and totals. `EventCancelled` identifies
the owner cancellation. `hasAttended` continues to describe attendance only:
refund recipients are not falsely marked present to let them withdraw.

Claims use the original depositing address, even if ERC-20 vault shares move.
Each allocation is fixed before any transfer and can only be claimed once.
The claimable balance is not rewritten after payout; `hasClaimed` gates reuse,
and the API reports zero outstanding claim after a confirmed claim event.

For normal/zero-attendance settlement, all yield shares must redeem and the
recovered assets must cover deposited principal. Failure reverts atomically;
there is no claim of guaranteed principal in a loss or unavailable-liquidity case.
All recovered balance beyond participant principal is treated as surplus, including
donations. Cancellation before yield deposit refunds principal only; unsolicited
token donations are not refunded and have no sweep function in this version.

The platform fee rounds down. Eligible participants receive equal floor amounts,
then remaining raw units go to eligible addresses in registration order. This
conserves allocated funds without making payout depend on claim order. Events
have a fixed commitment amount, so proportional and equal depositor refunds agree.

An empty snapshot is accepted only after the same authentication, chain-domain,
cutoff, finalized-state, SQL read, freeze, digest and consensus checks as a nonempty
snapshot. Backend failure must never be converted into empty attendance. Attendance
remains organizer-attested; omission of all check-ins results in the refund policy.

For local use, restart `pnpm local:app` to deploy fresh contracts and a fresh Envio
schema containing participant `allocatedAmount`. Old sessions are not upgraded.
Public deployment remains out of scope; do not point the new UI at old contracts
expecting cancellation/new getters to work. Historical evidence remains historical.
