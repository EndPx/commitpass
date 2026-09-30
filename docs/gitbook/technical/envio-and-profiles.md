---
description: >-
  Turn confirmed event activity into discovery, positions and participant
  history.
---

# Envio and profiles

Envio HyperIndex turns factory, receiver and vault events into the read model used by CommitPass. Its role includes event discovery, participation, lifecycle status, allocations and claims.

## Dynamic event discovery

The indexer listens to the factory's `VaultCreated` event and registers each new vault dynamically. Subsequent event activity can be attributed to that vault and its depositing participants.

## Indexed entities

| Entity            | What it records                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| `CommitmentEvent` | Owner, schedule, capacity, deposits, lifecycle and financial totals           |
| `Participant`     | Depositing wallet, committed amount, settled attendance, allocation and claim |
| `ChainActivity`   | Action, contract, transaction hash, block reference and log index             |

An organizer request is not treated as a completed start or settlement. Vault events establish the completed financial transition.

## Your profile

The profile combines indexed public chain facts into:

* Events joined and hosted.
* Attendance rate for applicable completed events.
* Commitments still locked in events.
* Allocations still available to collect.
* Confirmed claims received.
* Registration activity across six UTC monthly buckets.
* Event positions and their activity history.

Cancellation and zero-attendance refund events do not count as attended events. Linked wallets are deduplicated where appropriate. A claim allocation is not a received claim; only the payout event contributes to received funds.

Spendable USDC balance comes from a live token read. It is displayed alongside event statistics but is not inferred from the indexed sum of commitments and claims.

## Identity and privacy

Wallet activity on Monad is public. Public wallet-profile endpoints expose those chain facts. The signed-in profile derives its wallet set from a fresh verified account response. Names and email addresses are shown in the authenticated frontend, not included as public chain activity.

## Consistency

Envio handlers support reorg rollback. The launcher limits public RPC query ranges and indexes with a short block lag. This lag is an operational choice, not a cryptographic finality guarantee.

The app can observe a confirmed receipt before indexed history changes. Financial actions use current contract state, while event lists and profiles may update slightly later. The completed demo's activity includes creation, deposit, start, attendance settlement, allocation and claim.

[Indexer source](../../../indexer/) · [Live execution](../deployments/live-execution.md)
