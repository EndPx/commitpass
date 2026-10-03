---
description: Current chain configuration and the boundary of deployment evidence.
---

# Chains

The active application uses **Monad testnet**, chain ID **10143**, Circle native testnet USDC and MON for transaction gas.

```mermaid
flowchart TB
    Network[Monad testnet 10143] --> Factory[CommitPassFactory]
    Factory --> Vault[Dedicated event vault and CRE consumer]
    USDC[Circle testnet USDC] --> Vault
    Vault --> Yield[Mock ERC-4626 source]
    Forwarder[Simulation MockForwarder] --> Vault
    Vault --> Guest[Original depositor claims USDC]
```

[Monad Testnet](monad-testnet.md) contains the network configuration and active contract addresses.

Mainnet and additional-chain deployment are not claimed. Test tokens have no financial value; the current yield source is a mock.
