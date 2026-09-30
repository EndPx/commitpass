---
description: Current network, token and active contract addresses.
---

# Monad testnet deployment

| Setting          | Value                                      |
| ---------------- | ------------------------------------------ |
| Network          | Monad testnet                              |
| Chain ID         | `10143`                                    |
| Public RPC       | `https://testnet-rpc.monad.xyz`            |
| Commitment token | Circle native testnet USDC                 |
| USDC decimals    | `6`                                        |
| Gas token        | Testnet MON                                |
| CRE execution    | VPS-operated CLI simulation with broadcast |

## Active contracts

| Contract                       | Address                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| USDC                           | [`0x534b2f3A21130d7a60830c2Df862319e593943A3`](https://testnet.monadexplorer.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3) |
| CommitPassFactory              | [`0x4De2d5a126fAFBbd488251E98C1706165730746C`](https://testnet.monadexplorer.com/address/0x4De2d5a126fAFBbd488251E98C1706165730746C) |
| MockYieldVault                 | [`0xA0e884769DF132a80e951010eC6c88712b8275E9`](https://testnet.monadexplorer.com/address/0xA0e884769DF132a80e951010eC6c88712b8275E9) |
| CommitPassSimulationAutomation | [`0x6edf064f8cb13d5295182e452925628582f03a98`](https://testnet.monadexplorer.com/address/0x6edf064f8cb13d5295182e452925628582f03a98) |
| Simulation MockForwarder       | [`0xB9F79d863261869B234c481D1f9A7af84AeAd192`](https://testnet.monadexplorer.com/address/0xB9F79d863261869B234c481D1f9A7af84AeAd192) |

Circle lists this USDC address in its [official registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). Testnet USDC has no financial value and is not backed by real dollars.

## Deployment evidence

The factory and mock yield vault were deployed from source commit `ec4653c635bb6e85820cda1c706dfd31aa0c954f`. The signed simulation receiver was deployed from `9be9d0cff95906338952dbd5ee9bcb1e1c75044f`.

The [active manifest](https://github.com/EndPx/commitpass/blob/main/packages/shared/src/deployments/monad-testnet.json) records deployment receipts, blocks and runtime hashes. The simulation receiver deployment transaction is [0x7490…582bf](https://testnet.monadexplorer.com/tx/0x7490fbd7c438edebbc2bc9dd12a2d011a84b2722ee0aaacb71b21aa516a582bf).

## Preserved DON receiver

The original production-authorized receiver at `0xC7c6FaD1C2A0e8961E34D40c39C059ECE6dBB8Cc` remains unconfigured. Its production forwarder is `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`. It is preserved in a separate manifest and is not the receiver used by the active app.

Old mock-token deployments and local fixture evidence retain their original identifiers. They should not be combined with current Circle USDC totals.

## Application links

- [Frontend](https://commitpass-kappa.vercel.app/)
- [Discover](https://commitpass-kappa.vercel.app/discover)
- [API health](https://commitpass-api.endpx.cloud/health)
- [Completed event](https://commitpass-kappa.vercel.app/events/0x900ef7f431c1d2344cf07e67a018b252df60ce63)
