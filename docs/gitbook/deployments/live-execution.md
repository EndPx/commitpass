---
description: A completed frontend and Privy journey with actual Monad testnet receipts.
---

# Live execution

On **1 October 2026, Asia/Jakarta**, a single-attendee journey completed through the live frontend and an authorized Privy wallet using the current direct-vault architecture.

The [demo event](https://commitpass-event.vercel.app/events/0x5f50ad692ee6e5196d7186b2a57c637e46b9e3a8) used vault `0x5f50AD692ee6e5196d7186b2A57C637E46B9e3A8` and factory `0x94f7408816cc9eAB7e5043E92bdDdDAFf3A9931F`. Commitment was 0.1 USDC, with one depositor and one attendee.

## Confirmed receipts

| Step | Receipt |
| --- | --- |
| create | [0xab53e684…](https://testnet.monadscan.com/tx/0xab53e684269d397555a228509573684ee5405c5c7554a7ee328397f64c812f2e) |
| deposit | [0x52862089…](https://testnet.monadscan.com/tx/0x52862089e5815a0975c87f278e6612c0dafd0a1244d9f2a7968e4118d72b1ce2) |
| requestStart | [0x6b04b5c1…](https://testnet.monadscan.com/tx/0x6b04b5c1fa1fa2b2be56332f9ffdafbe2f1e3dd8a296200f26391dd94fc08308) |
| startCRE | [0x34cbb201…](https://testnet.monadscan.com/tx/0x34cbb201e36da95302b07c521e8c35093f3ae41926aa804f619ca0540fc90620) |
| requestSettlement | [0xa1cae280…](https://testnet.monadscan.com/tx/0xa1cae280bd0fe3eddf5ba4bc379f65125834df22d9a03d7fd42659734b3e23cc) |
| settleCRE | [0x33264916…](https://testnet.monadscan.com/tx/0x33264916b712f524a2be5c43597a374a6e9f976eba5f4b68c1bdb3b8afda5b4f) |
| claim | [0xc7fc87c2…](https://testnet.monadscan.com/tx/0xc7fc87c2f1a70c7bb5808e9d236955bd4c0b9e37eff08e6036a87cb01853b246) |

The vault emitted `LifecycleExecuted`. CRE writes came through the simulation MockForwarder. Organizer requests and completed lifecycle writes are separate receipts. The frozen snapshot contained one attendee.

## Accounting

Commitment, allocation and completed claim were each 0.1 USDC (100,000 raw units). Yield and protocol revenue were zero. The wallet moved from 1 USDC to 0.9 and back to 1 after claim; the vault had zero USDC remaining. MON gas was paid separately.

Envio indexed lifecycle, allocation and payout. An allocation is not a payment; the claim receipt establishes the completed return.

## Scope

This proves the current single-attendee frontend flow. It does not prove DON deployment, organic yield or a live browser no-show split. [Structured evidence](https://github.com/EndPx/commitpass/blob/main/cre/evidence/frontend-direct-vault-2026-10-01.json) records receipts, the snapshot, verification and exact accounting. Separate-receiver records describe historical immutable contracts.
