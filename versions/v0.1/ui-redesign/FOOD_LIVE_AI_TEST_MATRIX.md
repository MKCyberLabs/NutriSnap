# Food Live AI Test Matrix

## A. Python service readiness

- FOOD-AI-001 `GET /health` -> HTTP 200, status ok.
- FOOD-AI-002 `GET /ready` -> HTTP 200, ready.
- FOOD-AI-003 selected image provider is configured.
- FOOD-AI-004 Python unit tests PASS.
- FOOD-AI-005 Python py_compile PASS.

## B. NutriSnap -> Python networking

- FOOD-AI-010 NutriSnap container resolves `host.docker.internal`.
- FOOD-AI-011 NutriSnap container can GET Python `/health`.
- FOOD-AI-012 configured `PYTHON_API_URL` targets UAT/local Python service.
- FOOD-AI-013 `USE_MOCK_HEALTH_API=false` inside the running UAT app.
- FOOD-AI-014 no request is served from static mock in live UAT.

## C. Shared image path

- FOOD-AI-020 browser upload -> HTTP 200 UUID path.
- FOOD-AI-021 file exists in NutriSnap `/app/public/uploads`.
- FOOD-AI-022 Python resolves the same basename.
- FOOD-AI-023 file hash/size matches across the shared boundary.
- FOOD-AI-024 unsupported/malformed image rejected.
- FOOD-AI-025 traversal filename rejected.

## D. Category inference

- FOOD-AI-030 07:30 -> Breakfast.
- FOOD-AI-031 10:59 -> Breakfast.
- FOOD-AI-032 11:00 -> Lunch.
- FOOD-AI-033 14:00 -> Lunch.
- FOOD-AI-034 15:59 -> Lunch.
- FOOD-AI-035 16:00 -> Snacks.
- FOOD-AI-036 17:59 -> Snacks.
- FOOD-AI-037 18:00 -> Dinner.
- FOOD-AI-038 22:59 -> Dinner.
- FOOD-AI-039 23:00 -> Snacks.
- FOOD-AI-040 04:59 -> Snacks.
- FOOD-AI-041 manual category override persists.
- FOOD-AI-042 switching back to Auto re-infers from time.

## E. Live analysis contract

Do not assert exact nutrient numbers from AI.

- FOOD-AI-050 text-only meal returns schema-valid result.
- FOOD-AI-051 image-only meal returns schema-valid result.
- FOOD-AI-052 image + description returns schema-valid result.
- FOOD-AI-053 every food item has name/grams/all nutrients/rating.
- FOOD-AI-054 totals are finite non-negative numbers.
- FOOD-AI-055 NOT_FOOD results in no save.
- FOOD-AI-056 provider unavailable results in no save.
- FOOD-AI-057 malformed provider response results in no save.
- FOOD-AI-058 analysis result is reviewed before persistence.

## F. Owner reference scenario

Use owner's real chapati + capsicum image if available.

Input:
- time: 14:00;
- image: chapati + capsicum meal;
- optional description: empty first pass.

Expected:
- request reaches real Python provider;
- result is NOT the static mock signature;
- category default = Lunch;
- recognized foods are semantically consistent with chapati/capsicum or the agent records the real model uncertainty;
- no `Grilled Chicken` solely from mock;
- user can correct category/items before Save if needed;
- Save persists returned/corrected meal;
- Food dashboard updates.

Do not require exact calorie values.

## G. Persistence/dashboard

- FOOD-AI-070 Save creates exactly one MealLog.
- FOOD-AI-071 FoodItems belong to that MealLog.
- FOOD-AI-072 selected category persists.
- FOOD-AI-073 selected meal time persists.
- FOOD-AI-074 image path persists.
- FOOD-AI-075 Food category card calories update.
- FOOD-AI-076 Daily Activity lists actual saved food names.
- FOOD-AI-077 Biometric targets/totals update from actual saved nutrients.
- FOOD-AI-078 refresh preserves DB data.
- FOOD-AI-079 `/today` Nutrition card reflects saved calories/macros.
- FOOD-AI-080 deleting/editing existing Food still behaves correctly.

## H. Security/regression

- FOOD-AI-090 unauthenticated analyze -> 401.
- FOOD-AI-091 unauthenticated upload -> 401.
- FOOD-AI-092 10MB/image signature validation preserved.
- FOOD-AI-093 user ownership preserved.
- FOOD-AI-094 no provider/API secret returned to browser.
- FOOD-AI-095 Water tests remain PASS.
- FOOD-AI-096 Finance tests remain PASS.
- FOOD-AI-097 Reminder tests remain PASS.
- FOOD-AI-098 Today tests remain PASS.
- FOOD-AI-099 build/typecheck PASS.

## I. Required commands

NutriSnap:
```bash
npm run test:analysis-contract
npm run typecheck
npm run build
npm run test:finance
npm run test:reminders
npm run test:today
npm run test:security
npm run test:ui
npm run test:life-hub
./scripts/verify-v01-local.sh
git diff --check
```

Add a focused Food test command if new tests justify it, e.g.:
`npm run test:food`.

Python:
```bash
cd /home/openclaw/Projects/vision-health-app/gemini-api
./venv/bin/python -m unittest discover -s tests -v
./venv/bin/python -m py_compile app.py analysis_contract.py prompts.py providers.py
```

## J. Browser evidence

At `https://wealth.mkcyberlabs.in`:
- desktop Food screenshot before analysis;
- analysis input with 14:00;
- review-result screenshot;
- saved Daily Activity screenshot;
- Today nutrition screenshot after save;
- 390px mobile Food screenshot;
- console/network screenshot only on failure.

## PASS criteria

PASS requires:
- live UAT mock disabled;
- Python provider request proven;
- uploaded image readable by Python;
- 14:00 defaults to Lunch;
- review before save;
- real result persists;
- Food and Today reflect persisted result;
- full software gate remains green.

Finish:
`FOOD LIVE AI UAT: PASS — REAL PYTHON/GEMINI PATH VERIFIED`
