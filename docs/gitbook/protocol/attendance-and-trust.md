---
description: What the organizer attests and what the backend, CRE and contracts enforce.
---

# Attendance and trust

CommitPass uses **organizer-attested attendance**. The organizer decides which committed guests are present. The rest of the system validates the identity, timing, snapshot and financial consequences of that decision.

## Check-in authorization

The Go API verifies the Privy session and current wallet links. For a check-in write it also reads finalized chain state to verify:

- The vault belongs to the configured factory.
- The authenticated wallet is the current event owner.
- The participant deposited into that event.
- The event has started and has not finalized.
- The check-in is before the contract's cutoff.

The server supplies timestamps and actor identity. Repeated check-in calls are idempotent for the same event and wallet.

## An immutable snapshot

At settlement, the backend freezes one snapshot containing the chain ID, vault address, event ID, cutoff and sorted attendee addresses. It rechecks deposited membership and computes:

```text
keccak256(abi.encode(chainId, vault, eventId, cutoff, attendees))
```

Check-in and freeze operations are serialized. Database protections reject changes to check-ins and saved snapshots. An existing snapshot is returned unchanged on retry, and its finalized chain anchor is checked when read.

## CRE validation

The workflow checks the response version, event domain, cutoff, frozen state, address ordering and digest. Failed API requests, malformed responses and disagreement defer settlement. They do not become zero attendance.

## Contract enforcement

The vault receiver checks the immutable forwarder and report authorization, schedule, expiry, action, snapshot hash and membership. The same vault performs redemption, allocations and payouts.

## Remaining trust

The contract can validate that an attendee deposited; it cannot prove they were physically present. QR check-in is not an independent attendance oracle. Backend immutability protects the record after capture, but cannot establish that the organizer's original attendance attestation was truthful.

The current simulation operator also controls the immutable report signing key and runtime availability. [Chainlink CRE](../technical/chainlink-cre.md) describes that execution boundary. Source verification is separate from an independent security audit; no independent audit is claimed.
