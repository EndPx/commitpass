---
description: Quick answers about accounts, funds, attendance and the current demo.
---

# Frequently asked questions

## Can I browse without signing in?

Yes. Discover and public event details are available to guests. Reserving a place, hosting, and account-specific actions require sign-in.

## Is the commitment a ticket price?

It is a refundable attendance commitment. In a normal settlement, a guest who attends is allocated their commitment back and may receive additional rewards. [Commitments and rewards](../protocol/commitments-and-rewards.md) explains the outcomes.

## Does settlement automatically pay my wallet?

No. Open the event page and claim after settlement. The funds arrive when your claim transaction succeeds.

## What if I do not attend?

When at least one participant attends, a no-show receives no refund. Half of forfeited no-show principal goes to CommitPass and the rest is distributed to attendees. If nobody attends, the zero-attendance refund exception applies.

## What if the host cancels?

An eligible cancellation fixes a principal refund for every depositor. Each depositor claims it into the original wallet. Transaction gas is not refunded.

## Which USDC should I use?

Circle's native USDC on **Monad testnet**, at `0x534b2f3A21130d7a60830c2Df862319e593943A3`. Get it from [Circle Faucet](https://faucet.circle.com/) with Monad Testnet selected. Tokens from other chains do not fund this event vault.

## Do I need MON?

Yes, the wallet needs testnet MON for transaction gas. Use the app's Faucet MON link or [Monad Faucet](https://faucet.monad.xyz/).

## Who decides whether I attended?

The organizer records attendance. The backend checks authorization and freezes a snapshot. CRE and the contracts enforce the snapshot and settlement rules; they do not independently verify physical presence.

## What if the attendance API is unavailable?

Settlement stays pending. A failed request is never interpreted as an empty guest list. The workflow can retry when the dependency recovers.

## Why is my profile still showing an earlier status?

Receipts and indexed activity can arrive at different times. The app uses current contract state for financial actions, while profile history comes from Envio. Give indexing a moment to catch up after confirmation.

## Is CRE deployed to a DON?

The current demo runs CRE CLI simulation with `--broadcast` on a VPS. The broadcasts are real Monad testnet transactions. DON deployment is a separate step and is not active in this release.

## Does the demo earn real yield?

No. The configured ERC-4626 yield vault is a mock. The completed live scenario had zero realized yield.
