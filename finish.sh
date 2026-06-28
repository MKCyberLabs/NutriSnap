#!/bin/bash
set -e

# Commit the current merge
git add .
git commit --no-edit

# typecheck and merge to main
rm -rf .next tsconfig.tsbuildinfo
npm run typecheck
git checkout main
git merge jules-fix-pass-the-hash-12297953594908552791 --no-edit

# Process the final branch
branch="ux-aria-labels-7097487818217773673"
echo "----------------------------------------"
echo "Processing $branch..."
git checkout "$branch" 2>/dev/null || git checkout -b "$branch" "origin/$branch"

rm -rf .next tsconfig.tsbuildinfo
npm run typecheck

# Merge main into branch
rm -f tsconfig.tsbuildinfo
git merge main --no-edit

# Final typecheck
rm -rf .next tsconfig.tsbuildinfo
npm run typecheck

# Merge back to main
rm -f tsconfig.tsbuildinfo
git checkout main
git merge "$branch" --no-edit

# Push
git push origin main
echo "All done!"
