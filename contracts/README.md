# CommitPass contracts

Based on [ATFI at 1c57d35](https://github.com/ATFi-Event/smart-contract/tree/1c57d35b80bb67afc04ee3d9a26292721695aed5), extended for configurable ERC-4626 yield and CRE execution. The initial naming-only port remains in commit `3710d47`.

## Contracts

- `CommitPassFactory(yieldVault, treasury)` creates event vaults with fixed deployment configuration; `vaultByEventId` exposes their addresses.
- `CommitPassVault` accepts the configured yield vault's asset. Start deposits pooled assets; settlement redeems the entire share balance, charges the inherited 5% fee on positive realized yield and allocates attendee claims.
- `CommitPassAutomation(forwarder, factory)` accepts CRE reports. Its deployer configures a nonzero workflow ID once. The application calls `factory.createAutomatedEvent(..., receiver, settleAt)` to create the vault and attach its immutable schedule atomically. The internal setup uses `vault.setAutomation`, callable only by its owner or creating factory before deposits. Only the receiver can start/settle once configured.
- `mocks/MockYieldVault.sol` supplies faucet-funded mockAUSD (6 decimals) and a mock ERC-4626 vault, restricted to chain IDs 10143/31337. No real AUSD, Clearstar investment or organic yield is involved.

## Authorization

Manual requests and timestamps converge on one report path. Receiver checks the trusted forwarder, workflow ID in 64-byte metadata, chain ID, expiry, schedule, snapshot digest, sorted unique attendees and deposited membership. Duplicate start and identical settlement reports are no-ops; conflicting settlements revert. Deposits after start are rejected. Automation supports up to 500 participants per event.

Attendance remains organizer-attested. A digest identifies the data used; it does not establish physical attendance.

## Build and configuration

```sh
git submodule update --init --recursive
cd contracts
forge build
```

Solidity 0.8.28, Cancun, optimizer and `via_ir`. Dependencies remain pinned to forge-std `8bbcf6e3f8f62f419e5429a0bd89331c85c37824` and OpenZeppelin `c64a1edb67b6e3f4a15cca8909c9482ad33a02b0`.

`.env.example` lists deployment inputs. `script/DeployTestnet.s.sol` prepares mock assets, factory and receiver, rejecting chains other than Monad testnet. Compiling sends no transactions. Individual factory/vault scripts use `YIELD_VAULT`, `TREASURY`, and for standalone vaults `ORGANIZER`. A standalone vault cannot use the factory-validated automation registry.

`DeployTestnet` uses `DEPLOYER_ADDRESS` with Foundry's encrypted keystore options (`--account`, `--password-file`, and the matching `--sender`). It does not read or export a raw private key. Supply the chosen treasury and verified deployed-workflow forwarder explicitly.

See [CRE setup and snapshot API specification](../cre/README.md).

## Limits

- Factory, receiver and mock assets are deployed and verified on Monad testnet. See [deployment evidence](DEPLOYMENT.md). The CRE workflow is not activated yet.
- Redemption failure or recovery below committed principal reverts settlement. This preserves nominal refund accounting but does not solve permanent loss or unavailable liquidity.
- Automated zero-attendee settlement is deferred. Cancellation/refund/recovery needs a policy; legacy owner-operated vaults retain inherited empty-attendance behavior.
- Rounding dust remains in the vault. ERC-20 share transfers do not transfer participant claims; this event contract is not itself ERC-4626.
- The inherited vault suite exercises a separate mock with simulated yield. It does not cover this receiver or establish live Morpho compatibility. Only the factory fixture was adapted for its constructor dependencies; no new tests were added or executed in this turn.
