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
- Three-step interactive RSVP, attendance, and settlement preview.
- Native FAQ disclosures and working section navigation.
- Responsive layout; reduced-motion preferences disable pinning and movement.
- DM Sans and DM Serif Display self-hosted through `next/font`.

The interaction is illustrative. No payment, login, or booking is submitted.
Privy onboarding and the connected guest/host application remain subsequent work.
No photo assets or product claims are copied from the references. Design tokens,
motion decisions, and scope are documented in the root `DESIGN.md`.

React Grab and React Scan load only during development. Set
`NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS=1` to disable those overlays.

The event-first explanations also draw from [ShowOrSow](https://github.com/EndPx/ShowOrSow/tree/20c85e57c2044942b157c704461150283e429ef1/web).
Its Canton privacy and automatic payout claims do not describe CommitPass.
