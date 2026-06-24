# Custom Football League Management System

DBMS course MVP for managing custom football leagues, team/player approvals, fixtures, lineups, backend-only match simulation, editable simulated results, final confirmation, standings, and public tournament pages.

## Stack

- pnpm monorepo
- Frontend: Next.js, React, Tailwind, shadcn-style local UI primitives
- Backend: Node.js, Express, TypeScript
- Database/Auth/Storage: Supabase PostgreSQL/Auth/private Storage
- Shared package: TypeScript enums, DTOs, and Zod validation schemas

The frontend uses Supabase Auth only for user sessions. All tournament/domain reads and writes go through the Express API.

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

Then create at least one Auth user in Supabase, copy the user's UUID, and update/run the admin seed statement in `supabase/seed.sql`.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` belongs only in `backend/.env`.
- No browser code reads or writes tournament tables directly.
- Player identity numbers are never stored raw. The backend stores only an HMAC hash and last four digits.
- Proof documents belong in the private `identity-proofs` Storage bucket.
- No advanced chance-quality metric fields, labels, formulas, or simulator values are included.

## Demo authentication

This project uses custom backend auth stored in PostgreSQL tables, not Supabase Auth signup. There is no Google OAuth requirement. For a classroom/demo setup, any fake email that contains `@` and ends with `.com` can be used.

Seeded admin:

- Email: `admin@scoreline.com`
- Password: `1234`

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```
