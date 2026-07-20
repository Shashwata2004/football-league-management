# Custom Football League Management System

DBMS course MVP for managing custom football leagues, team/player approvals, fixtures, lineups, backend-only match simulation, editable simulated results, final confirmation, standings, and public tournament pages.

## Stack

- pnpm monorepo
- Frontend: Next.js, React, Tailwind, shadcn-style local UI primitives
- Backend: Node.js, Express, TypeScript
- Database/Storage: Supabase PostgreSQL/private Storage
- Auth: custom Express auth stored in PostgreSQL tables
- Shared package: TypeScript enums, DTOs, and Zod validation schemas

All authentication and tournament/domain reads/writes go through the Express API. The browser does not use Supabase Auth or directly query tournament tables.

## Run locally

```bash
pnpm install
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env.local
pnpm dev
```

Backend defaults to `http://localhost:4000`; frontend defaults to `http://localhost:3000`.

## Database setup

Supabase CLI is not required for the initial setup. Run these files in the Supabase SQL Editor in order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

The seed file creates the fixed admin account automatically.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` belongs only in `backend/.env`.
- No browser code reads or writes tournament tables directly.
- Player identity numbers are never stored raw. The backend stores only an HMAC hash and last four digits.
- No advanced chance-quality metric fields, labels, formulas, or simulator values are included.

## Demo authentication

This project uses custom backend auth stored in PostgreSQL tables, not Supabase Auth signup. There is no Google OAuth requirement. For a classroom/demo setup, any fake email that contains `@` and ends with `.com` can be used.

Admin credentials are intentionally not published in the repository. Obtain them from an authorized project maintainer.

## Deployment

Deployed on Vercel as two projects fed from this one repo, both auto-deploying on push to `main`:

- `football-league-management-system` (frontend, Root Directory `frontend`)
- `football-league-management-api` (backend API, Root Directory repo root)

Because the shared package resolves to its build output, it must be built before each app. The build commands are:

- Frontend (`frontend/vercel.json`):

  ```bash
  pnpm --filter @flms/shared build && pnpm run build
  ```

- API (`vercel.json`):

  ```bash
  pnpm --filter @flms/shared build && pnpm --filter @flms/backend build
  ```

Pushing to `main` triggers production deployments; pushes to other branches create previews.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```
