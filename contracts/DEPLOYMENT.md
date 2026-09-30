# Monad testnet USDC deployment

Deployed on chain **10143** from contract source commit `ec4653c635bb6e85820cda1c706dfd31aa0c954f`.
The commitment asset is Circle's existing native testnet USDC, verified against
[Circle's address registry](https://developers.circle.com/stablecoins/usdc-contract-addresses)
and live RPC reads of its USDC symbol and 6 decimals. No mock commitment token
was deployed for this release.

| Contract             | Address / source                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| USDC                 | [0x534b2f3A21130d7a60830c2Df862319e593943A3](https://testnet.monadscan.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3#code) |
| MockYieldVault       | [0xA0e884769DF132a80e951010eC6c88712b8275E9](https://testnet.monadscan.com/address/0xA0e884769DF132a80e951010eC6c88712b8275E9#code) |
| CommitPassFactory    | [0x4De2d5a126fAFBbd488251E98C1706165730746C](https://testnet.monadscan.com/address/0x4De2d5a126fAFBbd488251E98C1706165730746C#code) |
| CommitPassAutomation | [0xC7c6FaD1C2A0e8961E34D40c39C059ECE6dBB8Cc](https://testnet.monadscan.com/address/0xC7c6FaD1C2A0e8961E34D40c39C059ECE6dBB8Cc#code) |

All three new deployment receipts succeeded. MockYieldVault, CommitPassFactory,
and CommitPassAutomation returned **Pass - Verified** through Etherscan's
verification API. The [shared manifest](../packages/shared/src/deployments/monad-testnet.json)
records receipts, blocks, runtime hashes, fees, and verification GUIDs.

- Earliest deployment block: `66933185`.
- Total deployment fee: `0.784383831007615377 MON`.
- Deployer/treasury: `0xc82f469Aa95a2f7792300c8d11230e9023A98600`.
- Trusted CRE forwarder: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`.
- Onchain reads confirmed yield-vault asset = USDC, factory yield-vault binding,
  receiver factory binding, workflow ID = zero, and receiver vault count = zero.

## Yield and lifecycle boundary

MockYieldVault is an ERC-4626 test fixture backed by native testnet USDC. It does
not invest in Morpho/Clearstar or generate organic yield. Testnet USDC has no
monetary value. The current vault code contains cancellation refunds,
zero-attendance refunds, and the immutable 50% split of no-show principal.
Participants collect allocated funds through `claimReward()`.

The original DON receiver remains unconfigured and is preserved in the
[DON manifest](../packages/shared/src/deployments/monad-testnet-don-unconfigured.json).
The active application uses a separate Monad-testnet-only
`CommitPassSimulationAutomation` at `0x6edf064f8cb13d5295182e452925628582f03a98`.
Its deployment transaction is
[0x7490…582bf](https://testnet.monadscan.com/tx/0x7490fbd7c438edebbc2bc9dd12a2d011a84b2722ee0aaacb71b21aa516a582bf).
It validates the official Monad simulation MockForwarder
`0xB9F79d863261869B234c481D1f9A7af84AeAd192` and a receiver/chain/payload-bound
EIP-712 signature from the immutable operator signer. It does not fabricate a
DON workflow ID. The parent receiver retains production workflow authorization;
schedule, membership, cutoff, snapshot, expiry and accounting checks are shared.

Live frontend/Privy creation, commitment, check-in, CRE start/settlement broadcast
and claim completed for one attendee. See
[receipt and accounting evidence](../cre/evidence/frontend-monad-broadcast-2026-10-01.json).
This is a VPS-operated CRE CLI simulation, not deployed DON execution.

## Source verification

`forge verify-contract` reads the local Etherscan key from ignored configuration.
MockYieldVault's constructor takes the native USDC address; factory takes yield
vault and treasury; receiver takes forwarder and factory. Never commit API keys.

## Historical deployment

The earlier mockAUSD deployment is preserved in the
[legacy manifest](../packages/shared/src/deployments/monad-testnet-legacy-mock-ausd.json).
RPC checks before migration confirmed its factory event counter was 1 and its
receiver had zero vaults. Historical local proofs retain their original asset
identifiers. Envio's USDC runtime uses a separate `envio_usdc` namespace so these
assets are not added together in profile financial totals.
