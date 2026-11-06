# Runbook: restore drill

Proves we can get the database back. Do it before launch, then quarterly, and after any change to
backups or the schema of money tables. Takes about 15 minutes. Touches nothing in production:
the restore goes to a new branch.

Neon keeps history for point-in-time restore (the window depends on the plan; check the project's
"History retention" setting and record it below).

## Steps
1. Pick a target time a few minutes in the past, in UTC, e.g. `2026-11-20T09:00:00Z`.
   Note the latest ledger entry and audit event on the source branch for comparison:
   `DATABASE_URL=<main direct URL> npx tsx scripts/verify-db.ts`
2. Create a branch from that point in time:
   - Console: Neon → project `proovd` → Branches → Create branch → parent `main` → "Past data" → the time.
   - Or CLI: `neon branches create --name restore-drill-YYYYMMDD --parent <timestamp>` (parent `main`).
3. Copy the new branch's direct connection string and verify:
   `DATABASE_URL=<restore branch URL> npx tsx scripts/verify-db.ts`
   Expect `VERIFY OK`, all migrations applied, zero unbalanced ledger groups, and latest
   ledger/audit timestamps at or just before the target time.
4. Record the result in the log below, then delete the restore branch.

## If it's a real incident
Restore to a branch as above, verify, then point the app at it (swap `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` in Vercel and redeploy) or use Neon's "Restore" to reset `main` from history.
Jobs are idempotent, so any job that ran after the restore point runs again safely; payout
transfers carry idempotency keys to the provider.

## Log
| Date | Who | Source | Target time | History retention | Result |
|---|---|---|---|---|---|
| | | | | | |
