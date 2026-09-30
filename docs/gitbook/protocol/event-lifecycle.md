---
description: Eligibility, requests and confirmed financial transitions.
---

# Event lifecycle

An event's schedule defines when an action is eligible. The corresponding transaction defines when the action actually happens.

| Stage                | What makes it happen                             | What changes                                       |
| -------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Created              | Factory creation succeeds                        | Dedicated vault and automation schedule exist      |
| Registration open    | Deadline and capacity allow a deposit            | Guests can commit the fixed USDC amount            |
| Start requested      | Owner requests start with at least one depositor | Registration closes; start becomes eligible        |
| Started              | CRE report is accepted                           | Pooled funds enter the configured yield vault      |
| Settlement requested | Owner requests end, or scheduled cutoff arrives  | Cutoff becomes authoritative; check-ins stop       |
| Settled              | Snapshot is accepted and assets redeem           | Claim allocations and totals become final          |
| Claimed              | Eligible depositor's claim succeeds              | Allocated USDC is transferred; claim cannot repeat |

## Start eligibility

The owner can request a start before the scheduled start time. The request closes registration. The scheduled start time also makes start eligible if at least one participant has deposited. An empty event cannot start through this receiver.

CRE reads current contract state even when an EVM log triggered the callback. A historical request log does not override the event's current eligibility or finalization state.

## The settlement cutoff

The cutoff is the scheduled settlement time unless the organizer requested an earlier end. The first request fixes the cutoff to the earlier of request time and scheduled settlement time.

Check-ins must precede that cutoff. The backend freezes the attendance list for the exact event and cutoff. Later calls return the same snapshot.

## Finalization and retries

Accepted reports must match the chain, registered vault, eligible action, expiry and snapshot. A duplicate start does not deposit funds again. A repeated settlement must match the already accepted snapshot and does not allocate funds again. A conflicting snapshot is rejected.

## Cancellation

Cancellation requires the event owner, a time before the scheduled start, no start request, no yield deposit, and an event that is not finalized. The contract closes registration and allocates principal refunds in the same transaction.

The backend does not mark an event cancelled first. Envio reads the resulting contract logs and materializes the final status.

## UI state and chain state

Requested, pending and confirmed states have different meanings. A wallet submission, a host button click or a frozen attendance list is not proof that funds moved. The vault receipt and emitted events establish the financial transition.
