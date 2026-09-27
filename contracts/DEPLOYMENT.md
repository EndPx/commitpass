# Monad testnet deployment

Deployed on chain **10143** from source commit `60bf09336d0fc83909d2bf30f53960c799f6b533`.

| Contract             | Address / verified source                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| MockAUSD             | [0xd2A8f6D7645F53aB23dC3EcB146a196026F964DA](https://testnet.monadscan.com/address/0xd2A8f6D7645F53aB23dC3EcB146a196026F964DA#code) |
| MockYieldVault       | [0x054F6A7CE03fdEB7814977B0FE7017cc5B2d7DA2](https://testnet.monadscan.com/address/0x054F6A7CE03fdEB7814977B0FE7017cc5B2d7DA2#code) |
| CommitPassFactory    | [0xD524e3d9E7f0B419A862B4Ad854422d573B5D651](https://testnet.monadscan.com/address/0xD524e3d9E7f0B419A862B4Ad854422d573B5D651#code) |
| CommitPassAutomation | [0x06A41268C8cA9d5ADa19b02a8E2f37A0195dC49c](https://testnet.monadscan.com/address/0x06A41268C8cA9d5ADa19b02a8E2f37A0195dC49c#code) |

All four deployment receipts succeeded. All four contracts returned **Pass - Verified** from Etherscan's verification API for Monadscan. The canonical [shared manifest](../packages/shared/src/deployments/monad-testnet.json) records transaction hashes, deployment blocks, runtime code hashes, fees and verification GUIDs.

- Deployer and testnet treasury: `0xc82f469Aa95a2f7792300c8d11230e9023A98600`.
- Earliest deployment block: `66181579`.
- Total deployment fee: `0.749741300007497413 MON`.
- Trusted deployed-workflow forwarder: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, confirmed against the authenticated CRE chain directory and chain bytecode.

## Source verification

Set `ETHERSCAN_API_KEY` in the git-ignored `contracts/.env`. Use an Etherscan API v2 key, as documented by [Monad](https://docs.monad.xyz/guides/verify-smart-contract/foundry).

```sh
forge verify-contract <address> <source.sol:Contract> \
  --chain 10143 --verifier etherscan --watch \
  --constructor-args <ABI-encoded-constructor-arguments>
```

`MockAUSD` has no constructor arguments. `MockYieldVault` takes the mock asset address. Factory takes yield vault and treasury. Automation takes forwarder and factory. The verification command reads the API key locally; do not put it in committed commands or files.

## Activation boundary

The contracts are deployed. The CRE receiver's `workflowId` remains zero until a real registered workflow ID is available. CRE deployment access and the authenticated frozen-attendance API remain prerequisites for activating the automated lifecycle. Do not configure a fabricated workflow ID or a simulation forwarder to bypass these checks.

The indexer launcher consumes this deployment manifest by default and resumes from stored progress. Its public-RPC queries are capped below the provider's 100-block range limit. API and indexer processes currently run locally; they are not a hosted application. No event has been created or settled as part of this deployment.
