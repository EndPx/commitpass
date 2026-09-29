# Interactive local application

Run from the repository root:

```sh
pnpm local:app
```

Stop existing web/API/Anvil processes first. Ports 3000, 8080, 8092 and 8547 must
be available. The launcher refuses occupied ports. Use Node 22/24, pnpm, Go,
Bun, Foundry and a logged-in CRE CLI. No CRE deployment access is needed.
On Windows the existing Ubuntu WSL Foundry/Envio installation is used.

The launcher builds and deploys fresh contracts on loopback Anvil, configures the
Anvil-only simulation forwarder, creates unique application/indexer schemas,
starts Go + Envio + Next.js, and polls due lifecycle work every 15 seconds using
the real CRE CLI/WASM. It uses the real authenticated Go attendance snapshot API.

## Use the app

1. Open `http://localhost:3000`. Confirm the **Local mode** banner is visible.
2. Sign in with Privy. Set up the embedded wallet if needed.
3. Click **Get local test funds**. This funds the signed-in wallet with local MON
   and mockAUSD once per session. Tokens have no monetary value.
4. Create an event with future registration/start/end times. Keep the session
   running while using the application. Envio may take a few blocks to show it.
5. A participant signs in, receives local funds, reserves, and receives their pass.
   An organizer may also reserve their own event for a one-account local walkthrough.
6. The host opens Manage event and requests Start. The local CRE loop processes it.
7. After start finalizes, record the participant's check-in. End requests freeze
   eligibility at the contract cutoff. CRE retrieves the immutable Neon snapshot.
8. After settlement, the participant claims from the event page.

Scheduled start/end use the same workflow. A valid frozen empty attendance snapshot finalizes as a full refund for every depositor. Failed attendance reads continue to defer settlement. When an API or workflow execution fails, the next loop
retries and the contract's idempotence checks remain in force.

## Boundaries and storage

- Anvil uses chain ID 10143 only for CRE's Monad simulation selector. It is **not
  public Monad testnet**. Public contract addresses and workflow configuration are
  unchanged. The simulation forwarder is installed only after checking Anvil.
- Privy, Neon and Cloudinary remain online services. This is local execution,
  not a completely offline application. Existing ignored API/indexer/web env files
  supply their normal credentials. JWT verification and owner checks stay enabled.
- Each run gets a random namespace: `app_local_<runId>` in the application database
  and `envio_local_<runId>` in the dedicated indexer database. SQL uses explicitly
  qualified schemas; it does not rely on transaction-pooler search paths.
- No public schema is cleared. Local schemas are retained; cleanup is explicit.
- Relayer keys and local control/attendance tokens live only in process memory and
  child environments. `.interactive/deployment.json` contains only public local
  contract addresses and the run ID. The user's wallet keys are never exported.
- Local funding requires a fresh Privy session and a linked wallet. Its loopback
  control endpoint is protected by a random server-only token and is unavailable
  in normal testnet mode. It cannot fund a public chain.
- Ctrl+C stops launcher-owned services. Anvil state is disposable; a new run has
  new addresses and namespaces. Pending transaction keys include the local run ID.
- To return to public testnet, stop the local launcher, run the normal API/web
  commands without its environment overrides, and regenerate indexer configuration
  with `pnpm indexer:codegen` before `pnpm indexer:start`.

The separate `pnpm cre:local` command remains the disposable scripted lifecycle
acceptance runner with its own attendance fixture. Do not run it at the same time.
