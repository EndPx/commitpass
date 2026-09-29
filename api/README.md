# API

Interactive local mode is launched by `pnpm local:app`. `COMMITPASS_LOCAL=1`
selects a validated local manifest and requires loopback Anvil. Each run uses
`app_local_<runId>` and `envio_local_<runId>` schemas, with explicit SQL
qualification. Default mode continues to use `app` and `envio`; migration file
checksums remain unchanged. Privy verification and attendance authorization are
identical in both modes. See [local setup](../cre/local/INTERACTIVE.md).

Go API for Privy identity, event metadata, organizer check-in and frozen attendance snapshots, alongside read access to Envio's Neon database. Requires Go 1.25+. Port 8080 by default; override with `PORT`. The development command loads `api/.env`. Build/dev commands select the portable Go implementation with CGO disabled.

```sh
# From the repository root
pnpm --filter @commitpass/api db:migrate
pnpm dev:api
```

The root `go.work` resolves `github.com/EndPx/commitpass/packages/shared` locally. Run Go commands from this checkout, including for CI; an isolated copy of `api` does not include its shared module.

## Endpoints

- `GET /health`: process liveness only.
- `GET /v1/events`: indexed Monad testnet events and financial aggregates.
- `GET /v1/events/{vault}`: event state and last indexed transaction.
- `GET /v1/events/{vault}/participants`: deposits and claimable amounts after indexed settlement.
- `GET /v1/events/{vault}/activity`: logs with block/transaction references.

Lists return up to 100 records. Pass `nextCursor` as `?after=` for another page. Onchain integers and timestamps are decimal strings. Results carry `source: envio` and chain ID 10143.

`GET /v1/events` also accepts `wallets` (up to 20 comma-separated EVM addresses)
and `role=all|hosting|going`. These filter public chain facts using the current
indexed owner or participant deposits. The web personal-events proxy derives the
wallet filter from a fresh authenticated `/v1/me` response. These filters grant
no authorization to write event metadata or attendance.

`INDEXER_DATABASE_URL` must target `commitpass_indexer`. Connections default to read-only transactions, with two connections and bounded query timeouts. Connection and SQL errors are not exposed to callers. Missing configuration or schema yields 503; an unindexed event detail yields 404.

These routes report Envio's indexed state, which may be delayed and can roll back after a reorg. They do not independently prove finality.

## Privy authentication

App ID: `cmuk1cl9b01lk0cjp0tqxg4g8`. Configure `PRIVY_APP_SECRET` locally; the secret is never sent to the frontend. Requests carry `Authorization: Bearer <Privy access token>`.

The backend validates ES256 signatures against the app-specific Privy JWKS, issuer `privy.io`, app audience, expiration, issued-at and session ID. Identity tokens are not accepted as access tokens. Keys are cached for an hour; unknown-key refreshes are bounded. After validation, the backend retrieves the current user through Privy's server API and derives linked Ethereum wallets from that response. Body/header wallet claims and stale DB wallet links never authorize actions.

| Method and path                              | Permission / purpose                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `POST /v1/session`                           | Privy token; synchronize the authenticated user and current wallet links |
| `GET /v1/me`                                 | Privy token; return that user's ID and current wallets                   |
| `GET /v1/me/mera-credential`                 | Privy token; read that user's Mera credential metadata                   |
| `PUT /v1/me/mera-credential`                 | Privy token; link one Mera credential ID for reuse across events         |
| `GET /v1/events/{vault}/metadata`            | Public event description                                                 |
| `PUT /v1/events/{vault}/metadata`            | Privy token plus the current onchain owner wallet                        |
| `GET /v1/events/{vault}/check-ins`           | Current event owner                                                      |
| `PUT /v1/events/{vault}/check-ins/{wallet}`  | Current event owner; record an eligible deposited participant            |
| `GET /v1/events/{vault}/attendance/{wallet}` | Current participant wallet owner; read their own check-in status         |
| `GET /v1/events/{vault}/private-kit`         | Current event owner; return opaque Mera vault JSON                       |
| `PUT /v1/events/{vault}/private-kit`         | Current event owner; store opaque Mera vault JSON                        |

