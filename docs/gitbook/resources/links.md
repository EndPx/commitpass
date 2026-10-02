---
description: Application links, implementation evidence and primary references.
---

# Links and references

## CommitPass

- [Application](https://commitpass-event.vercel.app/)
- [Discover events](https://commitpass-event.vercel.app/discover)
- [Completed demo event](https://commitpass-event.vercel.app/events/0x5f50ad692ee6e5196d7186b2a57c637e46b9e3a8)
- [Source repository](https://github.com/EndPx/commitpass)
- [Current deployment manifest](https://github.com/EndPx/commitpass/blob/main/packages/shared/src/deployments/monad-testnet.json)
- [Live execution evidence](https://github.com/EndPx/commitpass/blob/main/cre/evidence/frontend-monad-broadcast-2026-10-01.json)

## Network and faucets

- [Monad testnet explorer](https://testnet.monadscan.com/)
- [Circle USDC address registry](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Circle testnet USDC faucet](https://faucet.circle.com/)
- [Monad testnet MON faucet](https://faucet.monad.xyz/)

## Chainlink CRE

- [Trigger capability](https://docs.chain.link/cre/capabilities/triggers)
- [Trigger and callback overview](https://docs.chain.link/cre/guides/workflow/using-triggers/overview)
- [EVM log triggers](https://docs.chain.link/cre/guides/workflow/using-triggers/evm-log-trigger-ts)
- [CLI workflow commands](https://docs.chain.link/cre/reference/cli/workflow)
- [Building consumer contracts](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts)

## Implementation lineage

CommitPass adapts ATFI's event commitment mechanism and uses ShowOrSow as an application-flow reference. The docs' compact introduction, flow and technical sections take inspiration from ATFI's documentation structure.

- [ATFI documentation](https://atfi.gitbook.io/atfi-docs)
- [ATFI contract reference, pinned source](https://github.com/ATFi-Event/smart-contract/tree/1c57d35b80bb67afc04ee3d9a26292721695aed5)
- [ATFI backend reference, pinned source](https://github.com/ATFi-Event/backend/tree/3413119726c2fd3038253020f940378c192ae2b6)
- [ShowOrSow frontend reference, pinned source](https://github.com/EndPx/ShowOrSow/tree/8fbe3f04a05eb19eca10710173057f65d9aadf84/web)
- [EcoRound CRE reference, pinned source](https://github.com/eco-round/cre/tree/771eb69dbc8d092975104421bb21ca6c276ff5a6)

ATFI's Base deployment, Goldsky/Supabase architecture and earlier fee policy do not describe the active CommitPass release. CommitPass uses Monad, Envio, Neon, Privy and CRE with the payout policy explained in these docs.
