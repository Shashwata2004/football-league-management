-- Advanced deterministic simulation + lineup detail schema.
-- Safe to re-run. Does not insert dummy data.

do $$ begin
  create type public.football_position as enum ('GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST');
exception when duplicate_object then null; end $$;

create table if not exists public.player_abilities (
  id uuid primary key default gen_random_uuid(),
  player_registration_id uuid not null unique references public.player_season_registrations(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  position public.football_position not null,
  rating_tier public.player_ability_rating not null,
  shooting integer check (shooting is null or shooting between 1 and 92),
  passing integer check (passing is null or passing between 1 and 92),
  dribbling integer check (dribbling is null or dribbling between 1 and 92),
  defending integer check (defending is null or defending between 1 and 92),
  physical integer check (physical is null or physical between 1 and 92),
  pace integer check (pace is null or pace between 1 and 92),
  stamina integer check (stamina is null or stamina between 1 and 92),
  shot_stopping integer check (shot_stopping is null or shot_stopping between 1 and 92),
  reflexes integer check (reflexes is null or reflexes between 1 and 92),
  positioning integer check (positioning is null or positioning between 1 and 92),
  handling integer check (handling is null or handling between 1 and 92),
  diving integer check (diving is null or diving between 1 and 92),
  distribution integer check (distribution is null or distribution between 1 and 92),
  communication integer check (communication is null or communication between 1 and 92),
  overall_rating integer not null check (overall_rating between 1 and 92),
  generated_by_admin_id uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  is_hidden_from_manager boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_abilities_gk_fields check (
    (
      position = 'GK'
      and shot_stopping is not null
      and reflexes is not null
      and positioning is not null
      and handling is not null
      and diving is not null
      and distribution is not null
      and physical is not null
      and communication is not null
      and shooting is null
      and dribbling is null
      and defending is null
      and pace is null
      and stamina is null
    )
    or
    (
      position <> 'GK'
      and shooting is not null
      and passing is not null
      and dribbling is not null
      and defending is not null
      and physical is not null
      and pace is not null
      and stamina is not null
      and shot_stopping is null
      and reflexes is null
      and positioning is null
      and handling is null
      and diving is null
      and distribution is null
      and communication is null
    )
  )
);

alter table public.lineup_players
  add column if not exists football_position public.football_position,
  add column if not exists shirt_number integer,
  add column if not exists is_captain boolean not null default false;

alter table public.fixtures
  add column if not exists simulation_seed text,
  add column if not exists simulated_at timestamptz,
  add column if not exists extra_time_played boolean not null default false,
  add column if not exists penalty_winner_team_registration_id uuid references public.team_registrations(id) on delete set null,
  add column if not exists penalties_home integer check (penalties_home is null or penalties_home >= 0),
  add column if not exists penalties_away integer check (penalties_away is null or penalties_away >= 0);

alter table public.team_match_stats
  add column if not exists offsides integer not null default 0 check (offsides >= 0);

alter table public.team_match_stats
  drop constraint if exists team_match_stats_advanced_caps;

alter table public.team_match_stats
  add constraint team_match_stats_advanced_caps
  check (
    fouls between 0 and 40
    and yellow_cards between 0 and 8
    and red_cards between 0 and 3
    and corners between 0 and 25
    and offsides between 0 and 15
  );

alter table public.player_match_stats
  add column if not exists position_played public.football_position,
  add column if not exists shots_on_target integer not null default 0,
  add column if not exists chances_created integer not null default 0,
  add column if not exists big_chances_missed integer not null default 0,
  add column if not exists dispossessed integer not null default 0,
  add column if not exists interceptions integer not null default 0,
  add column if not exists clearances integer not null default 0,
  add column if not exists blocks integer not null default 0,
  add column if not exists fouls_committed integer not null default 0,
  add column if not exists goals_conceded integer,
  add column if not exists accurate_long_balls integer,
  add column if not exists diving_saves integer,
  add column if not exists saves_inside_box integer;

alter table public.player_match_stats
  drop constraint if exists player_match_stats_advanced_caps;

alter table public.player_match_stats
  add constraint player_match_stats_advanced_caps
  check (
    shots_on_target between 0 and shots
    and chances_created >= 0
    and big_chances_missed >= 0
    and accurate_passes between 0 and passes
    and successful_dribbles between 0 and dribbles_attempted
    and dispossessed >= 0
    and interceptions >= 0
    and clearances >= 0
    and blocks >= 0
    and fouls_committed >= 0
    and (goals_conceded is null or goals_conceded >= 0)
    and (accurate_long_balls is null or accurate_long_balls >= 0)
    and (diving_saves is null or diving_saves between 0 and saves)
    and (saves_inside_box is null or saves_inside_box between 0 and saves)
  );

create table if not exists public.match_substitutions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  minute integer not null check (minute between 1 and 130),
  player_out_registration_id uuid not null references public.player_season_registrations(id),
  player_in_registration_id uuid not null references public.player_season_registrations(id),
  reason text not null check (reason in ('LOW_RATING', 'FATIGUE', 'TACTICAL_CHANGE', 'YELLOW_CARD_RISK', 'INJURY_PLACEHOLDER')),
  created_at timestamptz not null default now(),
  constraint match_substitutions_distinct_players check (player_out_registration_id <> player_in_registration_id)
);

create index if not exists idx_player_abilities_player_registration on public.player_abilities(player_registration_id);
create index if not exists idx_player_abilities_season_team on public.player_abilities(season_id, team_registration_id);
create index if not exists idx_lineup_players_football_position on public.lineup_players(lineup_id, football_position);
create index if not exists idx_match_substitutions_fixture on public.match_substitutions(fixture_id, minute);

alter table public.player_abilities enable row level security;
alter table public.match_substitutions enable row level security;

drop policy if exists "player_abilities_service_only" on public.player_abilities;
create policy "player_abilities_service_only"
on public.player_abilities for all
using (false)
with check (false);

drop policy if exists "match_substitutions_public_read" on public.match_substitutions;
create policy "match_substitutions_public_read"
on public.match_substitutions for select
to anon, authenticated
using (true);

notify pgrst, 'reload schema';
