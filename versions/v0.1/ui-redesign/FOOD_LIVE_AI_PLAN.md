# Food Live AI Plan — UAT/Production-Equivalent Meal Analysis

Status: FROZEN FOR IMPLEMENTATION
Owner: Manickam
Implementation agent: AGY-Manickam only
Branch: `feature/v0.1-ui-redesign`

## Problem observed in UAT

Owner uploaded a real meal containing chapati + capsicum at approximately 14:00.

UAT displayed:
- meal category: Breakfast;
- recognized item: Grilled Chicken;
- calories: 450.

The static UAT mock file currently contains the same signature:
- `450` calories;
- `Grilled Chicken`.

Therefore the incorrect food recognition is not a Gemini failure. UAT is still executing the explicit NutriSnap mock branch.

Current route behavior:

```ts
if (process.env.USE_MOCK_HEALTH_API === 'true') {
  return NextResponse.json(healthMatrixMock);
}
```

The real production-equivalent path already exists:

```text
Browser
  -> POST /api/upload
  -> /uploads/<uuid>.<ext>
  -> POST /api/analyze-meal
  -> mealNutritionalAnalysis()
  -> PYTHON_API_URL
  -> vision-health-app /health-matrix
  -> provider router
  -> Gemini via AGY / configured provider
  -> validated meal JSON
  -> NutriSnap saves MealLog/FoodItem
  -> Food dashboard + Today read model
```

## Goal

Make UAT Food operate through the same real Python/Gemini analysis path intended for production while preserving environment isolation from the real production NutriSnap server.

The owner must be able to:
1. upload a real meal image;
2. have Python/Gemini identify the actual foods;
3. review the analysis before persistence;
4. save it under the correct meal category;
5. see the saved meal immediately in Food;
6. see today's nutrition totals update on `/today`.

## Scope

### In scope
- Disable Health Matrix mock interception in UAT.
- Verify Python API health/readiness.
- Verify NutriSnap container -> Python API networking.
- Verify shared upload path end-to-end.
- Use real image analysis.
- Add deterministic meal-category inference from selected meal time.
- Add manual category override.
- Add analysis confirmation step before DB persistence.
- Preserve/edit AI-returned food item detail.
- Update Food and Today from saved real data.
- Add tests and UAT evidence.
- Safe service-unavailable/error behavior.

### Out of scope
- Production deployment.
- Production DB changes.
- New AI providers.
- Switching the production provider/model.
- Telegram redesign.
- Finance/Water/Reminder changes.
- Fine-tuning Gemini.
- Exact calorie guarantees from vision AI.

## Architecture decision

### AI responsibilities

Python/Gemini owns:
- food recognition;
- estimated grams;
- calories;
- protein;
- carbs;
- fat;
- fiber;
- saturated fat;
- sugar;
- 1-5 food item rating;
- health insight;
- NOT_FOOD determination.

### NutriSnap responsibilities

NutriSnap owns:
- authentication;
- image upload;
- selected meal time;
- deterministic web meal category default;
- manual category override;
- analysis preview/confirmation;
- persistence;
- dashboard aggregation;
- user-visible errors.

Do not ask the vision model to decide a browser meal category when the app already has an explicit local meal time.

## UAT environment contract

UAT NutriSnap:
- host: OpenClaw;
- domain: `https://wealth.mkcyberlabs.in`;
- app container: historical name `nutrisnap_prod`;
- host port: 3001;
- database: UAT-local only.

Python service:
- repository: `/home/openclaw/Projects/vision-health-app` or actual live checkout;
- Flask app: `gemini-api/app.py`;
- default listener: `172.17.0.1:5000`;
- NutriSnap container endpoint: `http://host.docker.internal:5000/health-matrix`;
- readiness endpoints: `/health`, `/ready`.

Required NutriSnap UAT env:
```env
USE_MOCK_HEALTH_API=false
PYTHON_API_URL=http://host.docker.internal:5000/health-matrix
```

Do not put provider credentials into NutriSnap if the selected provider is AGY.
Provider/model credentials/config remain in the Python service.

## Provider rule

Use the Python service's current production-equivalent provider settings.

Expected default architecture:
```env
ANALYSIS_IMAGE_PROVIDER=agy
ANALYSIS_TEXT_PROVIDER=agy
ANALYSIS_FALLBACK_PROVIDER=none
AGY_IMAGE_MODEL=<current configured production-equivalent model>
AGY_TEXT_MODEL=<current configured production-equivalent model>
```

