---
description: What is working in the current testnet release and what remains separate.
---

# Deployment status

Status recorded **2 October 2026**. Runtime availability can change; use the app and receipt links to inspect the current state.

## Available

| Area          | Current implementation                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- |
| Application   | Hosted Next.js frontend, discovery, event editor, guest pass, host management and profile |
| Accounts      | Privy authentication and embedded wallet transaction signing                              |
| Asset         | Circle native Monad testnet USDC                                                          |
| Contracts     | Factory, dedicated event vaults, mock yield source; each vault is its own CRE consumer          |
| Attendance    | Owner-authorized check-ins and immutable snapshots through the Go API                     |
| Indexing      | Hosted Envio event, participant, activity and profile reads                               |
| CRE execution | Recurring VPS simulation with real testnet broadcast                                      |
| Main flow     | Completed one-attendee frontend journey through claim                                     |

## Execution boundaries

**CRE:** The CLI/WASM workflow runs from a VPS timer. Each active vault accepts signed simulation reports through its immutable forwarder. A deployed Workflow DON is not active.

**Yield:** The current vault is a mock ERC-4626 fixture. There is no live Morpho/Clearstar allocation or organic yield in this release.

**Attendance:** The organizer remains the attendance authority. The backend and contracts validate identity, timing and consistency, not physical presence.

**Testing scope:** The live browser run validates the primary one-attendee flow. The contract policy includes no-show sharing, eligible cancellation and zero-attendance refunds; this documentation does not claim those outcomes have all been exercised through the hosted browser.

**Security:** Source verification and successful receipts are evidence of deployed code and execution. An independent security audit is not claimed.

## Next development directions

- Keep the main event journey clear and reliable for guests and hosts.
- Move CRE to a deployed workflow when access and operational setup are available.
- Evaluate a compatible real yield source, including liquidity and loss handling.
- Measure whether commitments improve attendance before making outcome claims.

These are development directions, not dated delivery promises.
