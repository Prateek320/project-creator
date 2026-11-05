#!/bin/sh
# Commit everything and push to GitHub. Usage: npm run ship -- "what changed"
set -e
MSG="${1:-Update proovd}"
git add -A
git commit -m "$MSG" || echo "Nothing new to commit."
git push