Do not silently change `AGY_IMAGE_MODEL` during this fix.

Record actual selected provider/readiness from `/ready`.

## Shared image path gate

NutriSnap Docker currently maps a host directory to:

```text
/app/public/uploads
```

The Python service receives only:
```text
/uploads/<basename>
```

and resolves the basename inside its own `HOST_TEMP_DIR`.

Before live image UAT, prove:
1. upload returns a UUID path;
2. exact file exists in NutriSnap `/app/public/uploads`;
3. the same bytes exist in Python's resolved host image directory;
4. Python can open it.

If NutriSnap and Python point at different host directories, do not copy files ad hoc per request.

Preferred durable correction only if mismatch is proven:
- make Python shared upload root configurable with an environment variable, while retaining the existing path as fallback;
- configure that variable to the same canonical host directory mounted by NutriSnap;
- add a Python test for path resolution.

Do not weaken filename validation.

## Meal-category behavior

### Pure inference

Add a pure helper such as:
`inferMealCategoryFromTime("HH:mm")`.

Frozen v0.1 defaults:
- Breakfast: 05:00-10:59
- Lunch: 11:00-15:59
- Snacks: 16:00-17:59
- Dinner: 18:00-22:59
- Snacks: 23:00-04:59

Therefore:
`14:00 -> Lunch`.

### Manual override

The analysis UI must visibly show:
- meal time;
- meal category.

Default category is inferred from time.

The user may explicitly override to:
- Breakfast
- Lunch
- Dinner
- Snacks.

Once the user manually overrides category, do not silently change it unless they choose Auto again.

### Category-card behavior

Add one clear primary `Log Meal` action on Food.

Category cards are summaries.

If per-category + buttons remain, label their intent clearly and still show the editable category field in the confirmation step.

Do not silently persist a category solely because the first card happened to be clicked.

## Analysis UX

Current behavior immediately passes analysis result into persistence.

Change to two stages:

### Stage A — Analyze
Inputs:
- time;
- optional description;
- optional image;
- inferred/editable category.

Action:
`Analyze Meal`

### Stage B — Review
Show:
- image thumbnail if present;
- inferred/manual category;
- time;
- food items;
- estimated grams;
- calories and macros per item;
- total calories/macros;
- health insight.

Actions:
- `Save Meal`
- `Analyze Again`
- `Cancel`

Do not persist until Save Meal.

This gives the owner a final correctness checkpoint when AI vision is imperfect.

## Live data persistence

On Save:
- persist one MealLog;
- persist returned FoodItems;
- persist selected category;
- persist selected meal time/date;
- retain image path;
- mark pending state only during the write;
- avoid duplicate save on double click.

After save:
- Food page cards update;
- Daily Activity updates;
- biometric totals update;
- navigating to Today shows the new totals from DB;
- Today must not read the static mock.

## Error states

### Python not reachable
Show:
`Meal analysis service is temporarily unavailable. Your meal has not been saved.`

### Provider timeout/rate limit
Show safe retry message.
Do not save mock data automatically.

### Invalid provider output
No persistence.

### NOT_FOOD
Explain that no identifiable food was detected.
No persistence.

### Upload failure
Do not call image analysis with an undefined image path unless a text description is present.

## Mock policy

The mock remains available only for isolated automated/dev tests.

In live UAT:
`USE_MOCK_HEALTH_API=false`.

Never silently fall back from live provider failure to `health-matrix.json`.

Optional hygiene:
- validate the mock fixture against the same output schema;
- make the fixture fully contract-complete.

## Observability

For each UAT real analysis, evidence should connect:
- NutriSnap request timestamp;
- uploaded UUID filename;
- Python request ID;
- provider;
- model;
- fallback flag;
- latency;
- HTTP outcome.

Do not log image bytes, credentials, session cookies, provider secrets, or full private prompts.

## Rollback

If real analysis integration fails:
1. do not change production;
2. keep UAT DB intact;
3. restore prior UAT application/environment;
4. mock may be re-enabled only as an explicit temporary UAT limitation;
5. report the exact failing boundary: upload, networking, path, provider, contract, persistence, or UI.

No DB migration is expected for this Food fix.