The attendance read derives wallet ownership from the fresh Privy user response.
It returns `checkedIn` and `checkedInAt`, without revealing the host identity or
other participants. Missing attendance is distinct from a database failure.

Private kits contain only the Mera vault JSON. The API validates its v1 envelope
and credential match but does not decrypt, index, log, or return private plaintext.
The client validates untrusted vault JSON
with Mera's `parseSecretVault` before one user-verified decrypt ceremony. The
stored vault contains credential metadata, a random PRF salt, AES-GCM nonce and
ciphertext; it never contains the PRF output or encryption key. The owner check is
still enforced by the current onchain owner wallet.

Metadata accepts `title`, `description`, `location`, `posterUrl`, `timezone`, and
`appearance`; poster URLs must use HTTPS. Migration `002_event_appearance.sql`
adds the IANA timezone and a validated JSON appearance (style, six-digit hex
color, title font, light/dark mode), with defaults for existing rows. Financial
event creation and lifecycle transactions remain wallet/contract operations.
The backend does not sign them.

Check-in is idempotent per event/wallet. The event must have started, its automation must match the deployed receiver, and the participant's deposit must exist in finalized state. Both chain time and database time must precede the onchain cutoff. The server supplies timestamps and actor identity. Check-in records are append-only in this version; there is no correction/delete endpoint. An existing check-in can be read back on retry after the window closes.

## Neon application data

`DATABASE_URL` points to `neondb`, separately from `INDEXER_DATABASE_URL` (`commitpass_indexer`). Application tables live in schema `app`:

- `users` and `wallet_links`: minimal Privy identity and verified wallet-link cache.
- `events`: offchain descriptions tied to a factory-validated chain/vault/event ID.
- `check_ins`: server-timestamped attendance and actor/block audit fields.
- `attendance_snapshots`: one immutable settlement payload per event.
- `schema_migrations`: applied migration checksums.

Migrations are explicit, transactional and serialized with a PostgreSQL advisory lock. Event row locks serialize check-in inserts against freezing. Database triggers reject updates/deletes of check-ins and snapshots and reject check-in inserts after freezing. Envio never writes this schema.

## CRE snapshot endpoint

```text
POST /v1/attendance-snapshots/{chainId}/{vault}/{eventId}/{cutoff}
GET  /v1/attendance-snapshots/{chainId}/{vault}/{eventId}/{cutoff}
Authorization: Bearer <ATTENDANCE_API_TOKEN>
```

POST freezes once and returns the immutable payload; retries return the same saved payload. GET only reads an existing snapshot. The service credential is separate from Privy and is configured as `ATTENDANCE_API_TOKEN_ALL` for local CRE execution.

The backend validates the factory, receiver, event ID and cutoff against finalized chain state. It selects check-ins strictly before cutoff, sorts addresses, rechecks deposited membership, and computes Ethereum `keccak256(abi.encode(chainId, vault, eventId, cutoff, attendees))`. The transaction stores that payload and its finalized block anchor before responding. Subsequent reads check that the anchor remains canonical. The Go wire type lives in `packages/shared/attendance.go`, matching CRE's version-1 format.

Missing/unavailable data fails closed. A successfully authenticated, finalized empty snapshot returns `attendees: []` and a valid domain hash for the zero-attendance refund. Snapshot creation does not mean financial settlement succeeded; Envio/contract receipts establish that. Indexed `AttendanceMarked` is never used as check-in input, since it is emitted only during settlement.

## Runtime configuration and remaining work

See `.env.example`. The current local CRE testnet config points to `http://127.0.0.1:8080`; a deployed DON needs a reachable HTTPS URL and its secret provisioned in the Vault DON. `CORS_ALLOWED_ORIGINS` is an explicit comma-separated list, locally `http://localhost:3000`. The API accepts bearer headers, not auth cookies.

The interactive local application previously exercised Privy wallet creation, deposit, authenticated check-in, frozen snapshot, CRE settlement and claim with Go/Neon. See [interactive evidence](../cre/evidence/interactive-local-2026-09-28.json). That record predates the new payout policy; updated financial scenarios require a fresh local run. CRE public deployment remains separate.

References: [Privy access tokens](https://docs.privy.io/authentication/user-authentication/access-tokens), [querying Privy users](https://docs.privy.io/user-management/users/managing-users/querying-users).
