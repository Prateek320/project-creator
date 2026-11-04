# Project Creator — MVP

A performance-driven creator–brand marketplace: brands publish structured campaigns, creators apply, both sides accept a **versioned agreement**, deliverables are reviewed, outcomes are attributed through **tracked links, coupon codes and signed brand events**, and payouts follow the agreed **fixed / performance / hybrid** formula through an **append-only ledger**.

> Demo build. No real money moves and no live social data is fetched. Payment and social providers run as mock adapters until provider approval and legal review (PRD §10 launch gate).

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

No database setup is needed. Without `DATABASE_URL` the app uses **PGlite** (real Postgres compiled to WASM), saved in `./.data`. On first request it runs the SQL migrations and seeds a demo dataset **through the real domain services**, so every ledger entry, audit event and state transition is genuine.

To use a real Postgres instead:

```bash
cp .env.example .env.local
# DATABASE_URL=postgres://user:pass@localhost:5432/project_creator
# SESSION_SECRET=<long random string>   (required with a real database)
npm run db:smoke       # migrates, seeds, checks every ledger transaction balances
npm run build && npm start
```

To start the demo over: **Team & settings → Reset demo data**, or delete `./.data`.

## Demo accounts (pick one on /login)

| Account | Lands in |
|---|---|
| **Aarav Mehta** · Glow Botanics (brand) | Meera's final Story waiting for review → approve the settlement → pay out. Compare applicants, send offers, build a campaign. |
| **Nisha Rao** · Urban Stride (brand) | Performance campaign with a dispute holding ₹1,500 of returned orders. |
| **Meera Iyer** (creator) | Active hybrid collaboration, tracked link and code, paid and reviewed history. |
| **Kabir Malhotra** (creator) | Part of his payout held in dispute; the undisputed portion is still payable. |
| **Zoya Khan** (creator) | An offer waiting to be accepted. |
| **Ritu Bansal** (operations) | Resolve disputes, restore excluded events, verify accounts, audit trail. |

### A 3-minute walkthrough
1. **Aarav** → Overview → *Review* Meera's Story 3 → **Approve** → *Send signups* (demo webhook, with one replayed event that's deduplicated) → **Earnings & settlement** → **Approve** → **Pay out**.
2. Campaign → **Applications & creators**: track record, audience evidence with provenance chips, advisory match signals → **Send offer** to Sana.
3. **Zoya** → *Review offer* → **Accept agreement**: deliverables, tracked link and coupon are issued.
4. **Ritu** → open the Urban Stride dispute → split the hold with a reason → both sides are notified and the ledger records a compensating release.
5. **Meera** (try it at phone width) → Discover campaigns → open one → payout calculator → apply.

## What's built

| Area | Where |
|---|---|
| Landing with brand / creator entry points | `/` |
| Demo auth (signed httpOnly cookie) | `/login`, `src/server/session.ts` |
| Brand overview: review queue, settlements, new applications | `/brand` |
| Campaign list, 4-step builder with autosave + live payout preview + budget check | `/brand/campaigns`, `/brand/campaigns/new` |
| Campaign detail: terms, budget/funding, status transitions, refunds | `/brand/campaigns/[id]` |
| Applicant comparison: track record, provenance, advisory match reasons, shortlist / decline / offer | `/brand/campaigns/[id]/applications` |
| Results: verified outcomes per day, per-creator settlement, content metrics with provenance, event exclusion, CSV import | `/brand/campaigns/[id]/analytics` |
| Creator discovery (server-side filters, cursor pagination) and profiles | `/brand/creators`, `/creators/[id]` |
| Ledger view, webhook docs with a correctly signed sample request | `/brand/billing`, `/brand/settings` |
| Creator home, discovery, brief + earnings calculator + apply, applications, earnings, profile/accounts/portfolio | `/creator/*` |
| Collaboration workspace: offer/amendment diff and acceptance, deliverables + revisions, tracking, activity trail, amendments, reviews | `/collaborations/[id]` |
| Settlement: line-by-line formula explanation, event evidence, ledger, payouts, disputes | `/collaborations/[id]/settlement` |
| Ops: dispute queue and resolution, excluded events, verification, audit trail | `/admin/*` |
| Signed conversion webhook (HMAC-SHA256, idempotent, rate limited) | `POST /api/v1/attribution/events` |
| First-party tracked links (deduplicated clicks, bot filtering, UTM + IDs appended) | `GET /r/[slug]` |

