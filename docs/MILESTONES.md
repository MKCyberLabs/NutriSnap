# NutriSnap: Project Milestones & Roadmap

This document outlines the current evidence-based baseline of NutriSnap alongside the current and next three development milestones, grounded strictly in repository artifacts and Git history.

---

## 1. Current Baseline

Based on repository inspection, NutriSnap currently provides:

- **Frontend & App Architecture**: Next.js 15 (React 19, Tailwind CSS, Radix UI primitives, Recharts) structured with App Router in `src/app`.
- **Database & Data Layer**: Containerized PostgreSQL managed through Prisma ORM (`prisma/schema.prisma`), modeling `User`, `MealLog`, `FoodItem`, `Reminder`, `HydrationSetting`, and `HydrationLog`.
- **Authentication & RBAC**: Custom credentials auth with `USER` and `ADMIN` roles, bcrypt password hashing, onboarding gate enforcement (`/onboarding`), and brute-force rate limiting on the login endpoint.
- **Nutrition Tracking Dashboard**: Quad-meal segmented board (Breakfast, Lunch, Dinner, Snacks) tracking calories, macros (protein, carbs, fat), and secondary nutrients (fiber, sugar, saturated fat).
- **AI Meal Analysis**: Multi-modal meal analysis via an external Python microservice (`gemini-api` on host port 5000), supporting structured `result` objects and legacy `response` extraction validated via Zod (`src/lib/python-analysis-response.ts`, [AI_PROVIDER_ARCHITECTURE.md](AI_PROVIDER_ARCHITECTURE.md)).
- **Telegram Bot Integration**: Webhook receiver (`/api/telegram/webhook`) built with `grammY` ([TELEGRAM_SETUP.md](../TELEGRAM_SETUP.md)), supporting photo uploads, meal logging, slash commands (`/help`, `/goals`, `/setgoal`, `/settimezone`, `/reminder`, `/summary`), inline button water logging (`hyd_250`, `hyd_500`, custom amount reply), and cron reminder dispatch via `node-cron` (`src/lib/scheduler.ts`).
- **Container Infrastructure**: Docker Compose configs (`docker-compose.yml`, `docker-compose.dev.yml`) and multi-stage `Dockerfile`. Schema synchronization is performed manually via `prisma db push`, and `src/instrumentation.ts` guards the background scheduler during build execution by checking CLI arguments and npm lifecycle events.

---

## 2. Current Milestone

- **Name**: Baseline Hardening and Multi-Provider AI Compatibility
- **Goal**: Stabilize the Next.js/Python dual-tier architecture by completing transition to validated structured JSON meal responses, enforcing auth rate limiting, and standardizing Docker-based development and deployment.

---

## 3. Next 3 Milestones

### Milestone 1: Multi-Provider AI Rollout & Automated Fallback Verification
- **Goal**: Operationalize multi-provider meal analysis (Antigravity `agy`, OpenRouter, Google Gemini API) with robust fallback mechanisms as designed in [AI_PROVIDER_ARCHITECTURE.md](AI_PROVIDER_ARCHITECTURE.md).
- **Concrete Outcomes**:
  1. Validate Python backend with `ANALYSIS_FALLBACK_PROVIDER` active to handle retriable provider failures (timeouts, rate limits).
  2. Implement text and image fixture verification suites covering OpenRouter and Google Gemini models without UI drift.
  3. Surface provider execution telemetry (`meta.provider`, `meta.latency`, fallback state) in internal admin diagnostics.
  4. Verify stateless `agy -p` CLI execution stability under concurrent request patterns.
- **Completion Criteria**:
  - Meal analysis succeeds across primary (`agy`) and configured fallback providers.
  - Retriable provider errors trigger fallback cleanly without user-facing 500 errors.
  - All adapter contract tests (`npm run test:analysis-contract`) pass without regression.

### Milestone 2: Automated CI Pipeline & Host Verification Standardization
- **Goal**: Implement automated continuous integration (CI) workflows and resolve host-versus-container test execution ergonomics.
- **Concrete Outcomes**:
  1. Add a GitHub Actions CI pipeline running linting, type checks, and contract tests on all pull requests.
  2. Standardize host-level dependency installation and test execution (`npm ci` and Prisma client generation).
  3. Automate database schema validation and Prisma migration checks against ephemeral PostgreSQL services in CI.
  4. Add build-time smoke verification ensuring `src/instrumentation.ts` build lifecycle guards prevent Next.js static collection hangs.
