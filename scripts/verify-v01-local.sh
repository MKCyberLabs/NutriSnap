#!/usr/bin/env bash
set -euo pipefail

expected_branch="feature/v0.1-health-wealth"
branch=$(git branch --show-current)

if [[ "$branch" != "$expected_branch" ]]; then
  echo "ERROR: expected branch $expected_branch, got $branch" >&2
  exit 2
fi

echo "== NutriSnap v0.1 local software gate =="
echo "branch: $branch"
echo "head: $(git rev-parse HEAD)"

git diff --check

npm run test:analysis-contract
npm run typecheck
npm run build

for script in test:finance test:reminders test:life-hub; do
  if ! node -e 'const p=require("./package.json"); process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1)' "$script"; then
    echo "ERROR: required v0.1 package script missing: $script" >&2
    exit 3
  fi
  npm run "$script"
done

echo "PASS: NutriSnap v0.1 local software gate"
