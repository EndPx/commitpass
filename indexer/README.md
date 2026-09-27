# Envio indexer

Reserved workspace for Envio HyperIndex. No indexer runtime or handlers are implemented yet; this workspace has no build/dev task until the real integration is initialized.

The integration will discover event vaults from the factory and index deposits, yield operations, settlements, and claims into an Envio-owned Neon schema. Application check-ins and snapshots remain backend-owned. Use `@commitpass/shared` for shared public data and the compiled contract ABI package when it exists.

Initialize against the actual contract artifacts and a pinned Envio version. Keep reorg-aware writes within HyperIndex's entity system; do not overwrite application tables during reindexing.
