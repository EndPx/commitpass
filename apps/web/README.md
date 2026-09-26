# Web

Next.js 15 App Router workspace, matching the major version of the selected ShowOrSow reference. It currently exposes `GET /health`, consuming `@commitpass/shared`. Product pages and Privy integration are not implemented yet.

From the repository root:

```sh
pnpm dev:web
```

Open `http://localhost:3000/health`. The root page is intentionally absent until the ShowOrSow frontend is adapted.

The future interface follows [ShowOrSow at `8fbe3f0`](https://github.com/EndPx/ShowOrSow/tree/8fbe3f04a05eb19eca10710173057f65d9aadf84/web). Adapt its account and data access to Privy, the Go API, and Monad. Its Canton privacy and automatic payout claims do not describe CommitPass.
