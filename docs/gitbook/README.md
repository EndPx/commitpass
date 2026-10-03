---
description: Onchain commitments for events, built on Monad.
---

# Overview

CommitPass is an event commitment application built on Monad. It connects a familiar event experience with a recorded USDC commitment: guests reserve a spot, organizers confirm attendance, and a dedicated event vault applies the financial rules after the event.

The idea is simple: a reservation should carry a clear commitment, and guests should be able to follow what happens to it. CommitPass brings event discovery, account access, QR check-in, lifecycle automation and return claims into one workflow.

## 1. Turning reservations into commitments

A free RSVP helps a host estimate interest, but a limited seat can remain reserved even when the guest never arrives. CommitPass attaches a fixed USDC deposit to the reservation. The host chooses the amount before registration opens, and every participant deposits into the same event's dedicated vault.

For a normally completed event, checked-in guests receive their commitment back and share the attendee bonus pool. No-show principal is split equally between attendees and CommitPass; recovered surplus goes to attendees. Cancellation and zero-attendance outcomes follow separate rules in [Commitments and Rewards](protocol/commitments-and-rewards.md).

## 2. A familiar experience for guests and organizers

Guests can explore events before creating an account. Email or Google sign-in through Privy provides account and embedded wallet access. Display names, event covers, descriptions and reservation passes make the experience readable without requiring users to interpret contract addresses.

Organizers create an event, manage its details and participants, scan reservation QR codes, and request lifecycle actions. A continuous scanner helps handle successive arrivals while check-in notifications identify each guest.

## 3. Why build on Monad?

Event commitments involve several distinct transactions: creation, token approval, deposit, lifecycle execution and claim. CommitPass uses Monad's EVM environment to implement this workflow with Solidity contracts and familiar wallet tooling.

The active release runs on Monad testnet, using Circle native testnet USDC for commitments and MON for gas. This gives the team a shared environment for exercising the complete event lifecycle before considering a production release.

## 4. A connected application architecture

- **Dedicated event vaults** isolate each event's participants, deposited funds and allocations.
- **Chainlink CRE** validates lifecycle inputs and delivers reports directly to the event vault.
- **Envio** indexes contract activity for discovery, vault insights and profile history.
- **The Go API and Neon** store event metadata, chosen names and organizer-recorded attendance.

The current CRE runtime broadcasts signed CLI simulation reports. The current ERC-4626 yield source is a mock. [Technical Details](technical/architecture.md) explains the connected components and integration boundaries.

## Continue exploring

| Topic | Start here |
| --- | --- |
| The reservation problem and the proposed mechanism | [Problem and Solution](introduction/problem-and-solution.md) |
| What the application offers | [Features](introduction/features.md) |
| How to use the app | [Using CommitPass](guides/overview.md) |
| The complete event journey | [How CommitPass Works](introduction/how-it-works.md) |
| Components and implementation details | [Technical Details](technical/architecture.md) |
