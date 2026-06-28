#!/bin/bash

# Branches to merge
BRANCHES=(
  "bolt-optimize-reduce-1811968732440251659"
  "bolt-prisma-indexes-11415374920002339231"
  "jules-fix-pass-the-hash-12297953594908552791"
  "sentinel-llm-sqli-fix-6170983515175656352"
  "sentinel/fix-sql-injection-7097439230439092686"
  "ux-aria-labels-7097487818217773673"
)

git checkout main
git reset --hard origin/main

for branch in "${BRANCHES[@]}"; do
  echo "----------------------------------------"
  echo "Processing $branch..."
  
  git checkout "$branch" 2>/dev/null || git checkout -b "$branch" "origin/$branch"
  
  echo "Running typecheck for $branch"
  rm -rf .next
  if ! npm run typecheck; then
    echo "Typecheck failed on $branch. Exiting."
    exit 1
  fi
  
  echo "Merging main into $branch..."
  if ! git merge main --no-edit; then
    echo "Merge conflict in $branch when merging main into it. Exiting for manual resolution."
    exit 1
  fi
  
  echo "Running typecheck after merge..."
  rm -rf .next
  if ! npm run typecheck; then
    echo "Typecheck failed after merge on $branch. Exiting."
    exit 1
  fi
  
  echo "Merging $branch into main..."
  git checkout main
  git merge "$branch" --no-edit
done

echo "----------------------------------------"
echo "All branches merged successfully."
