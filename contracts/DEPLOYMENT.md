# Monad testnet direct vault deployment

The current factory is **0x94f7408816cc9eAB7e5043E92bdDdDAFf3A9931F**, deployed on chain 10143 from source commit `894a5ee`.

- Deployment transaction: [0xff0b0cd82dd737767f82cdd28f81d691351e82fa303854b0949100c81026c3f3](https://testnet.monadscan.com/tx/0xff0b0cd82dd737767f82cdd28f81d691351e82fa303854b0949100c81026c3f3).
- Deployment block: `67091536`.
- Factory source: [Pass - Verified](https://testnet.monadscan.com/address/0x94f7408816cc9eAB7e5043E92bdDdDAFf3A9931F#code).
- USDC: Circle's existing Monad testnet asset, `0x534b2f3A21130d7a60830c2Df862319e593943A3` (6 decimals).
- Yield vault: existing verified mock `0xA0e884769DF132a80e951010eC6c88712b8275E9`.
- Treasury/deployer: `0xc82f469Aa95a2f7792300c8d11230e9023A98600`.
- MockForwarder: `0xB9F79d863261869B234c481D1f9A7af84AeAd192`.
- Immutable simulation report signer: `0x8FA244d58Ac61Fc773cB83045f312A30bdC6bfe5`.

Each created event vault is its own CRE consumer. There is no separately deployed lifecycle automation contract. `createEvent` receives `settleAt` and installs all immutable lifecycle permissions atomically. The VPS uses the isolated `envio_usdc_vault` indexer namespace, preserving earlier namespaces.

Execution is signed CRE CLI `--broadcast` simulation, not deployed DON execution. The current workflow ID is intentionally zero in this signed simulation mode; no production workflow identity is invented. A future standard DON deployment requires its actual workflow identity and the production forwarder in a new immutable factory configuration.

Source verification is checked per address. `bash script/verify-vault.sh 0xVault` reconstructs public constructor arguments for a created vault. An implementation source verified at one address does not guarantee exact verification at every later address.

The [active shared manifest](../packages/shared/src/deployments/monad-testnet.json) records public configuration, receipts and runtime hashes. [Earlier deployment records](DEPLOYMENT-LEGACY.md) and prior browser evidence describe historical immutable contracts, not this release.

## Verified browser-created vault

The frontend-created event vault **0x5f50AD692ee6e5196d7186b2A57C637E46B9e3A8** is [Pass - Verified](https://testnet.monadscan.com/address/0x5f50AD692ee6e5196d7186b2A57C637E46B9e3A8#code). Its exact constructor was reconstructed by `script/verify-vault.sh`.

The single-attendee browser journey completed create, deposit, organizer start request, CRE broadcast start, check-in, organizer end request, CRE broadcast settlement and claim. Commitment, allocation and claimed amounts were 100,000 raw USDC units. Platform revenue and yield were zero. The wallet's USDC balance returned from 0.9 to 1 USDC on claim; the vault's remaining USDC balance was zero.

[Receipt, snapshot and accounting evidence](../cre/evidence/frontend-direct-vault-2026-10-01.json) records the exact scope. Both CRE writes were from the simulation signer through the official MockForwarder, with `LifecycleExecuted` emitted by the event vault itself. This is testnet broadcast simulation, not a public DON deployment.
