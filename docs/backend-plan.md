# proovd — Backend audit and production plan

> Status: **proposal for review**. Nothing in this plan has been built yet.
> Written 2026-11-05 against commit `main` of `Prateek320/project-creator`.
> Companion to [`architecture.md`](./architecture.md), which holds the stack decisions and agent rules.

## 1. Where we are today

proovd is a working **demo**. The domain logic is real and tested (payout formulas, state machines,
double-entry ledger, tenant isolation, idempotency), but **every edge that touches the outside world
is simulated or missing**:

| Area | Today | Real? |
|---|---|---|
| Sign-in | Pick a seeded demo account; signed cookie holds the user id | ❌ No passwords, no signup, no MFA |
| Payments in (campaign funding) | `mockPaymentProvider.collect()` returns `funded` instantly | ❌ No money moves |
| Payments out (creator payouts) | `mockPaymentProvider.transfer()` returns `paid` instantly | ❌ No money moves |
| Signups / sales (outcomes) | "Send signups" button (`simulateConversions`) or a signed webhook | ⚠️ Webhook is real code, never used by a real brand |
| Tracked link clicks | `/r/[slug]` records deduplicated clicks | ⚠️ Real code, demo domain, naive bot filter |
| Social account data | Creator types followers / engagement by hand ("creator reported") | ❌ No Instagram / YouTube connection |
| Verification (creator ID, brand KYB) | Ops clicks "Verify" with a reason | ❌ No documents, no KYC provider |
| Notifications | In-app list only | ❌ No email, WhatsApp or push |
| Deliverables | Creator pastes a published URL | ⚠️ No draft upload, no check that the post exists |
| Background work | None. Everything runs inside the request | ❌ No jobs, schedules or retries |
| Database | Embedded PGlite file, or Postgres if `DATABASE_URL` is set | ⚠️ Migrations **and demo seed** run on app start |
| Rate limiting | In-memory `Map` per server process | ❌ Ineffective on serverless / multiple instances |

**No flow is production-ready.** A flow only earns that label in this plan when it passes the
end-to-end exit test listed for its phase, against real (sandbox, then live) external systems.

## 2. Flow-by-flow audit

Legend for **Status**: 🟢 logic real and tested in-app · 🟡 real code, never exercised against a real counterpart · 🔴 mocked or missing.

