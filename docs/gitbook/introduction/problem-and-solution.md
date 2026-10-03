---
description: Give a reservation a clear consequence and reward the people who attend.
---

# Problem and Solution

A workshop has a fixed number of seats. A meetup host books a room, prepares materials and plans around the guest list. An RSVP gives the host a number to work with, but it does not tell them who will actually arrive.

When a guest does not show up, their reserved place can stay empty while another person misses the chance to attend. Hosts bear the preparation cost and uncertainty.

## A commitment attached to the reservation

CommitPass adds a refundable USDC commitment to the event flow:

1. The host sets one commitment amount for the event.
2. The guest deposits that amount when reserving a spot.
3. The host records the guest's attendance.
4. The contract settles the event and fixes each guest's entitlement.
5. The guest claims their return into the depositing wallet.

In a normal settlement, attendees receive their commitment back. They also share half of forfeited no-show principal and any recovered surplus. CommitPass receives the other half of no-show principal. [The payout policy](../protocol/commitments-and-rewards.md) defines the calculation.

## Who it is for

- **Community meetups** with limited space and recurring attendees.
- **Workshops** where preparation depends on the number of participants.
- **Small gatherings** whose hosts want a clearer commitment than a free RSVP.

Guests can browse public events before signing in. Privy provides account access and an embedded wallet when the guest is ready to participate.

## What we are validating

The product hypothesis is that a clear refundable commitment makes a reservation more meaningful. The current implementation proves the funds and attendance workflow can complete on testnet. It does not yet establish a measured reduction in no-shows or a validated commitment price for every type of event.

CommitPass builds on ATFI's event commitment mechanism, adapted for Monad, Privy, Chainlink CRE and Envio. [Implementation references](../resources/links.md) record that lineage.
