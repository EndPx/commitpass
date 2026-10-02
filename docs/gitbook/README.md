---
description: Guides, protocol rules, and implementation details.
---

# Overview

**Onchain commitments for events.**

CommitPass helps community organizers turn an RSVP into a commitment. Guests reserve a place with USDC, the host records attendance, and the event contract calculates each guest’s return. Attendees reclaim their commitment and share rewards from forfeited no-show commitments.

## Choose your path

| What you want to do         | Read                                                           |
| --------------------------- | -------------------------------------------------------------- |
| Understand the product      | [Why CommitPass](introduction/problem-and-solution.md)         |
| Try the app                 | [Getting started](guides/getting-started.md)                   |
| Reserve a place and claim   | [For guests](guides/guests.md)                                 |
| Create and manage an event  | [For hosts](guides/hosts.md)                                   |
| Understand payouts          | [Commitments and rewards](protocol/commitments-and-rewards.md) |
| Inspect the working journey | [Live execution](deployments/live-execution.md)                |
| Explore the implementation  | [System architecture](technical/architecture.md)               |

## The main flow

**Create → Commit USDC → Check in → Settle → Claim.**

The host chooses a fixed commitment amount and capacity. Each reservation deposits that amount into a dedicated event vault. After attendance is finalized, the contract fixes each participant’s allocation. Guests collect their return from the event page with a claim transaction.

In normal settlement, 50% of forfeited no-show principal goes to CommitPass and the remainder goes to attendees. All recovered surplus goes to attendees. Eligible cancellation and valid zero-attendance settlement use the refund exceptions explained in [Commitments and rewards](protocol/commitments-and-rewards.md).

## Current release

The app runs on **Monad testnet** with Circle’s native testnet USDC. The frontend is hosted on Vercel. The Go API and recurring CRE CLI simulation run on a VPS. Envio is hosted and provides indexed GraphQL reads. CRE broadcasts start and settlement reports through the MockForwarder directly to each event vault.

A one-attendee journey completed through the live frontend and Privy, including creation, deposit, host check-in, CRE execution and claim. [Live execution](deployments/live-execution.md) contains the confirmed receipts and accounting.

Testnet tokens have no financial value. The current yield source is a mock ERC-4626 vault. [Deployment status](deployments/status.md) explains the remaining boundaries, including DON deployment and organic yield.

[Open the app](https://commitpass-event.vercel.app/) · [Discover events](https://commitpass-event.vercel.app/discover) · [Source](https://github.com/EndPx/commitpass)