| # | Flow | Status | Data it needs | APIs / actions | Permissions | External services | Background jobs |
|---|---|---|---|---|---|---|---|
| 1 | Sign up, sign in, sessions | 🔴 | users, memberships, creator_profiles, sessions | auth callbacks, `getActor()` | public → role assigned at onboarding | Auth provider (email OTP / Google; SMS OTP optional) | session cleanup (provider-managed) |
| 2 | Brand onboarding + team | 🔴 | organizations, memberships (+ role: owner/member) , invites | create org, invite, accept invite | org owner manages team | Auth provider orgs, email | invite expiry |
| 3 | Creator onboarding + profile | 🟢 profile CRUD · 🔴 signup | creator_profiles, portfolio_items | profile actions | creator owns profile | — | — |
| 4 | Verification (creator ID, brand KYB) | 🔴 | verification_requests (new), documents (new) | submit docs, ops decide | ops only decide; owner submits | KYC (via payment partner's linked-account KYC, or DigiLocker/PAN check later) , file storage | reminder if pending > 3 days |
| 5 | Social account connection + metrics | 🔴 | social_accounts (tokens encrypted), metric_snapshots | OAuth connect/callback, disconnect | creator only; brands read snapshots | Instagram API with Instagram Login, YouTube Data + Analytics APIs | **daily** token refresh + metrics snapshot; mark `stale` on failure |
| 6 | Campaign create / publish | 🟢 | campaigns, campaign_requirements | builder, publish | brand org members | — | close applications at `apply_by`; end campaign at `end_at` |
| 7 | Campaign funding | 🔴 | ledger (funding), provider orders (new table) | create order → checkout → provider webhook | brand owner (MFA) | Payment partner (collection) | reconcile unconfirmed orders every 15 min |
| 8 | Discover + apply | 🟢 | applications | apply, withdraw | creator | — | — |
| 9 | Shortlist, offer, agreement, amendments | 🟢 | agreements (versioned), audit | offer, accept, decline, amend | brand ↔ creator party only | email for "offer waiting" | offer expiry (e.g. 7 days) + reminder at 48 h |
| 10 | Deliverables submit / review | 🟢 URL flow · 🔴 drafts | deliverables, files (new) | submit, review, revision limits | creator submits, brand reviews | Object storage for drafts; social API to confirm the post is live | due-date reminders; post-live check after approval |
| 11 | Outcome tracking: links, coupons, webhook, CSV | 🟡 | attribution_events (append-only), webhook secrets | `/r/[slug]`, `POST /api/v1/attribution/events`, CSV import | brand org (webhook signed per org) | Brand's backend / Shopify (decision D5) | async processing of webhook batches; daily "no events received" alert per live campaign |
| 12 | Settlement compute + approve | 🟢 logic · 🟡 data | ledger, settlements | `getSettlement`, approve | brand owner approves (MFA) | — | nightly "ready to approve" digest; attribution-window close → final settlement |
| 13 | Payout to creator | 🔴 | payment_transfers, ledger | pay out, reverse | brand owner / ops (MFA) | Payment partner (transfer / split) | **poll / webhook** for transfer status; daily reconciliation vs provider report |
| 14 | Disputes | 🟢 | disputes, ledger holds | open, resolve | parties open, ops resolve | email | SLA reminder to ops at 3 days |
| 15 | Refund unspent budget | 🟢 logic · 🔴 money | ledger (refund) | refund | brand owner, ops | Payment partner refunds | auto-propose refund at campaign end + window |
| 16 | Notifications | 🟢 in-app · 🔴 email | notifications, notification_prefs (new), outbox (new) | — | user's own | Email (Resend); WhatsApp later | outbox sender with retry |
| 17 | Reviews + reputation | 🟢 | reviews, completed agreements | leave review | brand of completed collab | — | — |
| 18 | Ops queue, audit trail | 🟢 | audit_events (append-only) | ops actions | admin role (MFA, allow-listed) | — | — |
| 19 | Privacy rights (DPDP) | 🔴 | consents (new), data_requests (new) | export my data, delete my account | data principal (self) | — | erasure job (pseudonymise PII, keep ledger/audit by id) within 90 days |
| 20 | Demo environment | 🟢 | seed | demo login, reset, simulate | anyone (demo only) | — | nightly reset |

### Gaps found in the code (fix regardless of phase)

| Finding | Where | Risk | Fix |
|---|---|---|---|
| Demo seed runs whenever the `users` table is empty | `src/db/index.ts` → `seed()` | A fresh production DB would be filled with fake brands and money | Run seed only when `APP_ENV=demo` |
| Migrations run on every cold start | `src/db/index.ts` | Concurrent serverless starts race; slow boots | Run `drizzle-kit migrate` in the deploy pipeline |
| Payout calls the provider **before** writing anything to the DB | `payoutCreator` in `src/server/finance.ts` | If the DB write fails after a real transfer, we lose the record (the idempotency key helps only if the same request is retried) | Write `payment_transfers` as `pending` first (outbox), call provider from a job, settle on webhook |
| Funding assumes instant success | `fundCampaign` | Real collections are asynchronous (checkout, UPI, bank) | `funding_pending` → webhook → ledger |
| Webhook secret stored in plain text, shown in settings | `organizations.webhook_secret` | DB leak exposes every brand's signing key | Encrypt at rest, show once, support rotation with overlap |
| Rate limiter is per-process memory | `src/server/rate-limit.ts` | No protection on Vercel / multiple instances | Postgres-backed limiter (Phase 0); Upstash only if it becomes hot |
| Demo-only actions are always registered | `loginAs`, `resetDemo`, `simulateAction` | Anyone could reset or impersonate in production | Compile out / 404 unless `APP_ENV=demo` |
| No CI | — | Regressions ship silently | GitHub Actions: typecheck, lint, unit, Postgres integration, Playwright |
| Append-only ledger + audit vs right to erasure | schema | DPDP erasure requests can't delete rows | Keep money/audit rows keyed by id; erase or pseudonymise PII in `users` / `creator_profiles` |

## 3. What depends on outside parties (long lead times — start early)

| Dependency | Why we need it | Lead time / gate | Notes to verify |
|---|---|---|---|
| **Legal entity, GST registration, CA** | Contracts, invoices, TDS/GST roles | Weeks | Whether proovd is an "e-commerce operator" under s.194-O (TDS on payments to creators) and GST s.52 (TCS). The official s.194-O page still reads 1%; a later cut to 0.1% is widely reported — **confirm with a CA**, and check the Income-tax Act 2025 renumbering. |
| **Payment partner** (Razorpay Route or Cashfree split/payouts) | Hold brand funds, pay creators, refunds | Use-case review; Route now requires a written use-case and RBI PA-guideline proofs (payer–payee transparency); turnover thresholds may apply | Whether individual creators can be Route linked accounts (KYC form is business-oriented); hold/release mechanics; webhook events |
| **Meta App Review** (Instagram) | Read creators' insights | Business verification + App Review; "Advanced access is required to request permission from any app user" | Only professional (business/creator) accounts are supported |
| **Google OAuth verification** (YouTube) | Read channel analytics | Verification for sensitive scopes | Exact scopes and review steps |
| **DPDP Act** | Lawful processing of personal data | Rules notified 14 Nov 2025; full obligations and penalties from ~13 May 2027 | Consent notices, 90-day response to data requests, breach reporting (72 h detailed report per secondary sources) |
| **Brand integrations** | Real outcomes | Per brand | Shopify app review if we ship an app (decision D5) |

## 4. Decisions we need from you

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | How money moves in the beta | **(a) Record-only:** brand pays the creator directly (UPI/bank); proovd records the UTR and both sides confirm. **(b) Escrow/split** through a payment partner from day one. | **(a) first**, (b) in Phase 4 after legal sign-off. Lets real users run real deals in weeks instead of months, without proovd holding funds. The ledger already models both. |
| **D2** | Auth provider | Clerk · Auth.js + email OTP (Resend) · Supabase Auth | **Clerk** — orgs map to brand teams, MFA built in, no auth code to own. Revisit at 10k MAU (pricing). |
| **D3** | Hosting | Vercel + Neon Postgres (both in Mumbai region) · Railway (app + worker + Postgres) | **Vercel + Neon**, pinned to Mumbai, with a Postgres job table drained by Vercel Cron. Revisit if any job needs > 5 min or per-second scheduling. |
| **D4** | Payment partner for Phase 4 | Razorpay (Route + Payouts) · Cashfree (Split + Payouts) | Talk to **both** now; choose on (1) individual-creator onboarding, (2) hold/release support, (3) approval time, (4) fees. |
| **D5** | First outcome source for brands | Generic signed webhook (exists) · CSV (exists) · Shopify app · coupon reconciliation | Webhook + CSV for the first 5 brands; **Shopify** next if most beta brands are on it. |
| **D6** | Tax roles | proovd deducts TDS / collects TCS · brands handle it | Needs a CA. Blocks D1(b) only. |
| **D7** | Beta size and budget | — | Assumed: ≤ 50 brands, ≤ 1,000 creators, ≤ $50/month infra excluding transaction fees. Tell me if different. |
| **D8** | Keep the public demo? | Separate `demo.` environment · retire | Keep it as its own environment with mock providers and nightly reset. |

## 5. Phased plan

Each phase ends with an **exit test**. A flow is only called production-ready once its exit test has
passed end to end in staging (sandbox providers) and then once in production with real accounts.

### Phase 0 — Foundations (≈ 2–3 weeks) · no external money, no social APIs

> **Progress (2026-11-06).** Split into two slices.
> **Slice 1, hardening: done** (branch `phase0-hardening`). `APP_ENV` gating (items 1), migrations out of boot (2), jobs + outbox with payouts and funding moved onto it (4), encrypted webhook secrets with rotation, Postgres rate limiter, health check, report-only CSP and HSTS (6), and CI with Playwright (8).
> Also fixed from §2 "Gaps found in the code": seed on empty DB, migrations on cold start, payout/funding ordering, plaintext webhook secret, per-process rate limiter, ungated demo actions, no CI.
> **Slice 2, needs accounts: next.** Clerk auth with org roles and MFA (3), Resend via the outbox (5), Sentry and uptime check (6), DPDP consent and data requests (7), Neon + Vercel staging deploy and restore drill (2). The exit test below runs after slice 2.

Goal: real people can sign in and run a deal on a real database, safely.

1. **Environments**: `demo` (mock, seeded, nightly reset), `staging` (sandbox providers), `production`. `APP_ENV` gates seed, demo login, reset and simulator.
2. **Database**: Neon Postgres (Mumbai). Migrations run in CI/deploy, never at boot. Daily backups + point-in-time recovery verified by a restore drill.
3. **Auth (D2)**: signup/sign-in, brand organisations with owner/member roles and email invites, creator onboarding, ops allow-list. MFA required for brand owners and ops. `getActor()` becomes the only integration point (services already authorise by `Actor`).
4. **Jobs**: `jobs` table + worker route drained every minute by Vercel Cron (`FOR UPDATE SKIP LOCKED`, retries with backoff, dead-letter). Outbox pattern for anything that calls another system.
5. **Email**: Resend for invites, offers, review requests, settlements (via the outbox).
6. **Security**: encrypted webhook secrets with rotation; Postgres rate limiter; security headers; Sentry; uptime check on `/api/health`.
7. **Privacy (DPDP groundwork)**: privacy notice, consent capture at signup, "download my data" and "delete my account" requests handled by a job.
8. **CI**: GitHub Actions running typecheck, lint, unit, integration on Postgres, and the Playwright walkthrough.

**Exit test:** on staging, a new brand signs up, invites a teammate, publishes a campaign; a new creator signs up, applies, accepts the offer, submits a deliverable URL; the brand approves it. Playwright suite green in CI; restore drill done.

### Phase 1 — Real outcomes (≈ 2 weeks)

1. Webhook endpoint returns `202` fast and processes batches in a job; per-org secrets with rotation; replay protection already exists (event ids).
2. Brand integration guide + test console ("send a test event" with a sandbox secret).
3. CSV import moved to a job with a downloadable result report.
4. Tracked links on a short domain; stronger bot filtering; click-to-outcome window reporting.
5. Monitoring per live campaign: alert the brand if no events arrive for 48 h.
6. (D5) Shopify integration if chosen.

**Exit test:** a sandbox brand backend sends 1,000 events including duplicates, test events and out-of-window events; settlement totals match an independent spreadsheet calculation exactly, and replays change nothing.

### Phase 2 — Settlements with record-only payments (≈ 1–2 weeks) · D1(a)

1. Settlement approval stays as built; payout becomes "**Mark as paid**": brand enters the UTR / reference, the creator confirms receipt, the ledger posts `creator_paid` with `paid_offplatform` reference.
2. Payment instructions shown to the brand (creator's UPI ID / bank details stored as a reference only, never full numbers in logs).
3. Statements: per-collaboration PDF statement for both sides; monthly statement for creators.
4. Disputes can be raised against "paid but not received".

**Exit test:** two real test accounts complete brief → payout confirmation; ledger balances to zero for every group; statement matches the settlement screen.

### Phase 3 — Verified social data (≈ 3 weeks, starts approvals in Phase 0)

1. Instagram API with Instagram Login (professional accounts) and YouTube Data/Analytics OAuth; tokens encrypted; scopes minimal.
2. Daily job: refresh tokens, snapshot followers/reach/engagement/demographics, mark `stale` when a token dies.
3. Deliverable check: after approval, confirm the post exists on the connected account and record its permalink and metrics.
4. Provenance labels switch from "Creator reported" to "Verified API" automatically.

**Exit test:** Meta and Google approvals granted; 10 real creators connected; the snapshot job runs 7 consecutive days with zero unhandled failures; revoking access in Instagram flips the profile to "Stale" within a day.

### Phase 4 — Escrow and payouts through a payment partner (≈ 3–4 weeks after approvals) · D1(b), D4, D6

1. Creator payout onboarding (partner KYC: PAN + bank/UPI verification) — proovd stores only the partner's account id.
2. Campaign funding via partner checkout → `funding_pending` → webhook → ledger.
3. Transfers held until settlement approval, released on approval; refunds of unspent budget; reversals.
4. Inbound provider webhooks verified, stored raw, processed by jobs; daily reconciliation job compares ledger vs partner settlement report and pages ops on any difference.
5. TDS/GST handling as advised by the CA (deduction, certificates, platform fee invoices).

**Exit test:** full loop in partner **test mode** with refunds, reversals and a forced failure; then a live pilot with 3 brands for 2 weeks with **zero** unreconciled difference.

### Phase 5 — Later, on measurable triggers

| Item | Trigger |
|---|---|
| Draft content uploads (R2/S3, signed URLs) | > 30% of brands ask to review before posting |
| WhatsApp notifications | Email open rate for creators < 30% |
| Dedicated worker (Railway/Fly) | Any job > 5 min, or > 10k jobs/day |
| Upstash Redis for rate limits | Postgres limiter adds > 20 ms p95 to hot routes |
| Search engine (Meilisearch) | > 10k creators or campaigns and discovery p95 > 500 ms |
| Read replica for reports | Report queries > 1 s p95 on primary |

## 6. What "production-ready" means per flow

A flow moves from 🟡/🔴 to ✅ only when **all** are true:

1. Exit test for its phase passes end to end (Playwright + scripted provider sandbox).
2. Failure paths tested: provider timeout, duplicate webhook, retry after crash, permission denied.
3. Errors reach Sentry and an owner is paged for money or data-loss paths.
4. Audit events written for every state change.
5. One real run in production with real accounts, reviewed by you.

Until then the UI keeps a visible **Test mode** badge on any screen whose numbers come from mocks.

## Sources

- Razorpay Route: [About Route](https://razorpay.com/docs/payments/route/), [Linked accounts](https://razorpay.com/docs/payments/route/linked-account/)
- Instagram: [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login), [Insights announcement (Mar 2025)](https://developers.facebook.com/blog/post/2025/03/24/user-and-media-insights-on-instagram-api-with-instagram-login/)
- YouTube: [YouTube Analytics and Reporting APIs](https://developers.google.com/youtube/analytics)
- Tax: [Income Tax Dept — Section 194-O](https://www.incometaxindia.gov.in/w/section-194-o)
- DPDP: [PIB note on DPDP Rules 2025](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf), [Uniqus — DPDP timelines](https://uniqus.com/digital-personal-data-protection-act-timelines/)
