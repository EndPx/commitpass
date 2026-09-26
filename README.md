# CommitPass

**Commit to show up. Get rewarded when you do.**

CommitPass makes RSVPs accountable on Monad with refundable stablecoin commitments and rewards for showing up.

Participants reserve a place by depositing a fixed commitment into an event contract. Organizers record attendance. At settlement, attendees become eligible to claim their commitment and a share of forfeited no-show deposits, together with any realized yield available for distribution.

## Status

CommitPass is being designed for the Metropolis hackathon. This repository currently contains project documentation only. Contracts, the application, and sponsor integrations have not yet been implemented or deployed here.

## Planned event lifecycle

1. **Create:** an organizer configures an event, capacity, commitment amount, registration deadline, start time, check-in window, and settlement time.
2. **Commit:** participants deposit the event's supported stablecoin into its contract through a Privy embedded wallet.
3. **Start:** an authorized organizer request or the scheduled start time triggers a Chainlink CRE workflow. The contract closes registration and deposits pooled funds into a compatible Morpho vault.
4. **Check in:** the organizer verifies attendance through the application. The Go backend records check-ins in Neon PostgreSQL.
5. **Settle:** an authorized organizer request or the scheduled settlement time triggers CRE. The workflow retrieves a finalized attendance snapshot and submits it to the contract, which withdraws vault assets and calculates claims.
6. **Claim:** eligible participants claim their return through Privy. Envio indexes confirmed contract events so the application reflects deposits, lifecycle transitions, settlements, and claims.

The contract must enforce timing, authorization, and one-time execution. Scheduled timestamps establish eligibility; active CRE workflows submit the transactions.

## Trust and accounting

- **Attendance:** the organizer attests who attended. QR check-in is not independent proof of physical presence.
- **Funds:** event contracts manage commitments and enforce distributions. The database does not determine whether an onchain payment succeeded.
- **Yield:** distributions use recovered assets and realized yield. Morpho withdrawal availability and potential losses must be handled explicitly; a settlement deadline is not a guarantee of immediate liquidity.
- **Data:** Envio owns indexed chain data. The backend owns metadata, profiles, check-ins, and immutable settlement snapshots in separate database schemas.

The supported stablecoin and Morpho vault, fee policy, cancellation rules, and zero-attendance outcome still need to be finalized before implementation.

## Planned stack

| Component | Role |
| --- | --- |
| Monad and Solidity | Event factory, event contracts, and financial settlement |
| Next.js and TypeScript | Participant and organizer application |
| Privy | Onboarding, embedded wallets, transaction signing, and sponsored gas |
| Go | Metadata, organizer authorization, attendance, and snapshot APIs |
| Envio HyperIndex | Contract discovery and indexing of confirmed onchain activity |
| Neon PostgreSQL | Indexed data and application data |
| Chainlink CRE | Event start and settlement orchestration |
| Morpho | Yield deployment for committed funds |

## Implementation references

CommitPass adopts the event commitment mechanism from ATFI and uses ShowOrSow as the frontend reference:

- [ATFI contracts, commit `1c57d35`](https://github.com/ATFi-Event/smart-contract/tree/1c57d35b80bb67afc04ee3d9a26292721695aed5)
- [ATFI backend, commit `3413119`](https://github.com/ATFi-Event/backend/tree/3413119726c2fd3038253020f940378c192ae2b6)
- [ShowOrSow frontend, commit `8fbe3f0`](https://github.com/EndPx/ShowOrSow/tree/8fbe3f04a05eb19eca10710173057f65d9aadf84/web)

The implementation should retain their direct product flows while adapting account access, indexing, automation, and accounting to CommitPass.

## Metropolis integration targets

- [Best Use of Envio](https://hackathon.monad.xyz/tracks/best-use-of-envio)
- [Best workflow with CRE](https://hackathon.monad.xyz/tracks/best-workflow-with-cre)
- [Privy](https://hackathon.monad.xyz/tracks/privy)

Additional Mera and Agora bounties are under consideration. They are not confirmed implementation requirements.
