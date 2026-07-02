#!/bin/bash
set -e

BRANCHES=(
  "palette-hydration-aria-labels-4380512428676255384"
  "palette/a11y-textarea-label-15138808250642729178"
  "palette/hydration-aria-labels-12349171363389674913"
  "sentinel/fix-password-hash-leak-18065696023839456361"
)

git checkout main
git pull origin main

for branch in "${BRANCHES[@]}"; do
  echo "=================================================="
  echo "Processing $branch..."
  
  git restore tsconfig.tsbuildinfo || true
  
  if ! git checkout "$branch" 2>/dev/null; then
     git checkout -b "$branch" "origin/$branch"
  fi
  git pull origin "$branch"
  
  echo "Merging main into branch to get latest fixes..."
  git merge main --no-edit || {
    echo "FAILED: Merge conflict when merging main into $branch"
    exit 1
  }
  
  echo "Typechecking branch $branch..."
  rm -rf .next
  if ! npm run typecheck; then
    echo "FAILED: typecheck on $branch"
    exit 1
  fi
  
  git checkout main
  git pull origin main
  
  if ! git merge "$branch" --no-edit; then
    echo "FAILED: Merge conflict when merging $branch into main"
    exit 1
  fi
  
  echo "Typechecking main after merge..."
  if ! npm run typecheck; then
    echo "FAILED: typecheck on main after merging $branch"
    exit 1
  fi
  
  git push origin main
  echo "SUCCESS: Merged and pushed $branch into main!"
done

echo "=================================================="
echo "Morning sync complete. All branches merged successfully."
