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
  image is labeled as illustrative and loads lazily through Next Image.

The landing walkthrough is illustrative and submits no payment or booking.
The separate `/signin` route uses real Privy authentication. The connected
guest/host event application remains subsequent work.
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
Privy's headless CAPTCHA integration, and sign out. The Privy SDK loads only on
this route. After authentication, an SDK-issued bearer token is sent to the
same-origin `POST /api/session` handler. It forwards to the fixed Go
`POST /v1/session` endpoint, where existing JWT checks and identity sync run.
The UI reports a connected account only after the verified ID matches the Privy
user. Responses use `Cache-Control: no-store`; tokens are not logged or copied
into application storage.

Google OAuth and existing-passkey login hooks are present behind
`NEXT_PUBLIC_PRIVY_GOOGLE_ENABLED` and `NEXT_PUBLIC_PRIVY_PASSKEY_ENABLED`.
Enable a flag only after enabling that method and its required origin/redirect
configuration in Privy. Both were off in the dashboard at implementation time.
Passkey enrollment, phone login, wallet creation and event transactions are not
part of this sign-in screen. The account confirmation currently links home.

Build note: Privy 3.45.0 imports x402, whose viem/ox Tempo dependency emits a
Webpack dynamic-dependency warning. The production build succeeds; no Tempo
feature is used by this screen. The unused optional Farcaster Solana connector
is excluded explicitly in `next.config.ts` for this EVM-only app.

References: [email OTP](https://docs.privy.io/authentication/user-authentication/login-methods/email),
[OAuth](https://docs.privy.io/authentication/user-authentication/login-methods/oauth),
[passkeys](https://docs.privy.io/authentication/user-authentication/login-methods/passkey),
[headless CAPTCHA](https://docs.privy.io/authentication/user-authentication/captcha).
