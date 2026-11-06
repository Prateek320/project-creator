#!/bin/sh
# Vercel build command (vercel.json). Applies migrations on production deployments of each Vercel
# project (proovd = main, proovd-staging = staging), then builds. Never at boot (CLAUDE.md).
# Migrations run before the new code goes live, so they must be backward compatible with the code
# that is still serving (expand first, contract in a later deploy).
set -e
if [ "$VERCEL_ENV" = "production" ]; then
  URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
  if [ -z "$URL" ]; then
    echo "DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set for production builds" >&2
    exit 1
  fi
  DATABASE_URL="$URL" npx tsx scripts/migrate.ts
fi
npx next build