- **Completion Criteria**:
  - Pull requests trigger automated CI with passing checks for `npm run lint`, `npm run typecheck`, and contract tests.
  - New developers or CI runners can execute contract tests locally on host without Docker dependency.
  - Production container build succeeds deterministically in CI within standard time limits.

### Milestone 3: Hydration Scheduling Hardening & Telegram Interaction Loop
- **Goal**: Harden hydration scheduling, add direct Telegram logging commands, and close the real-time notification loop between Telegram interactions and the dashboard.
- **Concrete Outcomes**:
  1. Implement direct Telegram slash commands (such as `/logwater <amount>`) with input validation and help text to enable logging without awaiting prompt buttons.
  2. Harden scheduler lifecycle management in `src/lib/scheduler.ts` by replacing unmanaged in-memory timer callbacks with robust reminder delivery tracking.
  3. Implement automated end-of-day nutrition and hydration recap dispatches in `src/lib/scheduler.ts` to complement on-demand `/summary` command queries.
  4. Add auto-refresh or revalidation hooks to the `/hydration` dashboard so logs submitted via Telegram callback buttons or commands appear without manual browser refreshes.
- **Completion Criteria**:
  - Users can log water intake directly via Telegram command without waiting for scheduled reminder buttons.
  - Scheduler runs reliably across long daemon lifecycles without leaking timers or unhandled rejection callbacks.
  - Daily recap summaries are automatically delivered to configured Telegram users at their daily cutoff times.
  - Telegram hydration logs immediately reflect on the `/hydration` web UI.

---

## 4. Known Risks & Dependencies

- **External Python Service Dependency**: Meal analysis depends on the host Python service (`gemini-api.service` via `PYTHON_API_URL`). Next.js meal analysis fails if the Python daemon is down or unreachable ([README.md](../README.md)).
- **Host Antigravity CLI Execution**: The default AI provider invokes `agy -p` at the host level, requiring an active Antigravity CLI installation and valid authentication outside Docker.
- **Next.js Build Event Loop Hang**: Initializing background workers during Next.js static collection halts `npm run build` if the scheduler runs; currently guarded in `src/instrumentation.ts` via CLI argument and npm lifecycle checks (`isBuild`) rather than container environment flags ([README.md](../README.md)).
- **Database Schema Drift**: Prisma push is used instead of formal migration histories (`npx prisma db push --accept-data-loss`), creating risk of schema drift or unintended data loss when that manual command is run ([SETUP.md](../SETUP.md)).
- **Telegram Public Ingress Requirement**: Telegram webhooks require valid public HTTPS URLs and bot tokens; offline or local testing is restricted without tunnels or mocks ([TELEGRAM_SETUP.md](../TELEGRAM_SETUP.md)).
- **Fresh Clone Host Environment**: In a clean clone, `node_modules` is not populated; host verification commands require running `npm ci` before `tsx` or `tsc` can execute ([package.json](../package.json)).

---

## 5. Existing Verification Commands

The following verification commands from the repository remain applicable:

- **Analysis Contract Test**: `npm run test:analysis-contract` (runs `tsx --test src/lib/python-analysis-response.test.ts`, validates Python API response envelope parsing and Zod schemas).
- **TypeScript Compilation Check**: `npm run typecheck` (runs `tsc --noEmit`, verifies frontend type correctness).
- **ESLint Linting**: `npm run lint` (runs `next lint`, validates code conventions).
- **Next.js Production Build**: `npm run build` (runs `NODE_ENV=production next build`, validates static page generation and bundle integrity).
- **Comprehensive End-to-End Suite**: `./test-all-nutrisnap.sh` (validates HTTP 200 homepage, admin login, invalid credential rejection, and authenticated meal analysis against port 3001; requires a running local container/service and a seeded admin user account per [SETUP.md](../SETUP.md)).
- **Telegram Webhook Test**: `./test-webhook.sh` (sends mock Telegram update payload to local webhook endpoint; requires a running local service on port 3001 with active `/api/telegram/webhook`).
- **Python Service Tests** (documented in [AI_PROVIDER_ARCHITECTURE.md](AI_PROVIDER_ARCHITECTURE.md)):
  - `./venv/bin/python -m unittest discover -s tests -v`
  - `./venv/bin/python -m py_compile app.py analysis_contract.py prompts.py providers.py`
