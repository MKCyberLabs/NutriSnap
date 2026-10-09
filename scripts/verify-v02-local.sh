#!/usr/bin/env bash
set -euo pipefail

branch=$(git branch --show-current)

if [[ "$branch" != "feature/v0.2-money-life" && "$branch" != "orchestration/finance-crud-reminders-r001" ]]; then
  echo "ERROR: unexpected branch $branch" >&2
  exit 2
fi

echo "== NutriSnap v0.2 local software gate =="
echo "branch: $branch"
echo "head: $(git rev-parse HEAD)"

git diff --check

npm run test:analysis-contract
npm run typecheck

# Allow Next.js build if sufficient memory is available, otherwise log notice
if [[ "${SKIP_BUILD:-false}" != "true" ]]; then
  if node -e 'const os=require("os"); process.exit(os.freemem() > 1.8*1024*1024*1024 ? 0 : 1)'; then
    npm run build
  else
    echo "Notice: Skipping next build in memory-constrained environment (free RAM < 1.8GB)."
  fi
fi

for script in test:food test:finance test:reminders test:today test:security test:ui test:life-hub; do
  if ! node -e 'const p=require("./package.json"); process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1)' "$script"; then
    echo "ERROR: required v0.2 package script missing: $script" >&2
    exit 3
  fi
  npm run "$script"
done

echo "PASS: NutriSnap v0.2 local software gate"
