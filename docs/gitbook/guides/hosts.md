---
description: Create an event, record attendance, and request settlement.
---

# For hosts

## Create an event

Sign in and choose **Create event**. Configure:

- Name, description, cover and theme.
- Physical address or virtual meeting link.
- Event timezone, start and end times.
- Fixed USDC commitment per guest.
- Capacity and registration deadline.

**Same as start time** links the registration deadline to the event start and disables the independent date input. The editor handles the contract's requirement that registration close before the start.

Confirm the create transaction in your wallet. Creation deploys a dedicated event vault and registers its automation schedule in the same transaction. The resulting event page is the place to share and manage the event.

The current factory supports events with up to **500 participants**. Use a small capacity and commitment for a testnet demonstration.

## Start the event

Open **Manage event**. With at least one committed participant, the host can request **Start event** and confirm the transaction. That request closes registration immediately.

The scheduled start also establishes eligibility when participants exist. CRE processes the eligible action and the event becomes active after the start transaction succeeds. A host request and a completed start are separate states.

## Record attendance

Manage event has **Event details** and **Participants** tabs. Use the participant table or **Scan QR** to record attendance. A valid QR automatically requests check-in and shows the guest name after API confirmation. The camera stays active for the next guest; duplicate scans do not create duplicate attendance. The backend confirms that you are the current event owner and that the participant deposited into this event.

Check-ins use server timestamps and are append-only in this version. There is no attendance correction/delete endpoint. Record attendance carefully before ending the event.

## End and settle

Choose **End event** when the event is ready to close. The contract records a settlement cutoff. Check-in closes at that cutoff. CRE obtains a frozen snapshot and asks the vault to settle.

Wait for the confirmed settlement state. Guests then collect their allocated return through the event page. Envio updates financial status from contract events.

## Cancellation

The host can cancel only before the scheduled start, with no start request and no deposit to the yield vault. Cancellation executes onchain first and fixes full principal refund claims. Guests still collect those refunds through a claim transaction.

See [Event lifecycle](../protocol/event-lifecycle.md) for the exact transition rules.
