# CommitPass contracts

## Structure

- `CommitPassFactory` creates each vault with an immutable organizer, schedule, yield vault, treasury and CRE authorization. The only creation entry point is `createEvent(stakeAmount, registrationDeadline, eventDate, maxParticipant, settleAt)`.
- `CommitPassVault` holds USDC commitments, receives CRE reports directly and allocates claims. Source groups configuration, events, construction, participant actions, organizer actions, internal execution and views.
- `cre/ReceiverTemplate.sol` is an abstract receiver base compiled into each vault. It adapts Chainlink's consumer pattern with immutable permissions; it is not a separately deployed contract.
- `interfaces/` contains external interfaces. `mocks/MockYieldVault.sol` contains local USDC fixtures and the testnet ERC-4626 yield mock.

## Authorization and lifecycle

Only the original organizer can call `requestStart()`, `requestSettlement()` or cancel before start. Organizer ownership cannot be transferred or renounced. Requests emit a factory log that wakes CRE. The configured forwarder is the only caller of `onReport`.

A deployed standard CRE workflow uses the production forwarder and its actual nonzero workflow ID in metadata. Testnet CLI broadcasts use the official MockForwarder and a vault/chain-bound EIP-712 signature from an immutable operator signer. The public MockForwarder alone grants no financial authority. Immutable authorization is established before any deposit.

The consumer checks chain, target vault, report expiry, timing, cutoff, snapshot hash, sorted unique attendees and deposited membership. Repeated starts and identical settlements do not repeat financial actions. Scheduled execution and organizer requests use the same report path.

Attendance remains organizer-attested. Its snapshot digest identifies the data used; it does not prove physical presence.

## Financial policy

At normal settlement, treasury receives floor(no-show principal / 2). Attendees receive all remaining assets, including recovered yield. Zero attendance refunds all depositors without a platform fee. Cancellation before start opens exact principal claims. Raw-unit remainders are assigned in registration order. Share transfers do not transfer participant claims; the event vault is not itself ERC-4626.

The commitment asset is Circle's Monad testnet USDC (`0x534b2f3A21130d7a60830c2Df862319e593943A3`, 6 decimals). The yield vault remains a mock. Redemption failure or recovered balance below committed principal reverts settlement; loss recovery and active-event cancellation are not implemented. Capacity is capped at 500.

## Build, deploy and verify

```sh
git submodule update --init --recursive
cd contracts
forge build
forge test
```

Compiler: Solidity 0.8.28, Cancun, optimizer 200, via IR. `.env.example` lists public deployment inputs and the verifier credential reference. Existing Foundry keystores are consumed by native CLI options without exporting private keys.

- `script/DeployCommitPassFactory.s.sol` deploys the factory on Monad testnet.
- `script/DeployCommitPassVault.s.sol` creates a vault through that factory, ensuring registration and authorization are atomic.
- `script/verify-vault.sh` reads a created vault's public immutable/configuration fields and verifies its exact 12-argument constructor. Verifying one address does not guarantee automatic exact verification of later addresses.
- `test/DeploymentScripts.t.sol` executes both Solidity deployment scripts and checks their results.
- `test/SettlementPolicy.t.sol` exercises the real vault's financial and authorization rules; `test/SimulationReport.t.sol` checks signed broadcast authorization and domain isolation. The inherited `CommitPassVault.t.sol` tests an older independent mock and is not evidence for the new receiver path.

See [CRE configuration](../cre/README.md), [deployment records](DEPLOYMENT.md) and [settlement policy](SETTLEMENT.md).
