# AI provider architecture and implementation notes

## Goal

Preserve NutriSnap's existing dashboard, Telegram, database, and Python HTTP behavior while allowing meal analysis to use Antigravity (`agy`), OpenRouter, or the direct Google API. Antigravity remains the default and OpenRouter/Google remain inactive until explicitly configured.

## Boundary

NutriSnap owns authentication, Telegram handling, uploads, meal persistence, and presentation. The native Python service owns prompts, provider selection, model invocation, response validation, and optional fallback. This keeps the authenticated host-level Antigravity installation outside the NutriSnap Docker image.

Both `/health-matrix` and `/health-matrix-telegram` return:

- `result`: the validated meal object used by current NutriSnap code.
- `response`: the same object serialized as JSON for older NutriSnap images.
- `meta`: request ID, provider, model, fallback state, and latency.

NutriSnap prefers `result` and uses a balanced-brace legacy parser only when connected to an older Python service. Zod validates the final object before it reaches product code.

## Provider rules

- `ANALYSIS_TEXT_PROVIDER` and `ANALYSIS_IMAGE_PROVIDER` select `agy`, `openrouter`, or `google` independently.
- `ANALYSIS_FALLBACK_PROVIDER` is disabled by default. A configured fallback runs only after a retriable provider failure such as timeout, rate limiting, network failure, or CLI execution failure.
- Request-level provider overrides are disabled unless `ALLOW_PROVIDER_OVERRIDE=true`.
- Provider API keys remain only in the Python service environment.
- Local images are base64 encoded for OpenRouter and Google. Antigravity receives the validated local path.
- Meal requests are stateless `agy -p` calls. `agy -c` is excluded because “continue most recent conversation” is unsafe under concurrent, multi-user traffic.

## Compatibility decisions

`AGY_TEXT_MODEL` and `AGY_IMAGE_MODEL` are the preferred names. Existing `GEMINI_TEXT_MODEL` and `GEMINI_IMAGE_MODEL` settings remain fallback aliases. The default Antigravity model ID is `gemini-3.8-flash-low`.

The interactive `/ask` and `/reply` endpoints remain on their existing `pexpect` path. Provider routing applies to the two NutriSnap meal-analysis endpoints, which are non-interactive.

Analyzed uploads are no longer deleted by the meal-analysis path because NutriSnap stores their paths for historical display. Existing `/ask` session cleanup behavior is unchanged.

## Rollout

1. Run Python unit and route tests.
2. Run the NutriSnap adapter test and TypeScript check.
3. Start the updated Python service on a temporary port and check `/health`, `/ready`, and a real text meal.
4. Deploy the Python service first. Its legacy `response` field supports the currently running NutriSnap image.
5. Deploy the NutriSnap image. It will prefer the validated `result` field.
6. Configure OpenRouter or Google only after testing the chosen model with text and image fixtures.

Rollback requires only selecting `agy` again and restarting the Python service. No database migration is involved.

## Verification commands

Python service:

```bash
cd /home/openclaw/Projects/vision-health-app/gemini-api
./venv/bin/python -m unittest discover -s tests -v
./venv/bin/python -m py_compile app.py analysis_contract.py prompts.py providers.py
```

NutriSnap:

```bash
cd /home/openclaw/Projects/NutriSnap
npm run test:analysis-contract
npm run typecheck
npm run build
```
