# Monad testnet CRE cron simulation, 30 September 2026

Command: `pnpm --filter @commitpass/cre simulate` from the repository root.

- The wrapper verified RPC chain ID `10143`, receiver bytecode and
  `vaultCount() == 0` at `0x06A41268C8cA9d5ADa19b02a8E2f37A0195dC49c`.
- CRE CLI `1.34.0` loaded the freshly compiled WASM, selected cron trigger 0,
  and finished at `2026-09-30T01:12:52Z` with result `"sweep completed"`.
- The binary hash was
  `cc862c371c6b7dcd8c31230aa5c45b00a0d2c7bd941a957c094ac5898a112e42`.
- The command omitted `--broadcast`; no event was due, no attendance snapshot
  was fetched or frozen, and no public Monad transaction was submitted.

This is a public Monad testnet RPC and trigger/read-path check. It is not
evidence of a deployed workflow, automatically fired trigger, onchain lifecycle
write, or end-to-end public event. The separate Anvil evidence covers actual
start and settlement behavior with the simulation-only forwarder fixture.
