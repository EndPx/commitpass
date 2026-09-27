# API

Go API with pgx read access to Envio's Neon database. Port 8080 by default; override with `PORT`. The development command loads `api/.env`.

```sh
# From the repository root
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

`INDEXER_DATABASE_URL` must target `commitpass_indexer`. Connections default to read-only transactions, with two connections and bounded query timeouts. Connection and SQL errors are not exposed to callers. Missing configuration or schema yields 503; an unindexed event detail yields 404.

These routes report Envio's indexed state, which may be delayed and can roll back after a reorg. They do not independently prove finality.

## Remaining integration

Privy app ID: `cmuk1cl9b01lk0cjp0tqxg4g8`. This is public configuration. Privy verification, user/wallet binding, authorized check-ins, and frozen snapshot endpoints are not implemented yet. Current event routes expose read-only public blockchain data; no unauthenticated mutation endpoint is provided.

The CRE snapshot endpoint must consume immutable application check-in records. It cannot use indexed `AttendanceMarked` as its input because that event is emitted only after settlement.

Keep the intended database ownership: Envio writes indexed chain facts; this service writes application data and reads indexed facts. Chain receipts determine settlement and claim completion. The API must verify organizer authorization before recording attendance or requesting lifecycle actions.
