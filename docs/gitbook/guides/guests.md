---
description: Reserve your place, get checked in, and claim your return.
---

# For guests

## Reserve a spot

1. Open an event from Discover or a shared event link.
2. Review its location, start time, commitment amount and registration deadline.
3. Sign in if you are browsing as a guest.
4. Select the reservation action.
5. Confirm the USDC approval if requested.
6. Confirm the deposit transaction.

Wait for confirmation before treating the reservation as complete. The event page shows your reserved pass after the deposit is accepted. If you approved USDC but the deposit failed, the approval is not a reservation; inspect the transaction status before trying the deposit again.

Reservations close when the deadline passes, capacity is reached, registration is closed by the host's start request, or the event is finalized. A participant can deposit once into a given event.

## Attend and check in

Use your event pass at the event. The host checks you in through their management page. Check-in must be recorded while the event's attendance window is open and before its settlement cutoff.

The host is the authority for attendance. A QR pass identifies a reservation; it does not independently prove physical presence. Ask the host to confirm your check-in before the event ends.

## Collect your return

After the event is settled, open its page and use the claim action. Confirm the transaction in Privy. A successful claim transfers the allocated USDC to the wallet that originally deposited.

The payment requires a claim transaction. Settlement calculates an entitlement; it does not automatically send each guest their USDC. A confirmed claim can only be paid once.

## Follow your activity

Your profile summarizes joined events, attendance, commitments still locked in events, returns available to collect and confirmed claims received. Activity and event links are derived from indexed contract logs.

The wallet's spendable USDC balance is read from the token contract. Profile commitment and return totals describe event positions. They are different quantities.

If a receipt is confirmed before the app updates, allow the indexer to catch up or refresh the page. Avoid resubmitting a successful transaction just because the displayed activity is still catching up.
