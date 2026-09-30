# Hosted CommitPass

Recorded on 30 September 2026. API/VPS runtime source:
`dcb8366ae336dd148ff497d0bdca98411fa50bb5`. Frontend source after the Events and
Discover redesign: `f807b1c50730be9725a887691e35df29ae8fc36c`.

| Component | Location                            | Runtime                                                            |
| --------- | ----------------------------------- | ------------------------------------------------------------------ |
| Frontend  | https://commitpass-kappa.vercel.app | Vercel project `commitpass`, root `apps/web`, Node 24              |
| API       | https://commitpass-api.endpx.cloud  | Hostinger VPS `1330754`, loopback port 8095 behind Nginx HTTPS     |
| Indexer   | Same VPS                            | Envio 3.12.1, public Monad testnet RPC, Neon schema `envio_hosted` |
| CRE       | Same VPS                            | CLI 1.34.0, one guarded cron simulation per minute                 |

The API subdomain was absent from DNS and Nginx before creation. No frontend
custom domain was added. The Let's Encrypt API certificate renews automatically.
Existing VPS services use their previous ports and configurations.

## Release and services

Source is extracted to `/opt/commitpass/releases/<commit>`; the active release is
the `/opt/commitpass/current` symlink. API binaries are built on Linux. Services
run as the dedicated `commitpass` user:

```sh
systemctl status commitpass-api commitpass-indexer commitpass-cre.timer
journalctl -u commitpass-api -u commitpass-indexer --since '-10 minutes'
journalctl -u commitpass-cre.service --since '-5 minutes'
curl --fail https://commitpass-api.endpx.cloud/health
curl --fail https://commitpass-api.endpx.cloud/v1/events
```

`/health` reports the deployed `RELEASE_COMMIT` and process liveness. Indexer
readiness is checked separately from `envio_hosted.envio_chains` in Neon.
The services in this folder are installed under `/etc/systemd/system`.
Nginx listens publicly on 443 and proxies only to `127.0.0.1:8095`.

The root-readable environment files are `/etc/commitpass/api.env`,
`indexer.env`, and `cre.env`, with mode 600. The API uses
`COMMITPASS_INDEXER_SCHEMA=envio_hosted`; Envio uses
`ENVIO_PG_SCHEMA=envio_hosted`. This new schema preserves the earlier `envio`
schema and its indexed data after an ABI/schema mismatch was detected. Application
data remains in `app`. No indexer reset was performed.

## Vercel

The current production deployment is `dpl_3XfT3ALy1cJsrkcySvFy27GmQ84j`.
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
- The frontend `/api/session` and VPS `/v1/me` rejected missing tokens with 401.
- API and indexer services are enabled and active. Envio is backfilling from the
  public deployment block. At 12:25 WIB, its checkpoint was 66,275,925 with a
  source block of 66,885,133 and zero processed events; catch-up was incomplete.
- The authenticated VPS CRE CLI repeatedly returned `sweep completed`. The
  timer omits `--broadcast`, validates Monad testnet chain ID 10143, and rejects
  a nonempty receiver before running. This proves a recurring trigger/read
  simulation, not an active DON or public lifecycle write.
- The deployed public factory/receiver still use the earlier contract version
  and have no configured workflow ID. Publishing is visibly unavailable on the
  hosted editor; drafts remain usable. New refund/50-50 policy proof remains in
  the separate local evidence. No blockchain deployment or transaction was
  performed by this hosting task.

CRE account credentials reside in `/var/lib/commitpass/.cre` under the service
user, with mode 600. The existing authenticated local session was used for the
VPS CLI; no additional API key was created. These files and all environment
values stay outside the repository.
