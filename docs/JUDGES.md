# Judge's guide

CommitPass is a refundable USDC commitment application for events on Monad. This guide connects the working product to the implementation and public evidence.

## Review in five minutes

1. [Watch the product demo](https://www.youtube.com/watch?v=p8Wsvpcy7ZU) (2:23). Follow the organizer and guest through creation, reservation, QR check-in, settlement, and claim.
2. [Open the live app](https://commitpass-event.vercel.app/discover). Discovery is public. Email or Google sign-in through Privy opens the participant/organizer workspace. No shared judge password is required.
3. [Inspect the latest workshop receipts](EVIDENCE.md#latest-public-workshop). Start and settlement were broadcast through CRE CLI simulation; the paid claim is a separate public transaction.
4. [Watch the CRE demo](https://www.youtube.com/watch?v=NJs1KMFsMWQ) (1:56) and open [the workflow](../cre/commitpass/workflow.ts). Compare the report execution with the vault's receiver and final allocation events.
5. [Read the settlement policy](../contracts/SETTLEMENT.md). Distinguish normal attendance, valid zero-attendance refunds, and cancellation before start.

## Try the live product

1. Open Discover and sign in with email or Google. The app uses a Privy embedded wallet.
2. For a reservation, obtain Circle testnet USDC through the workspace's Faucet links. The deployed web app requests Privy gas sponsorship for its embedded wallets on Monad testnet. Review the wallet's fee display before confirming. Direct transactions, including external organizer wallets, still require testnet MON. Use test funds only.
3. As an organizer, create an event with future registration, start, and settlement times, a capacity, and a fixed USDC commitment. Its vault is created onchain; metadata is stored by the API.
4. As a guest, reserve a spot, approve the required USDC amount, confirm the deposit, and open the QR pass. Use a separate account to evaluate the host/guest experience.
5. As the host, open Manage event. Request Start or wait for scheduled eligibility. The server-operated CRE runner processes eligible work. After onchain start, scan the guest's QR pass before the attendance cutoff.
6. Request End or wait for the settlement schedule. After CRE execution and confirmed settlement, the attendee can claim from the event page. Open Activity to inspect transaction references.

Scheduled execution depends on the active runner and chain confirmation. The cron sweep processes two vaults per invocation; a larger registry can take several minutes to cycle. A host request signals eligibility; it does not itself perform the financial settlement. If the API or automation is unavailable, settlement remains pending rather than assuming empty attendance.

If no upcoming event is visible, use the recorded demo and public receipt trail, or create a test event. An empty current discovery list is not a recorded adoption metric.

## Code tour by integration

| Question                                                | Source                                                                                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How does Privy enable ordinary email/Google onboarding? | [Auth components](../apps/web/src/components/auth/) and [server token verification](../api/internal/auth/privy.go)                                                                                  |
| Who can record attendance?                              | [Application routes](../api/internal/application/routes.go), [participant attendance](../api/internal/application/participant.go), and [snapshot freezing](../api/internal/application/snapshot.go) |
| How is real chain data used in the app?                 | [Envio handlers](../indexer/src/handlers/commitpass.ts), [hosted GraphQL reader](../api/internal/indexed/hosted.go), and [wallet profile aggregation](../api/internal/indexed/wallet-profile.go)    |
| What does CRE orchestrate?                              | [Triggers and lifecycle decisions](../cre/commitpass/workflow.ts), [snapshot validation](../cre/commitpass/attendance.ts), and [explicit simulation signing](../cre/commitpass/simulation.ts)       |
| Where are payout rules enforced?                        | [Event vault](../contracts/src/CommitPassVault.sol), [receiver](../contracts/src/cre/ReceiverTemplate.sol), and [settlement policy](../contracts/SETTLEMENT.md)                                     |
| Which deployment is active?                             | [Canonical manifest](../packages/shared/src/deployments/monad-testnet.json) and [deployment guide](../contracts/DEPLOYMENT.md)                                                                      |

## Scope to keep in mind

- The public app targets Monad testnet and a mock ERC-4626 yield source.
- CRE runs as a server-operated CLI broadcast simulation. A deployed Workflow DON is not claimed.
- Attendance is organizer-attested. QR scanning does not independently prove physical attendance. A formal correction/dispute workflow is pending.
- The latest public workshop demonstrates one attendee receiving principal back. Multi-participant no-show redistribution and exceptional policies have separately recorded local fixture evidence.
- There is no measured independent customer pilot or demonstrated no-show reduction yet.
- Gas sponsorship is configured as a testnet-only transaction path; a user-approved sponsored receipt is required for live acceptance. An audited production release and guaranteed recovery from unavailable liquidity or losses are not claimed.

[Product pitch](https://www.youtube.com/watch?v=63YxHvnsKsY) · [Documentation](https://sama-3.gitbook.io/commitpass-docs/documentation/) · [Local development](DEVELOPMENT.md)
