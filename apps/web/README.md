# Web

Next.js 15 App Router workspace. `/` is the CommitPass landing page; `/health`
consumes the canonical metadata from `@commitpass/shared`.

From the repository root:

```sh
pnpm dev:web
```

Open `http://localhost:3000`. For a production preview:

```sh
pnpm --filter @commitpass/shared build
pnpm --filter @commitpass/web build
pnpm --filter @commitpass/web start
```

## Landing page

- Luma-inspired event poster composition with original CSS/SVG illustrations.
- Crafts-inspired GSAP ScrollTrigger choreography: posters gather into a reservation.
- Three-step RSVP, attendance, and settlement preview; advances every 5 seconds
  while visible, with manual step selection and pause/resume.
- Exclusive native FAQ accordion (one answer open at a time) and section navigation.
- Responsive layout; reduced-motion preferences disable pinning and movement.
- Sticky translucent navigation with backdrop blur and header-aware scroll offsets.
- Clean ivory hero and closing backgrounds with a faint warm tint.
- Gentle, staggered idle poster float on an inner wrapper independent of scroll motion.
- DM Sans and DM Serif Display self-hosted through `next/font`.
- GPT Image-generated C/check brand mark and panoramic workshop illustration.
  Original PNGs and generation prompts are in `public/brand/`; the community
  image is labeled as illustrative and loads lazily from Cloudinary's CDN.

The landing walkthrough is illustrative and submits no payment or booking.
The `/signin` route uses real Privy authentication; successful backend verification
redirects to `/events` (or an allowlisted event destination).
No photo assets or product claims are copied from the references. Design tokens,
motion decisions, and scope are documented in the root `DESIGN.md`.

React Grab and React Scan load only during development. Set
`NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS=1` to disable those overlays.

The event-first explanations also draw from [ShowOrSow](https://github.com/EndPx/ShowOrSow/tree/20c85e57c2044942b157c704461150283e429ef1/web).
Its Canton privacy and automatic payout claims do not describe CommitPass.

## Sign in

Copy `.env.example` to `.env.local` and configure the public Privy app ID and
server-only `COMMITPASS_API_URL`. The local default points to the Go API on port 8080. The API needs its existing Privy and Neon configuration to sync a session.
No Privy app secret belongs in the web environment or browser bundle.

`/signin` contains a custom email -> OTP -> account flow using
`useLoginWithEmail`, a 30-second resend cooldown, pending and failure states,
Privy's headless CAPTCHA integration, and sign out. The Privy SDK loads on sign-in
and event workspace routes, independently of the public landing page. After authentication, an SDK-issued bearer token is sent to the
same-origin `POST /api/session` handler. It forwards to the fixed Go
`POST /v1/session` endpoint, where existing JWT checks and identity sync run.
The UI reports a connected account only after the verified ID matches the Privy
user. Responses use `Cache-Control: no-store`; tokens are not logged or copied
into application storage.

Google OAuth and existing-passkey login hooks are present behind
`NEXT_PUBLIC_PRIVY_GOOGLE_ENABLED` and `NEXT_PUBLIC_PRIVY_PASSKEY_ENABLED`.
Enable a flag only after enabling that method and its required origin/redirect
configuration in Privy. Google was enabled on 28 September 2026 using Privy's
default OAuth credentials (basic openid/email/profile scopes). Passkeys remain
disabled. No custom Google Cloud client or Google client secret is required for
this setup. The consent screen may show Privy's branding; custom CommitPass
Google OAuth branding can be configured later with its own client.
Passkey enrollment, phone login, wallet creation and event transactions are not
part of the sign-in screen. Wallet setup is available on event action screens.

## Event workspace

- `/events`: personal Upcoming/Past timeline with All/Hosting/Going filters.
- `/discover`: public event timeline, search across loaded results, cursor pagination.
- `/events/[vault]`: indexed event facts plus API metadata, reservation/claim
  controls, and owner-only metadata editing and guest check-in.
- `/events/new`: title, photo upload, description, venue, local-time schedule,
  registration deadline, commitment and capacity. Drafts are explicitly saved in
  this browser, scoped to the Privy user; they do not create a public event.

The same-origin event API proxies only allowlisted Go API paths. Personal event
queries derive wallets from a fresh verified `/v1/me` response, then query Envio.
Metadata failures are separate from missing metadata; service failures are not
presented as empty lists. Go still authorizes every metadata and check-in write.

Factory/vault/automation ABI subsets are generated from the shared compiled ABI
snapshots by `node scripts/export-web-abi.mjs` (also called by `contracts:abi`).
The client uses the shared deployment manifest and chain configuration. Wallet
transactions require explicit user actions and Privy's confirmation UI. Reservation
checks current contract state, balance and allowance; claims use current onchain
eligibility. Confirmed receipts establish completion; Envio may take time to update.

Creation records the submitted transaction hash and metadata with the local draft
before waiting for confirmation. A reload can check that transaction and retry
metadata saving without submitting another event. Keep the same browser storage
until a pending creation finishes. Event action transaction hashes are also saved
locally for confirmation recovery. No keys or tokens are put in draft storage.

### Current deployment boundary

On 28 September 2026, the deployed receiver's `workflowId` was read as zero.
`createAutomatedEvent` cannot succeed until CRE registration/configuration is
completed. The form reads this state and blocks publishing while leaving draft
saving available. Do not bypass it with the non-automated factory function or
invent a workflow ID. No real event transaction was executed while building these
screens; live create/reserve/check-in/settle/claim acceptance remains pending.

## Photo storage and delivery

Cloudinary cloud: `dnzjmihyx`. Configure `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the server environment. Only
the cloud name is public configuration; key and secret stay in the ignored local
environment or deployment secret store, never `NEXT_PUBLIC_*` variables.

Create/edit event screens accept JPG, PNG, and WebP files up to 4 MB. `/api/media`
verifies the bearer token through the Go API before reading the bounded multipart
body, checks image signatures, and signs the Cloudinary request server-side using
SHA-256. Cloudinary validates/decodes the image and limits dimensions to 2400px.
Public IDs use `commitpass/event-covers/<hashed-user-id>/<uuid>` with overwrite
disabled. No unsigned upload preset or browser-visible secret is needed.

The returned HTTPS delivery URL is saved in the event's existing `posterUrl`
metadata when the user saves/publishes the event. Uploading alone does not publish
an event. Removing/replacing a cover detaches its URL; it does not delete an asset
that could still be referenced elsewhere. Cover images are public.

Images use Cloudinary `f_auto,q_auto,c_limit,w_...` delivery variants and `srcset`.
The landing workshop illustration is hosted as
`commitpass/brand/community-workshop`; its versioned URL is recorded in
`src/lib/brand-media.json`. `node scripts/upload-brand-media.mjs` uploads that
project asset without overwriting an existing image and refreshes the manifest.

Reference: [Cloudinary uploads](https://cloudinary.com/documentation/upload_images)
and [request signatures](https://cloudinary.com/documentation/authentication_signatures).

Build note: Privy 3.45.0 imports x402, whose viem/ox Tempo dependency emits a
Webpack dynamic-dependency warning. The production build succeeds; no Tempo
feature is used by this screen. The unused optional Farcaster Solana connector
is excluded explicitly in `next.config.ts` for this EVM-only app.

References: [email OTP](https://docs.privy.io/authentication/user-authentication/login-methods/email),
[OAuth](https://docs.privy.io/authentication/user-authentication/login-methods/oauth),
[passkeys](https://docs.privy.io/authentication/user-authentication/login-methods/passkey),
[headless CAPTCHA](https://docs.privy.io/authentication/user-authentication/captcha).
