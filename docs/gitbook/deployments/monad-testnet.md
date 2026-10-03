---
description: Current network, token and active contract addresses.
---

# Monad testnet deployment

Active direct-vault configuration, recorded on **2 October 2026**.

| Setting | Value |
| --- | --- |
| Network / chain ID | Monad testnet / 10143 |
| RPC | https://testnet-rpc.monad.xyz |
| Commitment asset | Circle native testnet USDC, 6 decimals |
| Gas asset | Testnet MON |
| CRE execution | Signed CLI broadcast simulation |

## Active Contracts

| Component | Address |
| --- | --- |
| Factory | [0x94f7408816cc9eAB7e5043E92bdDdDAFf3A9931F](https://testnet.monadscan.com/address/0x94f7408816cc9eAB7e5043E92bdDdDAFf3A9931F) |
| USDC | [0x534b2f3A21130d7a60830c2Df862319e593943A3](https://testnet.monadscan.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3) |
| Mock yield source | [0xA0e884769DF132a80e951010eC6c88712b8275E9](https://testnet.monadscan.com/address/0xA0e884769DF132a80e951010eC6c88712b8275E9) |
| Simulation MockForwarder | [0xB9F79d863261869B234c481D1f9A7af84AeAd192](https://testnet.monadscan.com/address/0xB9F79d863261869B234c481D1f9A7af84AeAd192) |
| Verified demo vault | [0x5f50AD692ee6e5196d7186b2A57C637E46B9e3A8](https://testnet.monadscan.com/address/0x5f50AD692ee6e5196d7186b2A57C637E46B9e3A8) |

Treasury: [0xc82f469Aa95a2f7792300c8d11230e9023A98600](https://testnet.monadscan.com/address/0xc82f469Aa95a2f7792300c8d11230e9023A98600). Immutable simulation signer: [0x8FA244d58Ac61Fc773cB83045f312A30bdC6bfe5](https://testnet.monadscan.com/address/0x8FA244d58Ac61Fc773cB83045f312A30bdC6bfe5).

The factory was deployed from source `894a5ee`, transaction [0xff0b…6c3f3](https://testnet.monadscan.com/tx/0xff0b0cd82dd737767f82cdd28f81d691351e82fa303854b0949100c81026c3f3), block 67091536. Each newly created vault is its own report consumer.


Verification is specific to each address. Historical factories and separate receivers are legacy evidence, not the current application configuration. Testnet tokens have no financial value and the yield source is a mock.

