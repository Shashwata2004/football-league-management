-- Fan favourite teams
--
-- Adds a single new table so fans (USER role) can follow clubs. Nothing else in
-- the schema changes. A favourite links a fan profile to a persistent club
-- (public.teams), so it survives across seasons the way a real supporter follows
-- a club rather than a single-season registration.
--
-- All reads/writes go through the Express API using the service role, exactly
-- like every other tournament table. Row Level Security is enabled and locked to
-- service-role access only, mirroring the manager_messages policy. The browser
-- never queries this table directly, and because the app uses custom JWT auth
-- (not Supabase Auth) auth.uid() is never populated, so a user-scoped policy
-- could never match anyway.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.user_favorite_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, team_id)
);

create index if not exists user_favorite_teams_user_idx
  on public.user_favorite_teams(user_id, created_at desc);

create index if not exists user_favorite_teams_team_idx
  on public.user_favorite_teams(team_id);

-- At most one primary favourite per fan.
create unique index if not exists user_favorite_teams_one_primary_uidx
  on public.user_favorite_teams(user_id)
  where is_primary = true;

alter table public.user_favorite_teams enable row level security;

revoke all on public.user_favorite_teams from anon, authenticated;
grant select, insert, update, delete on public.user_favorite_teams to service_role;

drop policy if exists "user_favorite_teams_service_only" on public.user_favorite_teams;
create policy "user_favorite_teams_service_only"
on public.user_favorite_teams for all
using (false)
with check (false);

commit;

notify pgrst, 'reload schema';
