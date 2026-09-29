# Lifecycle acceptance — 28 September 2026

## Monad testnet trigger/read-path check — 30 September 2026

[Public RPC cron simulation](monad-testnet-cron-2026-09-30.md) verified chain
10143 and the deployed receiver, then completed one CRE cron callback with zero
registered events. It did not broadcast, freeze attendance or execute a public
lifecycle transaction. The [repeatable command](../README.md#monad-testnet-cron-simulation)
rejects a nonempty receiver before invoking the simulator.

## Updated settlement policy — 29 September 2026

The [new local result](settlement-policy-local-2026-09-29.json) completed with
`status: passed` using freshly compiled contracts and CRE CLI/WASM on disposable
Anvil. It includes the earlier start/settle/idempotency/unavailable-API scenarios
plus two new cases:

- A valid frozen snapshot with **zero attendees** settled. Both depositors were
  allocated their full 10 mockAUSD; protocol revenue was zero.
- Cancellation before start allocated and paid back 10 mockAUSD to each of two
  depositors; protocol revenue was zero.
- Normal settlement with one attendee and one no-show allocated **16.999999
  mockAUSD** to the attendee (10 principal + 5 no-show reward + 1.999999 realized
  yield) and **5 mockAUSD** to the separate platform treasury. ERC-4626 rounded
  the 2 mockAUSD donation down by one raw unit during redemption.

Six focused Solidity checks in `contracts/test/SettlementPolicy.t.sol` passed for
normal distribution, zero attendance, cancellation/refunds, access/timing/start
request rejection and deterministic odd-unit rounding. The new result is local
simulation evidence, not an updated public deployment. The browser-operated
result below predates this policy and retains its original facts.

## Interactive application execution

[Interactive result](interactive-local-2026-09-28.json) records one complete
browser-operated flow on Anvil, using the actual Privy embedded wallet, Go API,
isolated Neon schemas, Envio HyperIndex and CRE CLI/WASM:

1. Fund the signed-in wallet locally and create **Local workshop walkthrough**.
2. Approve and deposit **5 mockAUSD** through Privy; the event pass appears.
3. Request Start through the host UI; CRE executes the yield deposit.
4. Record attendance through the owner-authorized Go endpoint in Neon.
5. Request End; CRE fetches the real API's frozen snapshot and settles.
6. Claim **5 mockAUSD** through Privy; Envio records one settled attendee and claim.

The same account acted as organizer and participant for this walkthrough. No
additional yield was donated. The result contains local transaction references
and the indexed snapshot digest, with wallet identity omitted. This demonstrates
the connected local app flow, not a public Monad or deployed-DON execution.

The walkthrough also exposed and fixed the host confirmation dialog covering
Privy's wallet dialog; the app dialog now closes when wallet confirmation begins.

## Local execution

Command: `pnpm --filter @commitpass/cre local`

[Result](local-lifecycle-2026-09-28.json) completed at
`2026-09-28T13:24:23.059Z` with `status: passed`.

- Manual start and scheduled start executed through the CRE CLI/WASM workflow.
- Repeating start did not deposit funds again.
- An unavailable attendance response failed execution and left settlement pending.
- Restoring the frozen snapshot allowed settlement.
- Repeating settlement preserved the allocation.
- The attendee claimed **21.9 mockAUSD** (`21900000` raw units).
- Scheduled settlement completed on a second event.

These are **local Anvil receipts with an explicit simulator forwarder fixture**.
They do not prove a deployed DON, public Monad execution, Privy browser
transactions, the authenticated Go/Neon attendance flow, or organic yield.
The local snapshot endpoint is a fixture. No private keys are persisted here.

## Public activation observations in the same work session

- `cre whoami`: deployment access **Not enabled**.
- `cre workflow list --output json --non-interactive`: no registered workflows.
- Monad testnet receiver `0x06A41268C8cA9d5ADa19b02a8E2f37A0195dC49c`
  `workflowId()`: zero.
- Go API `/v1/events`: successfully returned `source: envio`, chain 10143,
  and an empty event list after the local API was restarted.
- The current attendance URL is loopback. A deployed workflow requires a hosted,
  reachable HTTPS endpoint and its attendance secret provisioned through CRE.

Public create → reserve → check-in → CRE settlement → claim acceptance is blocked
until actual deployment access, reachable API hosting, registered workflow ID and
receiver configuration are available. No fabricated ID, public mock forwarder,
legacy non-automated event or authorization bypass was used to work around this.
