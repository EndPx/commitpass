---
description: Open the event lifecycle and record organizer-attested attendance.
---

# Event Start and Attendance

An organizer can request an early start when at least one guest has committed. The scheduled start also establishes eligibility. The request closes registration; the event becomes active when the authorized start report executes.

```mermaid
flowchart LR
    Request[Organizer request] --> Eligible[Vault eligible to start]
    Schedule[Scheduled start with deposits] --> Eligible
    Eligible --> CRE[CRE reads finalized state]
    CRE --> Report[Forwarder delivers report]
    Report --> Active[Vault deposits pooled funds and becomes active]
```

## Continuous QR check-in

```mermaid
sequenceDiagram
    participant Guest as Guest pass
    participant Scanner as Organizer scanner
    participant API as Check-in API
    participant Chain as Finalized chain state
    participant DB as Application database
    Guest->>Scanner: Present reservation QR
    Scanner->>API: Authenticated check-in request
    API->>Chain: Validate owner, vault, deposit and cutoff
    API->>DB: Insert attendance or return existing record
    DB-->>Scanner: Confirmed attendance
    Scanner-->>Guest: Name-based checked-in notification
    Note over Scanner: Camera remains ready for next guest
```

The API requires the organizer's verified account, a registered vault, deposited membership, an active event and time before the cutoff. The server supplies timestamps. Duplicate requests are idempotent.

A decoded QR alone is not success. The name notification appears after API confirmation; failures keep attendance unconfirmed. Desktop notifications appear at bottom-right and phone notifications at the top.

Attendance is append-only in this version. The organizer attests presence; the QR does not replace that trust assumption.
