# Runbook: staging and production on Vercel + Neon

Phase 0 item 2. One Vercel project per long-lived environment, because Vercel Cron only runs on
production deployments: a staging *preview* would never drain the job queue.

| Vercel project | Production branch | Neon branch | APP_ENV | Clerk instance |
|---|---|---|---|---|
| `proovd` | `main` | `main` | `production` | production instance |
| `proovd-staging` | `staging` | `staging` | `staging` | development instance |

Both projects: framework Next.js, root `/`, region `sin1` (from vercel.json), build command from
vercel.json (`scripts/vercel-build.sh` migrates, then builds). Disable preview deployments for other
branches, or leave them without database variables: without `DATABASE_URL` and `APP_ENV` they refuse to start.

## Environment variables (per project, Production scope)

| Variable | Value |
|---|---|
| `APP_ENV` | `staging` / `production` |
| `DATABASE_URL` | Neon **pooled** URL of the branch (`-pooler` host) |
| `DATABASE_URL_UNPOOLED` | Neon **direct** URL of the same branch (migrations) |
| `SESSION_SECRET`, `CRON_SECRET`, `ENCRYPTION_KEY` | each `openssl rand -base64 32`, different per environment |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | from the Clerk instance above |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` | `/sign-in` / `/sign-up` |
| `OPS_EMAILS` | ops people's emails, comma-separated |
| `APP_URL` | e.g. `https://staging.proovd.in` |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key; sender on a verified domain |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | same DSN; environment tag comes from `APP_ENV` |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | for source-map upload at build |
| `PRIVACY_CONTACT_EMAIL` | shown on /privacy |
| `PAYMENT_PROVIDER`, `SOCIAL_PROVIDER` | `mock` |

Vercel Cron sends `Authorization: Bearer $CRON_SECRET` to `/api/jobs/run`. On the **Hobby** plan cron
runs only once a day (vercel.json: `0 3 * * *`), so `.github/workflows/jobs.yml` drains the queue every
~5 minutes instead: set repository secrets `JOBS_URLS` and `CRON_SECRET`. Production on **Pro**: set the
vercel.json cron to `* * * * *` and remove the workflow. Hobby is for non-commercial use; move to Pro
before real customers.

## Clerk settings (each instance)
- Organizations on; membership optional (creators have personal accounts); default role `org:member`, creator role `org:admin`.
- Multi-factor: enable authenticator app (TOTP) and backup codes.
- Paths: sign-in `/sign-in`, sign-up `/sign-up`, after sign-in/up `/onboarding`.
- Production instance: add the domain and DNS records Clerk lists.

## First deploy of staging
1. `git checkout -b staging && git push -u origin staging`.
2. Create `proovd-staging` in Vercel, production branch `staging`, set the variables above.
3. Deploy. The build log must show `Migrations applied.` before `next build`.
4. `curl https://<staging>/api/health` → `{"ok":true,...}`.
5. Add the health URL to the GitHub repository variable `UPTIME_URLS` (`.github/workflows/uptime.yml`).
6. Trigger an error on purpose (e.g. a temporary route) or check Sentry's "Verify installation" to see an event tagged `staging`.
7. Run the Phase 0 exit test (docs/backend-plan.md) by hand, then the restore drill.

## Phase 0 exit test (staging)
- [ ] A new brand signs up, sets up its team (MFA on), invites a teammate; the teammate joins.
- [ ] The brand publishes a campaign.
- [ ] A new creator signs up, completes the profile, applies; the brand sends an offer; the creator accepts.
- [ ] The creator submits a deliverable URL; the brand approves it.
- [ ] Emails arrive for the invite (Clerk), offer, review request and approval (Resend).
- [ ] Download my data works; delete my account is blocked while the collaboration is open.
- [ ] Playwright suite green in CI; restore drill done (below).
