---
description: Reserve a spot, show up, and collect your commitment back.
---

# Welcome to CommitPass

**Good plans deserve a full house.**

CommitPass helps community organizers turn an RSVP into a commitment. Guests reserve a place with USDC, the host records attendance, and the event contract calculates each guest's return. Guests who attend reclaim their commitment and share rewards from forfeited no-show commitments.

![An original illustration of a community workshop, with a checked event pass in the foreground.](assets/commitpass-community.png)

_Original artwork for these docs. This is an illustrative scene, not a photograph of a real CommitPass event._

## The flow in one line

**Create an event → Commit USDC → Check in → Settle → Claim.**

The host chooses the commitment amount and capacity. Each reservation deposits that fixed amount into a dedicated event vault. After attendance is finalized, eligible guests collect their return from the event page.

## Start here

| What you want to do                     | Where to go                                                    |
| --------------------------------------- | -------------------------------------------------------------- |
| Understand the product                  | [Why CommitPass](introduction/problem-and-solution.md)         |
| Try the app                             | [Getting started](guides/getting-started.md)                   |
| Reserve a place and collect your return | [For guests](guides/guests.md)                                 |
| Create and manage an event              | [For hosts](guides/hosts.md)                                   |
| Understand payouts                      | [Commitments and rewards](protocol/commitments-and-rewards.md) |
| Review the working implementation       | [Live execution](deployments/live-execution.md)                |
| Explore the technical design            | [System architecture](technical/architecture.md)               |

## Try CommitPass

- [Open the app](https://commitpass-kappa.vercel.app/)
- [Discover events](https://commitpass-kappa.vercel.app/discover)
- [View the completed demo event](https://commitpass-kappa.vercel.app/events/0x900ef7f431c1d2344cf07e67a018b252df60ce63)
- [Browse the source](https://github.com/EndPx/commitpass)

## Current release

The application runs on **Monad testnet** using Circle's native testnet USDC. The frontend is hosted on Vercel. The Go API, Envio indexer and recurring CRE CLI simulation run on a VPS. CRE simulations broadcast real testnet transactions through a dedicated signed receiver.

A complete one-attendee journey has succeeded through the live frontend and Privy: event creation, commitment, host check-in, CRE start and settlement, and participant claim. [The transaction record](deployments/live-execution.md) shows the receipts and final accounting.

Testnet USDC and MON have no financial value. The current yield vault is a mock ERC-4626 implementation. [Deployment status](deployments/status.md) explains the execution mode and remaining boundaries.
