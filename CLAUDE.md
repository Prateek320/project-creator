<!-- planfirst:start -->
## Architecture Reference
Full spec: `./docs/architecture.md` — read before adding any infrastructure.
Build plan and flow audit: `./docs/backend-plan.md`.

### Stack (moment: validate → early grow)
- App: Next.js 15 monolith (App Router, server actions), TypeScript strict
- Data: PostgreSQL (Neon, Mumbai) via Drizzle; PGlite only for local demo
- Jobs: Postgres job table drained by Vercel Cron
- Auth: Clerk (organisations, MFA) — planned, decision D2
- Email: Resend via outbox — planned
- Payments: mock provider; record-only payouts next; payment partner in Phase 4
- Errors: Sentry — planned

### Agent Rules
- DO NOT add infrastructure that isn't solving a problem you have today.
- DO NOT add Redis, Kafka, BullMQ, or a second database without updating docs/architecture.md and an ADR.
- DO NOT call an external service inside a request handler or a DB transaction; enqueue a job via the outbox.
- ALWAYS make money mutations idempotent and atomic, and post balanced ledger lines through `postLedger`.
- NEVER update or delete `ledger_entries`, `audit_events` or `attribution_events`; write compensating rows.
- NEVER store PAN, Aadhaar, full bank numbers, card data or OAuth tokens in plain text.
- ALWAYS authorise in `src/server` services through `Actor`; return "not found" for missing and foreign records alike.
- ALWAYS gate demo-only behaviour behind `APP_ENV=demo`.
- DO NOT run migrations or seed at app boot outside local development.
- DO NOT mark a flow production-ready until its phase exit test in docs/backend-plan.md passes end to end.
<!-- planfirst:end -->
