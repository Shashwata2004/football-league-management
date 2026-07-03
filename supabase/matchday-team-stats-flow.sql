alter table public.seasons
  add column if not exists active_matchday_number integer,
  add column if not exists active_matchday_started_at timestamptz;

alter table public.team_match_stats
  add column if not exists expected_goals numeric(4,2) not null default 0 check (expected_goals >= 0),
  add column if not exists shots_off_target integer not null default 0 check (shots_off_target >= 0),
  add column if not exists hit_woodwork integer not null default 0 check (hit_woodwork >= 0),
  add column if not exists tackles integer not null default 0 check (tackles >= 0),
  add column if not exists interceptions integer not null default 0 check (interceptions >= 0),
  add column if not exists blocks integer not null default 0 check (blocks >= 0),
  add column if not exists clearances integer not null default 0 check (clearances >= 0),
  add column if not exists keeper_saves integer not null default 0 check (keeper_saves >= 0);

update public.team_match_stats
set
  shots_off_target = greatest(0, shots - shots_on_target),
  expected_goals = greatest(
    0,
    round(
      (
        coalesce(shots_on_target, 0) * 0.18
        + coalesce(big_chances, 0) * 0.35
        + coalesce(big_chances_missed, 0) * 0.08
      )::numeric,
      2
    )
  )
where expected_goals = 0
   or shots_off_target = 0;

alter table public.player_match_stats
  add column if not exists dribbled_past integer not null default 0 check (dribbled_past >= 0);
alter table public.player_match_stats
  add column if not exists clean_sheet boolean not null default false,
  add column if not exists penalty_scored integer not null default 0 check (penalty_scored >= 0),
  add column if not exists penalty_missed integer not null default 0 check (penalty_missed >= 0),
  add column if not exists penalty_saved_for_gk integer not null default 0 check (penalty_saved_for_gk >= 0);

alter table public.player_match_stats
  drop constraint if exists player_match_stats_rating_check;
alter table public.player_match_stats
  add constraint player_match_stats_rating_check check (rating between 4.5 and 10);

alter table public.player_season_stats
  add column if not exists dribbled_past integer not null default 0 check (dribbled_past >= 0);

alter table public.match_substitutions
  drop constraint if exists match_substitutions_reason_check;

alter table public.match_substitutions
  add constraint match_substitutions_reason_check
  check (reason in ('LOW_RATING', 'FATIGUE', 'TACTICAL_CHANGE', 'YELLOW_CARD_RISK', 'INJURY_PLACEHOLDER', 'INJURY'));

alter type public.match_event_type add value if not exists 'PENALTY_GOAL';
alter type public.match_event_type add value if not exists 'PENALTY_SAVED';
alter type public.match_event_type add value if not exists 'PENALTY_MISS';
alter type public.match_event_type add value if not exists 'INJURY';
alter type public.match_event_type add value if not exists 'OWN_GOAL';
alter type public.match_event_type add value if not exists 'HIT_WOODWORK';

create table if not exists public.match_injuries (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  injury_type text not null default 'MINOR_KNOCK',
  severity text not null default 'MINOR',
  minute integer not null check (minute between 1 and 130),
  forced_substitution boolean not null default false,
  expected_matches_out integer not null default 0 check (expected_matches_out >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.player_suspensions (
  id uuid primary key default gen_random_uuid(),
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  reason text not null,
  source_fixture_id uuid references public.fixtures(id) on delete set null,
  matches_remaining integer not null default 1 check (matches_remaining >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SERVED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
