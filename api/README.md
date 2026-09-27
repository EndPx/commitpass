# API

Go workspace for metadata, verified organizer actions, check-ins, and frozen attendance snapshots. The current bootstrap uses only the standard library and exposes `GET /health` on port 8080. `PORT` can override the port.

```sh
# From the repository root
pnpm dev:api
```

The root `go.work` resolves `github.com/EndPx/commitpass/packages/shared` locally. Run Go commands from this checkout, including for CI; an isolated copy of `api` does not include its shared module.

Health currently reports process liveness only. Neon, Privy verification, and event endpoints are not connected yet.

Keep the intended database ownership: Envio writes indexed chain facts; this service writes application data and reads indexed facts. Chain receipts determine settlement and claim completion. The API must verify organizer authorization before recording attendance or requesting lifecycle actions.
