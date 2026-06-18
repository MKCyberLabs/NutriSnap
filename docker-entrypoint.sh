#!/bin/sh
set -e

echo "============================================"
echo "  NutriSnap Docker Entrypoint"
echo "============================================"

echo ""
echo "==> [1/3] Pushing Prisma schema to PostgreSQL..."
npx prisma db push --skip-generate --accept-data-loss
echo "    Schema push complete."

echo ""
echo "==> [2/3] Seeding database with admin user..."
npx prisma db seed 2>&1 || echo "    Seeding skipped (admin may already exist)."

echo ""
echo "==> [3/3] Starting NutriSnap Next.js server on port ${PORT:-9002}..."
echo "============================================"
exec npx next start -p "${PORT:-9002}" -H "${HOSTNAME:-0.0.0.0}"
