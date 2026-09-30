# Hosted CommitPass

Recorded on 30 September 2026. API/indexer/CRE runtime source:
`77187b5e1559cb25979af3062247936855d9a605`. Frontend source after the compact
profile and faucet update: `f2f69733cdb6d588ec7ae9140db78afb14e42960`. Public commitments use Circle's
native Monad testnet USDC, address `0x534b2f3A21130d7a60830c2Df862319e593943A3`
(6 decimals). [Deployment and verification](../contracts/DEPLOYMENT.md).

| Component | Location                            | Runtime                                                          |
| --------- | ----------------------------------- | ---------------------------------------------------------------- |
| Frontend  | https://commitpass-kappa.vercel.app | Vercel project `commitpass`, root `apps/web`, Node 24            |
| API       | https://commitpass-api.endpx.cloud  | Hostinger VPS `1330754`, loopback port 8095 behind Nginx HTTPS   |
| Indexer   | Same VPS                            | Envio 3.12.1, public Monad testnet RPC, Neon schema `envio_usdc` |
| CRE       | Same VPS                            | CLI 1.34.0, one guarded cron simulation per minute               |

The API subdomain was absent from DNS and Nginx before creation. No frontend
custom domain was added. The Let's Encrypt API certificate renews automatically.
Existing VPS services use their previous ports and configurations.

## Release and services

Source is extracted to `/opt/commitpass/releases/<commit>`. Indexer and CRE use
the `/opt/commitpass/current` symlink. The API service points directly to its newer
release directory, built on Linux with CGO disabled. The USDC release includes
the shared manifest and regenerated indexer code. Services run as the dedicated
`commitpass` user. CRE lifecycle TypeScript did not change; its previously built
WASM was retained with the updated receiver configuration:

```sh
systemctl status commitpass-api commitpass-indexer commitpass-cre.timer
journalctl -u commitpass-api -u commitpass-indexer --since '-10 minutes'
journalctl -u commitpass-cre.service --since '-5 minutes'
curl --fail https://commitpass-api.endpx.cloud/health
curl --fail https://commitpass-api.endpx.cloud/v1/events
```

`/health` reports the deployed `RELEASE_COMMIT` and process liveness. Indexer
readiness is checked separately from `envio_usdc.envio_chains` in Neon.
The services in this folder are installed under `/etc/systemd/system`.
Nginx listens publicly on 443 and proxies only to `127.0.0.1:8095`.

Active root-readable environment files are `/etc/commitpass/api-usdc.env`,
`indexer-usdc.env`, and `cre.env`, with mode 600. The API uses
`COMMITPASS_INDEXER_SCHEMA=envio_usdc`; Envio uses `ENVIO_PG_SCHEMA=envio_usdc`.
The new namespace preserves `envio` and `envio_hosted` and keeps earlier mockAUSD
data out of USDC totals. Application data remains in `app`. No historical schema
was reset; the earlier environment files also remain available for rollback.

## Vercel

The current production deployment is `dpl_HtMekxjvnxpzs72DCSnwgSndi8VX`.
Builds first compile the shared workspace, then Next.js. `.vercelignore` excludes
the root Go/contract/indexer/CRE workspaces and local credentials while retaining
the Next.js `/api` route handlers.

Production and preview environment variables include the public Privy app ID,
login flags, server-only `COMMITPASS_API_URL`, and Cloudinary credentials.
Database credentials and the Privy app secret remain on the VPS. The app origin
is allowed in Privy alongside `http://localhost:3000`.

Deployment currently uses the authenticated CLI:

```sh
# Repository root, after linking project commitpass.
vercel deploy --prod --yes
```

Automatic GitHub deployment is not connected. Vercel's linked GitHub identity
reported insufficient write/admin access to `EndPx/commitpass`. CLI production
deployment succeeded independently of that connection.

## Verified behavior and remaining boundaries

- Frontend `/`, `/signin`, `/health`, and `/api/events` returned 200.
- Google sign-in completed, the Go session check passed, and the Events workspace
  loaded in the deployed browser. The event editor also loaded.
- The USDC release showed `Commitment 5 USDC` in the hosted editor and USDC labels
  in the profile. Builds passed for contracts, shared types, Go API, and Next.js.
  All three migration deployments returned successful receipts and Etherscan
  verification; RPC reads confirmed native USDC as the vault asset.
- Cover shuffle changes the cover and complete appearance together. The deployed
  editor showed the new grid/blue/mono preset after a click; local draft saving
  and reload preserved a workshop/aurora/green/dark preset.
- Soft gradients follow event accent and Light/Dark mode across the workspace.
  Local visual inspection covered desktop Light/Dark and a 375px mobile Light
  viewport, with no horizontal overflow.
- Events/Discover share their heading and toolbar geometry, content width, and
  date controls. Local inspection covered both pages at desktop and 375px mobile;
  filters update their active count and dismiss on Escape or an outside click.
  The mobile filter panel stayed within the viewport with no horizontal overflow.
- Profile endpoints return Envio summaries and paginated wallet positions for
  chain 10143. Financial amounts remain integer strings; public chain queries
  are parameterized and read-only. The private frontend derives its wallet filter
  from authenticated `/v1/me` and does not accept a client-selected wallet.
  Local signed-in inspection showed real zero-data charts, RPC wallet balance,
  the claimable filter, account-menu link, and a 375px layout without overflow.
  The signed-in production profile loaded its own identity and no-wallet state;
  `/api/profile` rejected missing authentication with 401. These checks exercise
  empty/read paths, not funded settlement or claim execution.
  Claim execution remains on the existing event page; settlement allocates funds
  and individual `claimReward()` calls transfer participants' returns.
- Profile defaults to Activity with compact identity/metric tiles and a financial
  strip, following the supplied Axis reference. Charts remain under Analytics.
  Local inspection put the activity heading at y=493 in a 1280x720 viewport and
  y=637 at 375x812, without horizontal overflow. The settlement paragraph was
  removed; tab keyboard navigation and verified-wallet copying were inspected.
- Header Faucet shows fixed USDC/Monad testnet and a verified linked wallet.
  Local signed-in inspection showed the correct recipient and copy confirmation.
  Circle's current form ignored the tested network/address URL parameters;
  the app copies the wallet and opens the official faucet with instructions to
  choose Monad Testnet and paste it. No Circle request was submitted, and no
  wallet was created during verification.
- The frontend `/api/session` and VPS `/v1/me` rejected missing tokens with 401.
- API and indexer services are enabled and active. The USDC indexer starts at
  block 66,933,185 and reported readiness/realtime mode in its service logs.
  Event and wallet-summary endpoints returned valid empty Envio data for 10143.
- The authenticated VPS CRE CLI repeatedly returned `sweep completed`. The
  timer omits `--broadcast`, validates Monad testnet chain ID 10143, and rejects
  a nonempty receiver before running. This proves a recurring trigger/read
  simulation, not an active DON or public lifecycle write.
- The current USDC factory/receiver contain the refund/50-50 policy and were
  deployed and verified, with native USDC confirmed as the yield vault's asset.
  The receiver has no configured workflow ID. Publishing remains unavailable;
  drafts are usable. This migration broadcast three deployments, with no public
  event creation, commitment, settlement, or participant claim. Funded execution
  of the policy remains an end-to-end milestone.

CRE account credentials reside in `/var/lib/commitpass/.cre` under the service
user, with mode 600. The existing authenticated local session was used for the
VPS CLI; no additional API key was created. These files and all environment
values stay outside the repository.
