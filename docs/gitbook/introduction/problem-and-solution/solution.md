---
description: A reservation mechanism that connects commitment, attendance and transparent returns.
---

# Solution

CommitPass gives each event an onchain commitment mechanism. The organizer defines the deposit and schedule, guests reserve with USDC, and attendance becomes input to a published financial policy. The experience combines practical event tools with inspectable deposit, allocation and claim records.

## 1. A clear commitment when reserving a spot

The guest deposits the event's fixed USDC amount into a dedicated vault. The reservation therefore has a recorded financial commitment and an identifiable depositing wallet. A reservation pass gives the guest a QR code to present when they arrive.

## 2. Returns linked to attendance

For normal settlement, attendees reclaim their principal and share the attendee bonus pool. Half of forfeited no-show principal goes to attendees and half to CommitPass. All recovered surplus goes to attendees.

The contract fixes allocations after settlement, and each guest claims into the original depositing wallet. Cancellation and valid zero-attendance settlement have refund exceptions described in [Commitments and Rewards](../../protocol/commitments-and-rewards.md).

## 3. Accessible account and wallet onboarding

Privy supports email and Google sign-in with embedded wallet access. Guests can browse before signing in and use chosen display names throughout the app. The interface explains the commitment and gas requirements where the guest needs them.

## 4. Practical event management and check-in

Organizers manage details and participants through separate tabs. The QR scanner stays active for successive arrivals, validates the participant through the organizer API, and records check-in automatically. Name notifications help the host recognize the result.

Attendance remains the organizer's attestation. A QR scan and a database record do not independently prove physical presence.

## 5. Automated processing with traceable outcomes

CRE validates lifecycle inputs and sends reports to the event vault. Envio indexes the resulting contract logs so event pages and profiles can display commitments, allocations and collected returns.

The distinction matters: a start request is not a completed start, and an available allocation is not a paid claim. The corresponding contract receipt establishes each completed financial action.

## 6. A path toward productive pooled commitments

The vault uses ERC-4626 deposit and redemption interfaces for the event's pooled funds. The CommitPass team has tested the integration path to Morpho's Hyperithm USDC Apex using Tenderly simulation. The public testnet deployment exercises the lifecycle through a mock source; production integration remains subject to asset, liquidity and security review.

CommitPass adapts ATFI's event commitment mechanism for Monad, Privy, CRE and Envio. [Links and References](../../resources/links.md) records the implementation lineage.

{% content-ref url="../how-it-works.md" %}
[How CommitPass Works](../how-it-works.md)
{% endcontent-ref %}
