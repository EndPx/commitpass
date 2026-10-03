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

[Monad testnet](monad-testnet.md) contains the active addresses, source verification and manifest. [Live execution](live-execution.md) records confirmed receipts. Historical networks and deployments from reference projects are not CommitPass deployment evidence.

Mainnet and additional-chain deployment are not claimed. Test tokens have no financial value; the current yield source is a mock.
