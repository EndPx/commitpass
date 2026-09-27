# CRE workflows

Reserved workspace for Chainlink CRE start and settlement workflows. No workflow runtime, simulation, or deployment is implemented yet; this workspace has no build/dev task until the real integration is initialized.

- Start: validate an organizer request or scheduled eligibility, then submit the authorized onchain start operation that places funds into Morpho.
- Settle: retrieve a frozen attendance snapshot through the Go API, verify the onchain event state, and submit the authorized settlement report.

Both paths must tolerate retries without duplicate financial actions. Configure the CRE SDK, CLI, runtime, and forwarder for the chosen Monad network when implementing this workspace. CRE deployment access and successful activation are separate from a local simulation.

Use `@commitpass/shared` for browser-safe shared data. Workflow secrets and deployment-specific credentials stay in the CRE secret mechanism, not in the shared package.
