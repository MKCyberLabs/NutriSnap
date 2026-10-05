# NutriSnap Isolated Local Development Baseline

**Date:** 2026-10-04  
**Target Repository:** `MKCyberLabs/NutriSnap`  
**Host Machine:** Omarchy workstation (`mkcyberlabs`)  
**Baseline Git Commit:** `546f61f8eb4f39033dcb9a194098def1d310835b` (synced fast-forward with `origin/main`)  
**Target Issue:** #129 (NutriSnap Life Hub v0.1)

---

## 1. Development Architecture Overview

The local development environment is strictly isolated from the OpenClaw production host and the Paperclip VM:

```
[ Browser / Client ]
         │
         ▼
[ Next.js 15.5.9 Dev Server ] (Port: 3000)
    ├── Local Worktree: /home/mkcyberlabs/Projects/NutriSnap
    ├── Node.js: v26.7.0 (Host)
    ├── App Mode: Development (.env loaded)
    ├── Mock Mode: USE_MOCK_HEALTH_API=true (Health Matrix mock)
    ├── Telegram Bot: TELEGRAM_BOT_TOKEN=mock (isolated, no production side-effects)
    │
    ▼
[ PostgreSQL 15 Database ] (Port: 5432)
    ├── Container Name: nutrisnap_db_dev
    ├── Image: postgres:15-alpine
    ├── Network: proxy (bridge)
    ├── Volume: nutrisnap_pgdata_dev (isolated from production pgdata)
    └── Database Name: nutrisnap
```

---

## 2. Services, Containers, and Ports

| Component | Service / Container | Host Address / Port | Notes |
| :--- | :--- | :--- | :--- |
| **Database** | `nutrisnap_db_dev` | `localhost:5432` | Postgres 15 Alpine, isolated Docker volume `nutrisnap_pgdata_dev` |
| **Web Server** | Next.js Dev (`next dev`) | `http://localhost:3000` | Full Turbopack Next.js 15.5.9 runtime |
| **Docker Network** | `proxy` | `bridge` | Local Docker network dedicated to dev container routing |

---

## 3. Configuration & Isolation Safeguards

An isolated `.env` file was provisioned based on `.env.example`:

- `DATABASE_URL`: `"postgresql://nutrisnap:nutrisnap_pass@localhost:5432/nutrisnap"`
- `ADMIN_INITIAL_PASSWORD`: `"DevelopmentPassword123!"` (Safe dev password; seeded via `prisma/seed.ts`)
- `USE_MOCK_HEALTH_API`: `"true"` (Intercepts AI analysis and returns high-fidelity schema-compliant mock nutrition data)
- `PYTHON_API_URL`: `"http://localhost:5000/health-matrix"`
- `TELEGRAM_BOT_TOKEN`: `"mock"` (Ensures GramIO/GrammY bot instances fail gracefully without messaging production channels)
- `TELEGRAM_WEBHOOK_SECRET`: `"mock_dev_secret"`
- `GEMINI_API_KEY`: `"mock_dev_gemini_key"`

---

## 4. Setup and Startup Commands

### Step 1: Initialize Docker Network & PostgreSQL
```bash
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
docker compose -f docker-compose.dev.yml up -d db
```

### Step 2: Push Prisma Schema & Seed Admin User
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### Step 3: Start Next.js Development Server
```bash
npx next dev -p 3000
```

---

## 5. Baseline Verification Results

### Automated Test Suite Results
1. **Analysis Contract Unit Tests (`npm run test:analysis-contract`)**:
   - `prefers the structured result field`: **PASS**
   - `supports legacy CLI-prefixed response text`: **PASS**
   - `extractor respects braces inside JSON strings`: **PASS**
   - `turns NOT_FOOD into the domain error`: **PASS**
   - `rejects an invalid structured result`: **PASS**
   - **Result**: 5 passed, 0 failed.

2. **TypeScript Compilation Check (`npm run typecheck`)**:
   - `tsc --noEmit`: **PASS** (0 errors).

3. **Next.js Production Build (`npm run build`)**:
   - Compiled successfully in 44s.
   - Generated static pages (15/15).
   - **Result**: **PASS** (exit code 0).

4. **HTTP End-to-End API Suite**:
   - `GET http://localhost:3000/`: **PASS** (HTTP 200).
   - `POST /api/auth/login` (Admin): **PASS** (HTTP 200, valid session cookie returned).
   - `POST /api/auth/login` (Bad credentials): **PASS** (HTTP 401 Unauthorized).
   - `GET /dashboard`: **PASS** (HTTP 200 with session cookie).
   - `GET /hydration`: **PASS** (HTTP 200 with session cookie).
   - `POST /api/analyze-meal` (Authenticated): **PASS** (HTTP 200, mock nutritional breakdown returned).
   - `POST /api/analyze-meal` (Unauthenticated): **PASS** (HTTP 401 Unauthorized).

5. **Prisma ORM & CRUD Operations**:
   - User lookup: **PASS**
   - MealLog & FoodItem creation & deletion: **PASS**
   - HydrationLog creation & deletion: **PASS**
   - Reminder creation & upsert: **PASS**

---

## 6. Known Limitations

1. **Python AI Analysis Service**:
   - The production external Python Flask/AGY CLI microservice is not hosted locally on Omarchy.
   - NutriSnap's built-in `USE_MOCK_HEALTH_API=true` setting intercepts meal analysis requests at `/api/analyze-meal` and serves validated, schema-compliant mock responses.
2. **Telegram Outbound Notifications**:
   - `TELEGRAM_BOT_TOKEN` is intentionally set to `mock`. Telegram webhook registration and outbound push notifications are disabled to prevent any production message leakage.
3. **Linter Script (`npm run lint`)**:
   - `eslint` package is not declared in `package.json` devDependencies; `npm run lint` fails with `ESLint must be installed`. This is a pre-existing dependency gap in the upstream repository.

---

## 7. Rollback & Stop Commands

To completely stop the isolated development instance:

```bash
# Stop Next.js dev server:
kill $(pgrep -f "next dev -p 3000")

# Stop and remove the dev database container:
docker stop nutrisnap_db_dev && docker rm nutrisnap_db_dev

# Optional: To remove the isolated dev database volume (destructive to dev data only):
docker volume rm nutrisnap_pgdata_dev
```
