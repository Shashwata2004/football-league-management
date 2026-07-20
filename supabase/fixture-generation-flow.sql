-- Fixture generation flow support.
-- Safe to run multiple times in Supabase SQL Editor.

alter type public.fixture_status add value if not exists 'WAITING_FOR_TEAMS';
alter type public.fixture_status add value if not exists 'LINEUP_PENDING';
alter type public.fixture_status add value if not exists 'READY_TO_SIMULATE';
alter type public.fixture_status add value if not exists 'SIMULATED';
alter type public.fixture_status add value if not exists 'COMPLETED';
alter type public.fixture_status add value if not exists 'POSTPONED';

alter table public.seasons
  add column if not exists round_format public.season_format not null default 'SINGLE_ROUND_ROBIN',
  add column if not exists fixture_status text not null default 'NOT_GENERATED';

alter table public.fixtures
  add column if not exists league_id uuid references public.leagues(id) on delete cascade,
  add column if not exists group_id uuid references public.season_groups(id) on delete set null,
  add column if not exists matchday_number integer,
  add column if not exists home_source text,
  add column if not exists away_source text,
  add column if not exists result_confirmed boolean not null default false,
  add column if not exists winner_team_registration_id uuid references public.team_registrations(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.fixtures
  alter column home_team_registration_id drop not null,
  alter column away_team_registration_id drop not null;

update public.fixtures f
set league_id = s.league_id
from public.seasons s
where f.season_id = s.id
  and f.league_id is null;

update public.fixtures
set result_confirmed = true
where status = 'FINAL';

create index if not exists idx_fixtures_season_stage_matchday
  on public.fixtures(season_id, stage, matchday_number, round_no);

create index if not exists idx_fixtures_group_id
  on public.fixtures(group_id);

create unique index if not exists fixtures_unique_real_team_pair_per_stage
  on public.fixtures(season_id, stage, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), home_team_registration_id, away_team_registration_id)
  where home_team_registration_id is not null
    and away_team_registration_id is not null
    and status <> 'CANCELLED';
