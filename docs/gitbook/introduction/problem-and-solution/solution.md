---
description: Attach a refundable USDC commitment to a reservation and reward the people who attend.
---

# Solution

## A commitment attached to the reservation

CommitPass adds a refundable USDC commitment to the event flow:

1. The host sets one commitment amount for the event.
2. The guest deposits that amount when reserving a spot.
3. The host records the guest's attendance.
4. The contract settles the event and fixes each guest's entitlement.
5. The guest claims their return into the depositing wallet.

In a normal settlement, attendees receive their commitment back. They also share half of forfeited no-show principal and any recovered surplus. CommitPass receives the other half of no-show principal. [The payout policy](../../protocol/commitments-and-rewards.md) defines the calculation.

## A practical guest experience

Guests can browse public events before signing in. Privy provides account access and an embedded wallet when the guest is ready to participate.

## Implementation context

CommitPass builds on ATFI's event commitment mechanism, adapted for Monad, Privy, Chainlink CRE and Envio. [Implementation references](../../resources/links.md) record that lineage.

{% content-ref url="../how-it-works.md" %}
[How CommitPass Works](../how-it-works.md)
{% endcontent-ref %}
