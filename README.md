<div align="center">

<img src="src/app/icon.svg" alt="proovd logo" width="88" />

# proovd

**Proof you can see. Performance you get paid for.**

The operating system for creator–brand partnerships.

Clear terms. Verified outcomes. Dependable payouts.

![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=nextdotjs) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white) ![Tests](https://img.shields.io/badge/tests-29%20passing-047857) ![Status](https://img.shields.io/badge/status-MVP%20demo-b45309)

<img src="docs/screenshots/02-brand-overview.png" alt="Brand overview: content to review, settlements to approve, new applications" width="900" />

</div>

---

## The problem

Influencer marketing still runs on DMs, spreadsheets and trust.

- **Brands** pick creators by follower count, can't compare them consistently, and struggle to tie spend to results.
- **Creators** chase unclear briefs, absorb scope changes, wait on payments, and get judged on vanity metrics instead of the value they deliver.

## The idea

A two-sided marketplace where every collaboration runs on a **versioned agreement** with a **transparent payout formula**, and outcomes are **verified** rather than claimed.

> Think LinkedIn (verified creator identity) + Upwork (post, apply, hire) + Stripe (payouts you can trust) + an analytics layer, built around one question:
> **"Which creator is most likely to deliver the best business outcome for this campaign, at this budget?"**

## How it works

| | |
|---|---|
| **1. Publish a clear brief** | Objective, deliverables, dates, usage rights and the payout formula, all visible before anyone applies. |
| **2. Hire on evidence** | Compare applicants on verified track record, on-time delivery and audience data with its source shown, not just follower counts. |
| **3. Agree, then execute** | Both sides accept a versioned agreement. Content, revisions and deadlines live in one workspace. |
| **4. Settle what was verified** | Tracked links, coupon codes and signed brand events feed a reproducible settlement and an append-only ledger. |

## Fair, performance-linked pay

Three compensation models, agreed up front and snapshotted into every agreement:

| Model | Example | Best for |
|---|---|---|
| **Fixed fee** | ₹8,000 when the Reel and 3 Stories are approved | UGC, awareness |
| **Performance** | ₹100 per verified signup, capped at ₹10,000 | Trackable leads and sales |
| **Hybrid** *(default)* | ₹3,000 base + ₹70 per verified signup, capped at ₹10,000 | Most outcome-led campaigns |

**Worked example (hybrid):** deliverables approved + 50 verified signups → ₹3,000 + 50 × ₹70 = **₹6,500**. Duplicates and test signups are excluded automatically. Hitting 50% of the target doesn't mean 50% of the budget, and creators aren't penalised for a brand's landing page: the base is tied to work they control.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/04-applications.png" alt="Applicant comparison" /><br /><sub><b>Compare applicants</b>: track record, audience data labelled by source, advisory match signals</sub></td>
    <td width="50%"><img src="docs/screenshots/07-settlement-after.png" alt="Settlement" /><br /><sub><b>Settlement</b>: line-by-line formula, event evidence, double-entry ledger</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/11-builder-compensation.png" alt="Campaign builder" /><br /><sub><b>Campaign builder</b>: live earnings preview and budget check before publishing</sub></td>
    <td><img src="docs/screenshots/08-analytics.png" alt="Results and attribution" /><br /><sub><b>Results</b>: verified outcomes per day, per-creator settlement, metric sources</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/20-admin-queue.png" alt="Trust and safety queue" /><br /><sub><b>Operations</b>: disputes, excluded events, verification, audit trail</sub></td>
    <td><img src="docs/screenshots/01-landing.png" alt="Landing page" /><br /><sub><b>Landing</b>: separate entry points for brands and creators</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/14-campaign-brief-mobile.png" alt="Campaign brief on mobile" width="260" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/16-collab-creator-mobile.png" alt="Creator workspace on mobile" width="260" />
  <br /><sub>Creator flows are designed for phones first.</sub>
</p>

## What's in the MVP

**For brands:** campaign builder · applicant comparison and shortlisting · offers · content review with revision limits · signed conversion webhook and CSV import · settlement approval and payouts · ledger and billing · creator discovery

**For creators:** campaign discovery with the payout formula up front · earnings calculator · applications · agreement acceptance · tracked link and coupon code · earnings history · profile, portfolio and account evidence

**For operations:** dispute resolution that holds only the disputed amount · event overrides with an audit reason · creator and business verification · full audit trail

**Under the hood**
- **Versioned agreements:** accepted terms are never edited. Changes create an amendment both sides must accept.
- **Deterministic settlement:** the same events and agreement version always produce the same payout. Approvals are incremental and idempotent, so nobody is paid twice.
- **Append-only, double-entry ledger:** every transaction balances to zero, and database triggers block edits and deletes. Corrections are new entries.
- **Evidence over vanity metrics:** every number is labelled *Verified API*, *Verified event*, *Creator reported*, *Estimated* or *Stale*, with its source and date.
- **Tenant isolation:** brands can't see each other's campaigns, applicants or reports, enforced on the server and covered by tests.
- **Advisory matching:** match signals are explained in plain language and never auto-reject anyone.

## Run it locally

Requires Node.js 20+. No database setup needed.

```bash
git clone https://github.com/Prateek320/project-creator.git
cd project-creator
npm install
npm run dev
```

Open **http://localhost:3000** and pick a demo account. The first load takes a few seconds while it builds the demo data in an embedded Postgres (PGlite), saved in `./.data`.

| Demo account | What to try |
|---|---|
| **Aarav** · Glow Botanics (brand) | Approve Meera's last Story → *Send signups* → approve the settlement → pay out |
| **Nisha** · Urban Stride (brand) | A performance campaign with a dispute over returned orders |
| **Meera** (creator) | Active collaboration, tracked link, paid history (try it at phone width) |
| **Zoya** (creator) | Accept a waiting offer |
| **Ritu** (operations) | Resolve the open dispute with a written reason |

Reset everything from **Team & settings → Reset demo data**.

<details>
<summary><b>Use a real Postgres database</b></summary>

```bash
cp .env.example .env.local
# DATABASE_URL=postgres://user:pass@localhost:5432/project_creator
# SESSION_SECRET=<long random string>
npm run db:smoke   # runs migrations + seed and checks every ledger transaction balances
npm run build && npm start
```
</details>

<details>
<summary><b>Architecture</b></summary>

A modular monolith: Next.js 15 App Router, TypeScript (strict), Tailwind CSS v4, Drizzle ORM, PostgreSQL.

```
src/domain/     pure business logic: compensation engine, state machines, ledger rules, attribution, money
src/server/     services; every function takes the signed-in user and checks access
src/app/        pages (server components), thin server actions, API routes
src/db/         schema, connection (PGlite or Postgres), demo seed
drizzle/        SQL migrations, including triggers that make the ledger and audit log append-only
tests/          domain unit tests + service integration tests on in-memory Postgres
```

Endpoints:
- `POST /api/v1/attribution/events`: signed (HMAC-SHA256), idempotent, rate-limited conversion webhook
- `GET /r/[slug]`: first-party tracked link with deduplicated clicks and bot filtering
- `GET /api/health`
</details>

<details>
<summary><b>Quality checks</b></summary>

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

29 tests cover payout formulas, exclusions, caps and floors, determinism, state transitions, webhook signatures and replay, tenant isolation, role checks, amendments, revision limits, ledger integrity, dispute holds and payout reversals.
</details>

## Status and roadmap

This is an **MVP demo**. No real money moves and no live social data is fetched: payments and social platforms run through mock adapters.

- **Now:** full campaign → apply → agree → deliver → verify → settle loop, with mock payments
- **Next:** managed login with MFA · a regulated payment provider for collections and payouts (e.g. Razorpay Route, after legal review) · creator-authorised Instagram and YouTube data · file uploads · email notifications
- **Later:** smarter matching built on verified outcomes · agency workspaces · creator reputation that travels with them · more channels and countries

Initial market: Indian D2C brands (beauty, fashion, fitness, food) running Instagram and YouTube creator campaigns.

---

<sub>Built by <a href="https://github.com/Prateek320">Prateek Bhoge</a>. Product and design are in progress.</sub>
