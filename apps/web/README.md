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

The interaction is illustrative. No payment, login, or booking is submitted.
Privy onboarding and the connected guest/host application remain subsequent work.
No photo assets or product claims are copied from the references. Design tokens,
motion decisions, and scope are documented in the root `DESIGN.md`.

React Grab and React Scan load only during development. Set
`NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS=1` to disable those overlays.

The event-first explanations also draw from [ShowOrSow](https://github.com/EndPx/ShowOrSow/tree/20c85e57c2044942b157c704461150283e429ef1/web).
Its Canton privacy and automatic payout claims do not describe CommitPass.
