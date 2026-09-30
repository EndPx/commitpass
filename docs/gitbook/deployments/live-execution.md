---
description: A completed frontend and Privy journey with actual Monad testnet receipts.
---

# Live execution

On **1 October 2026, Asia/Jakarta**, a one-attendee journey completed through the live CommitPass frontend and an authorized Privy wallet. The actor created an event, approved and deposited USDC, requested start, checked in, requested settlement and claimed their return. CRE CLI simulations on the VPS broadcast the start and settlement transactions.

## The event

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Event        | CommitPass frontend E2E · CRE broadcast      |
| Network      | Monad testnet, `10143`                       |
| Event vault  | `0x900Ef7F431C1D2344CF07E67A018B252DF60Ce63` |
| Commitment   | `0.1 USDC`                                   |
| Participants | One                                          |
| Attendance   | One checked in                               |
| Outcome      | Normal settlement                            |

[Open the completed event](https://commitpass-kappa.vercel.app/events/0x900ef7f431c1d2344cf07e67a018b252df60ce63).

## Confirmed transactions

| Step                     | Receipt                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Create event             | [0xe39a…eb41](https://testnet.monadexplorer.com/tx/0xe39a877162e371a84fc26782e754c2a963433ba555ba586d2cae35ffb276eb41)  |
| Approve USDC             | [0xa289…e573](https://testnet.monadexplorer.com/tx/0xa289d3716fee38e25a084c077c2931befedcca93e49fce0dd2b00bf8d766e573)  |
| Deposit                  | [0xc08a…98ae8](https://testnet.monadexplorer.com/tx/0xc08a11cbdf5dfacd51e6fd8495eba96cf1809b40da8703cb192bb1a99f998ae8) |
| Host start request       | [0xfd44…be90](https://testnet.monadexplorer.com/tx/0xfd4496cab77d4f934a5edb23e45f04d7a0412a47cc343edd61ec0a543e20be90)  |
| CRE start broadcast      | [0x043f…afa0](https://testnet.monadexplorer.com/tx/0x043fc16fd3c5ddb698c626dc346e12645fc0263037278462335906ef12eaafa0)  |
| Host settlement request  | [0x410d…19f5](https://testnet.monadexplorer.com/tx/0x410d3bc82f844a7f7dd4ba0bc15cb37f8f81c5d7718a12c635420fa2a69419f5)  |
| CRE settlement broadcast | [0x9d40…bb14](https://testnet.monadexplorer.com/tx/0x9d409d87e4dffa3c6dd6a8f3b006e999687c659c9214cc320409fdfbbc84bb14)  |
| Participant claim        | [0x4b04…34b9](https://testnet.monadexplorer.com/tx/0x4b0435b834d8c30cedace6e9882aad19a3f8264014ab9ffd3ce994f7754134b9)  |

Check-in was an authenticated application write, not a standalone participant chain transaction. The frozen snapshot contained one attendee and its hash matched the accepted settlement report.

## Final accounting

| Quantity                   | USDC  | Raw units |
| -------------------------- | ----- | --------- |
| Participant deposit        | `0.1` | `100000`  |
| Final allocation           | `0.1` | `100000`  |
| Confirmed claim            | `0.1` | `100000`  |
| Protocol revenue           | `0`   | `0`       |
| Realized yield             | `0`   | `0`       |
| Wallet balance after claim | `1`   | `1000000` |

The wallet started with a funded **1 USDC**, held **0.9 USDC** after the commitment, and returned to **1 USDC** after claiming. MON gas was paid separately.

Envio indexed the creation, deposit, lifecycle requests, completed lifecycle writes, attendance settlement, allocation and claim. The profile showed one event joined, one event hosted, 100% attendance for this scenario, 0.1 USDC received and zero remaining commitment or claimable return.

## Scope of this record

This confirms a **single-attendee normal flow** through the real frontend, Privy, the Go check-in API, Envio and CRE broadcast. It does not establish a deployed DON, organic yield, or browser coverage of no-show splitting, cancellation and zero-attendance refunds.

The structured [evidence file](https://github.com/EndPx/commitpass/blob/main/cre/evidence/frontend-monad-broadcast-2026-10-01.json) includes receipt status, block references, the immutable snapshot and final contract totals.
