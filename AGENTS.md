# Repository Guidelines

## Project Structure & Module Organization

The Next.js App Router lives in `src/app`; API handlers are in `src/app/api`, and page components sit beside their routes. Reusable components are in `src/components` (`ui` for shared controls), hooks in `src/hooks`, utilities and database access in `src/lib`, and AI flows in `src/ai`. Prisma schema and seed files live in `prisma/`. Static assets are in `public/`; project and architecture notes are in `docs/`. The image analysis Python service is a separate deployment; this repository calls it through `PYTHON_API_URL`.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile`: install dependencies using the committed lockfile.
- `pnpm exec prisma generate`: generate the Prisma client after schema or dependency changes.
- `pnpm dev`: start Next.js with Turbopack on port 9002.
- `pnpm build` and `pnpm start`: build and serve the production app.
- `pnpm typecheck`: run strict TypeScript checks; `pnpm lint` runs the configured Next.js lint command.
- `pnpm test:analysis-contract`: run the Python response adapter contract test.

For container development, see `SETUP.md` and `docker-compose.dev.yml`. Database changes start in `prisma/schema.prisma`; review schema updates before applying them to a database.

## Coding Style & Naming Conventions

Use TypeScript and TSX with two-space indentation, semicolons, and the existing style in the file you edit; quote style varies across the codebase. Prefer the `@/` alias for imports from `src`. Name React components in PascalCase (`MealCategoryCard.tsx`), hooks with `use` prefixes, and route handlers `route.ts`. Keep shared logic in `src/lib` and validate external payloads with Zod where appropriate. TypeScript `strict` mode is enabled; no repository-wide formatter configuration is present.

## Testing Guidelines

The current automated test uses Node's test runner through `tsx` in `src/lib/python-analysis-response.test.ts`. Place focused tests beside the code as `*.test.ts` or `*.test.tsx`, and add a package script when introducing a new test suite. Run the relevant test command and `pnpm typecheck` for behavior changes. No coverage threshold is configured.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries (`Support structured meal analysis responses`) and, for scoped changes, prefixes such as `feat:` or `perf(react):`. Keep commits focused. In pull requests, describe the behavior changed, affected routes or schema, and commands run; link related issues and include screenshots for visible UI changes.

## Configuration & Security

Keep secrets in ignored `.env` files, never in commits. Document new environment variables and avoid committing user uploads or production data. Follow `docs/AI_PROVIDER_ARCHITECTURE.md` when changing the Python service contract.
