---
description: The application, financial contracts and data services around one event.
---

# Overview

CommitPass separates financial execution, attendance records and indexed reads.

## Component map

![Excalidraw component map showing the frontend, Privy, factory, event vault, API, CRE, forwarder, yield source, Neon and hosted Envio.](../assets/diagrams/commitpass-system.png)

[Editable Excalidraw file](https://github.com/EndPx/commitpass/blob/main/docs/gitbook/assets/diagrams/commitpass-system.excalidraw) · [Vector SVG](https://github.com/EndPx/commitpass/blob/main/docs/gitbook/assets/diagrams/commitpass-system.svg)

Terracotta boxes are financial components, blue boxes represent identity and data services, and green boxes show actors or report delivery. The sketch identifies responsibilities; the Mermaid view below makes the complete data relationships explicit.

```mermaid
flowchart TB
    User[Guest or organizer] --> Web[Next.js app on Vercel]
    Web --> Privy[Privy authentication and signing]
    Privy --> Vault[Monad event vault and CRE consumer]
    Factory[Monad factory] --> Vault
    Web --> API[Go API on VPS]
    API --> AppDB[Neon application records]
    Factory --> Envio[Hosted Envio HyperIndex]
    Vault --> Envio
    Envio --> GraphQL[Hosted indexed GraphQL]
    GraphQL --> API
    Timer[VPS timer] --> CRE[CRE CLI broadcast simulation]
    CRE --> API
    CRE --> Forwarder[Simulation MockForwarder]
    Forwarder --> Vault
```

## Financial execution

The factory creates a dedicated vault per event. Guests deposit directly into it. The same vault receives authenticated CRE reports, supplies or redeems yield shares, fixes allocations and transfers claims. There is no separate lifecycle automation contract in the active deployment.

Privy provides authentication and wallet signing. The Go API does not hold participant private keys or replace participant signatures.

## Attendance and metadata

The Go API stores chosen display names, descriptions, covers, themes, check-ins and immutable snapshots in Neon. Organizer writes require verified identity and current event ownership. QR scanning automatically requests check-in; the API enforces deposited membership and the attendance window.

A metadata row is not proof of deposit, settlement or payout.

## Indexed reads

The active indexer is hosted in the EndPx Envio organization. It discovers vaults from factory logs and materializes events, participants, allocations, claims and activity. The Go API reads hosted GraphQL. The earlier self-hosted indexer is stopped.

Profiles and vault cards use indexed records. Financial actions also read current contract state. An allocation is distinct from a completed payout.

## CRE runtime

A VPS timer invokes CRE CLI simulation with broadcast. Cron reads bounded factory batches and an EVM log callback processes organizer requests. Both share lifecycle processing. Reports travel through the MockForwarder directly to the event vault.

This is real Monad testnet execution through signed simulation. A Workflow DON deployment and organic yield are not active.

| Component | Hosting |
| --- | --- |
| Frontend | Vercel |
| API and CRE CLI timer | VPS |
| Application records | Neon |
| Active indexer and indexed GraphQL | Hosted Envio |
| Factory, event vaults and mock yield source | Monad testnet |

[Smart contracts](smart-contracts.md) · [CRE](chainlink-cre.md) · [Envio](envio-and-profiles.md)

## Read the overview before the implementation details

```mermaid
flowchart LR
    UI[Application and wallets] --> Identity[Privy and API identity]
    Identity --> Finance[Factory and event vaults]
    Finance --> Automation[CRE reports and forwarder]
    Finance --> Reads[Envio hosted read model]
    Identity --> Attendance[Neon attendance and metadata]
    Attendance --> Automation
    Reads --> UI
```

| Detail page | Part of the big picture |
| --- | --- |
| [Smart Contract Architecture](smart-contracts.md) | Factory, vault, external yield source and immutable report authorization |
| [Chainlink CRE Workflow](chainlink-cre.md) | Trigger discovery, snapshot validation and report delivery |
| [Data Flow and Indexing](envio-and-profiles.md) | Logs, entities, GraphQL, vault cards and profile aggregates |
| [API and Application Data](api-and-data.md) | Identity, metadata, chosen names, attendance and frozen snapshots |
| [Authorization and Trust Boundaries](authorization.md) | Permissions for each actor and remaining assumptions |

Read the diagram as a map of responsibilities. Each child page explains the corresponding interfaces, state and failure boundaries.
