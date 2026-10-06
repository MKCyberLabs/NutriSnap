# AGY-Manickam — Food Live AI Correction

You are the sole implementation agent.

Continue on:
`feature/v0.1-ui-redesign`

Do not orchestrate or delegate.

## Owner-observed defect

A real chapati + capsicum meal logged around 14:00 appeared as:
- Breakfast;
- Grilled Chicken;
- 450 kcal.

The static UAT fixture contains the Grilled Chicken / 450 kcal signature.

Therefore first prove and remove UAT mock interception before diagnosing Gemini quality.

## Read first

1. `FOOD_LIVE_AI_PLAN.md`
2. `FOOD_LIVE_AI_TEST_MATRIX.md`
3. existing `docs/AI_PROVIDER_ARCHITECTURE.md`
4. current Food upload/analyze/persistence code.

Also inspect the live Python service checkout:
`/home/openclaw/Projects/vision-health-app/gemini-api`

Do not expose secrets.

## Phase 1 — Diagnose current UAT

Prove the running UAT values for:
- `USE_MOCK_HEALTH_API`;
- `PYTHON_API_URL`.

Do not merely inspect the repository .env; inspect the running container environment safely without printing unrelated secrets.

Verify Python:
- `/health`;
- `/ready`;
- selected image provider readiness.

Verify NutriSnap container can reach Python.

Verify the image share path end-to-end.

If any boundary fails, fix that exact boundary first.

## Phase 2 — Enable real UAT analysis

UAT must use:
```env
USE_MOCK_HEALTH_API=false
```

Set `PYTHON_API_URL` to the verified local Python service endpoint.

Recreate only the UAT NutriSnap app as necessary.

Do not touch UAT DB volume.
Do not touch production server/domain.

Never silently fall back to the static mock after provider failure.

## Phase 3 — Correct Food UX/category

Implement deterministic category inference exactly as specified in `FOOD_LIVE_AI_PLAN.md`.

At 14:00 default must be:
`Lunch`.

Add visible manual category override.

Add a primary `Log Meal` flow if needed so owner does not have to choose a wrong summary card just to begin logging.

Implement analyze -> review -> save.
Do not persist immediately after analysis.

## Phase 4 — Preserve live Python contract

Use existing:
`/health-matrix`.

Do not invent a second meal API.

Preserve:
- auth;
- upload validation;
- Zod contract;
- NOT_FOOD handling;
- persisted image paths.

Use the Python provider/model already configured for the production-equivalent vision service.
Do not change model tier unless owner explicitly requests it.

## Phase 5 — Test real scenario

Use a real food image.

Owner reference:
chapati + capsicum at 14:00.

The result must:
- reach Python;
- reach real configured provider;
- not equal the static mock merely because UAT is configured incorrectly;
- default category to Lunch;
- be reviewable before Save;
- persist to DB only after Save;
- update Food;
- update Today.

AI output is probabilistic: do not fail solely because calories differ from human expectation.
Fail if it is demonstrably still the static mock, cannot see the image, violates schema, or saves without confirmation.

## Phase 6 — Full regression

Execute all tests in `FOOD_LIVE_AI_TEST_MATRIX.md`.

Use browser mode on:
`https://wealth.mkcyberlabs.in`.

Do not access or modify the separate production NutriSnap server.

Commit and push meaningful checkpoints.

Update `STATUS.md` with:
- UAT env state;
- Python readiness;
- shared path proof;
- provider/model (non-secret);
- real-image test;
- Food persistence;
- Today dashboard result;
- full test counts.

Do not merge.

Final line:
`FOOD LIVE AI UAT: PASS — REAL PYTHON/GEMINI PATH VERIFIED`