## Architecture

Modular monolith (Next.js 15 App Router, TypeScript strict, Tailwind v4, Drizzle ORM, PostgreSQL).

```
src/domain/     pure logic, no I/O — compensation engine, state machines, ledger rules, attribution contract, money
src/server/     services: every function takes an Actor and authorises it (tenant isolation lives here)
  core.ts         actor, access checks, audit, notifications, idempotent ledger posting
  campaigns.ts    create/publish/transition/fund, discovery
  collaborations  applications, offers, versioned agreements + amendments, deliverables
  finance.ts      attribution ingest, settlement, payouts, refunds, disputes, reporting
  creators.ts     profiles, reputation, provenance-aware metrics, explainable match reasons
  providers.ts    PaymentProvider adapter (mock only)
src/app/        pages (server components), thin server actions, API routes
src/db/         schema, connection (PGlite or Postgres), seed
drizzle/        SQL migrations (incl. DB triggers making ledger + audit append-only)
tests/          domain tests + service integration tests on in-memory Postgres
```

Key decisions (see PRD §8, §12):

- **Money** is integer paise everywhere (`bigint`), parsed from text without floats.
- **Agreements are immutable once accepted.** Changes create a new version; the old one is `superseded`, never edited. Settlement always uses the active accepted version's formula snapshot.
- **Settlement is deterministic and incremental.** `evaluateSettlement()` is pure; approvals post only the delta since the last approval, with an idempotency key tied to the agreement version and total, so retries and double-clicks can't double-pay.
- **Double-entry, append-only ledger.** Every transaction group sums to zero; a Postgres trigger rejects `UPDATE`/`DELETE` on `ledger_entries` and `audit_events`. Reversals are compensating entries. The platform never claims to hold funds: `campaign_funds` mirrors money held by the payment provider.
- **Fairness guardrails.** Hybrid is the default; the base is tied to creator-controlled deliverables; floors only apply once content is approved; disputes hold only the disputed amount.
- **Evidence over vanity metrics.** Every metric carries a provenance status (`verified_api`, `creator_reported`, `estimated`, `stale`, …) shown as a chip with source and date. Disconnecting an account revokes its token reference and marks its metrics stale.
- **AI/matching is advisory.** Match reasons are plain-language signals; nothing is auto-rejected or ranked by an opaque score.
- **Tenant isolation**: "not found" is returned for both missing and foreign records, so tenants can't probe IDs.

## Quality checks

```bash
npm run typecheck   # strict TS, no `any`
npm run lint
npm test            # 29 tests: formulas, exclusions, determinism, caps/floors, state machines,
                    # HMAC, CSV, tenant isolation, role checks, end-to-end slice, webhook idempotency,
                    # amendments, revision limits, append-only ledger, balanced groups, dispute holds, reversals
npm run build
```

Also verified: full browser walkthrough of the brand, creator (mobile viewport), offer acceptance and ops flows with no console errors; signed webhook accepted once and deduplicated on replay; bad or tampered signatures rejected; migrations + seed on real PostgreSQL 16 with every ledger group balanced.

## Known limitations / next steps

- **Auth** is a demo stand-in. Replace `getActor()` in `src/server/session.ts` with a managed provider (Clerk / Auth.js / Supabase) and add MFA for owners and ops actions. Team invites are not built yet.
- **Payments**: mock provider only. A split-settlement provider (e.g. Razorpay Route) plugs in behind `PaymentProvider` after eligibility, KYC/KYB and legal sign-off. Reconciliation against provider webhooks is not built.
- **Social APIs**: no OAuth yet (needs Meta / Google app review). Manual evidence is the working path; seeded "Verified API" numbers are labelled demo data.
- **Uploads**: evidence and portfolio are links; object storage with signed URLs and malware scanning is not wired.
- **Background jobs** (metric sync, reminders, email) and email notifications are not wired; notifications are in-app.
- **Rate limiting** is in-memory (single instance). Use a shared store when scaling out.
- **Webhook secrets** are stored in the database for the demo; move them to a secrets manager with rotation.
- Settlement reduction after events are excluded post-approval is routed to a dispute rather than an automatic clawback (by design for the MVP).
- PRD §21 open decisions (beachhead vertical, platform fee model, cancellation policy, rights defaults, tax/TDS) are not encoded yet.
