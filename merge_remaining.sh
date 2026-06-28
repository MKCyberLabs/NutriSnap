#!/bin/bash
set -e

# Remaining branches
BRANCHES=(
  "bolt-prisma-indexes-11415374920002339231"
  "jules-fix-pass-the-hash-12297953594908552791"
  "ux-aria-labels-7097487818217773673"
)

for branch in "${BRANCHES[@]}"; do
  echo "----------------------------------------"
  echo "Processing $branch..."
  
  git checkout -- tsconfig.tsbuildinfo || true
  git checkout "$branch"
  
  echo "Running typecheck for $branch"
  rm -rf .next
  git checkout -- tsconfig.tsbuildinfo || true
  if ! npm run typecheck; then
    echo "Typecheck failed on $branch. Exiting."
    exit 1
  fi
  
  echo "Merging main into $branch..."
  git checkout -- tsconfig.tsbuildinfo || true
  if ! git merge main --no-edit; then
    echo "Merge conflict in $branch when merging main into it. Exiting for manual resolution."
    exit 1
  fi
  
  echo "Running typecheck after merge..."
  rm -rf .next
  git checkout -- tsconfig.tsbuildinfo || true
  if ! npm run typecheck; then
    echo "Typecheck failed after merge on $branch. Exiting."
    exit 1
  fi
  
  echo "Merging $branch into main..."
  git checkout -- tsconfig.tsbuildinfo || true
  git checkout main
  git merge "$branch" --no-edit
done

echo "----------------------------------------"
echo "All remaining branches merged successfully."
git push origin main
