# Execution evidence

Public chain receipts, local fixtures, and product videos establish different parts of CommitPass. The records below preserve their original dates, networks, and scenario limits.

## Latest public workshop

Network: **Monad testnet · 10143**. Event vault: [0xdeD18DAb5D35B2CA9fecb2b4A7f0f127C07f939b](https://testnet.monadscan.com/address/0xdeD18DAb5D35B2CA9fecb2b4A7f0f127C07f939b).

[Curated JSON](evidence/monad-workshop-2026-10-11.json) contains freshly read receipt status, block hashes, decoded vault events, and state pinned to a single block. Only public chain fields and the public indexer provider are included. The read timestamp and state block are recorded in the file.

| Action     | Receipt                                                                                                            | Block    | What the logs establish                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------- |
| Create     | [Transaction](https://testnet.monadscan.com/tx/0x83715de1dd21bee9746e6e6e6ffb7c549f5de4ae06e0b771e86dc8edc57f6f59) | 69949912 | `VaultCreated`, `EventRegistered`, and new vault ownership                        |
| Deposit    | [Transaction](https://testnet.monadscan.com/tx/0xa01dfdf5d50319d6eb4767679127c702c44f65702c83dddb03a1ae6b2dabd15f) | 69950134 | `DepositMade`, 1,000,000 raw USDC units                                           |
| CRE start  | [Transaction](https://testnet.monadscan.com/tx/0x5173c20e647b857606a1b3e3adb6c344cb61812fc3f1ca6cd5ec97f77f3e7041) | 69950581 | `DepositToYieldSource` and `LifecycleExecuted`                                    |
| CRE settle | [Transaction](https://testnet.monadscan.com/tx/0x363f9a7c9a44d0c50edeb8f0a9c62696c3a7bd7256d7e652e3cd25fdd874efb0) | 69951867 | Accepted attendance, exact allocation, normal settlement, and lifecycle execution |
| Claim      | [Transaction](https://testnet.monadscan.com/tx/0x012226c9cd17b11158ebf88210cc0fe47937b80a1d12018d93a7536d179b2c81) | 69952109 | `RewardClaimed`, 1,000,000 raw units paid                                         |

USDC has six decimals. Final deposited-to-yield, allocated, and claimed amounts are each **1 USDC**. Settlement reports zero recovered surplus and zero platform revenue. The configured yield source is the deployed `MockYieldVault` from the [manifest](../packages/shared/src/deployments/monad-testnet.json).

[Public activity endpoint](https://commitpass-api.endpx.cloud/v1/events/0xded18dab5d35b2ca9fecb2b4a7f0f127c07f939b/activity) reported `source: envio`, `provider: cloud`, and chain 10143 when this record was collected. Its availability and indexed head can change; receipts and block-pinned state remain the execution reference.

## What each artifact proves

| Artifact                                                                              | Scope                                                                                                | Limits                                                                                              |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Latest workshop JSON](evidence/monad-workshop-2026-10-11.json)                       | Successful public testnet transactions and final one-attendee accounting                             | No public no-show payout, organic yield, independent attendance proof, or deployed DON              |
| [Product demo](https://www.youtube.com/watch?v=p8Wsvpcy7ZU)                           | Recorded application behavior through organizer and guest views                                      | A recording is not independent adoption or a current service health guarantee                       |
| [CRE demo](https://www.youtube.com/watch?v=NJs1KMFsMWQ)                               | CLI simulation and public broadcast execution                                                        | CLI broadcast is distinct from Workflow DON deployment                                              |
| [Earlier direct-vault journey](../cre/evidence/frontend-direct-vault-2026-10-01.json) | Live frontend/Privy flow with a 0.1 USDC commitment                                                  | One account acted as host and guest; zero revenue and yield                                         |
| [Settlement-policy fixture](../cre/evidence/settlement-policy-local-2026-09-29.json)  | Local Anvil normal payout, zero-attendance refund, cancellation, rounding, and injected mock surplus | Disposable local contracts and synthetic surplus; not organic yield or public behavioral validation |
| [Interactive local app](../cre/evidence/interactive-local-2026-09-28.json)            | Connected Privy, Go/Neon, Envio, CRE, and browser flow on Anvil                                      | Predates the updated policy and uses historical local identifiers                                   |

Historical read-only simulations with an empty registry prove only trigger/read paths. They should not be presented as settlement transactions. See the [dated CRE evidence index](../cre/evidence/README.md).

## Independently inspect the record

1. Open each explorer transaction and check successful status, destination, block, and event logs.
2. Check the vault's factory, USDC token, and yield vault against the canonical deployment manifest.
3. Read `eventSettled`, `totalDepositedToYield`, `totalAllocated`, and `totalClaimed` at the state block recorded in the JSON. Compare raw integer amounts, not floating-point approximations.
4. Compare `SettlementFinalized`, `ClaimAllocated`, and `RewardClaimed`. Allocation is entitlement; the claim event establishes payment.
5. Inspect the indexed activity endpoint to see the API's Envio-derived read model. Indexer latency or a reorg can affect that view.

This process uses public reads only. Private attendance tokens, Privy credentials, and signing keys are not required to inspect receipts. The recorded snapshot digest binds the settlement domain and attendance payload; it does not establish that the host's attendance assertion was correct.
