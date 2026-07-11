-- Custom Football League Management System schema
-- Run in Supabase SQL Editor. Supabase CLI is optional.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('USER', 'MANAGER', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_status as enum ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.season_format as enum ('SINGLE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'GROUP_STAGE_KNOCKOUT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.season_phase as enum ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ACTIVE', 'COMPLETED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.player_ability_rating as enum ('LOW', 'MODERATE', 'HIGH');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.preferred_foot as enum ('LEFT', 'RIGHT', 'BOTH', 'UNKNOWN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.player_lifecycle_status as enum ('ACTIVE', 'PENDING', 'APPROVED', 'REJECTED', 'REMOVED', 'SUSPENDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_mode as enum ('GENERATED', 'VERIFIED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.position_category as enum ('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.manager_message_type as enum (
    'TEAM_REJECTION',
    'PLAYER_REJECTION',
    'PLAYER_REMOVAL',
    'LINEUP_BLOCK',
    'TEAM_REMOVAL',
    'GENERAL_NOTICE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_team_status as enum ('PENDING', 'QUALIFIED', 'ELIMINATED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.knockout_round_status as enum ('PENDING', 'GENERATED', 'COMPLETED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fixture_status as enum (
    'SCHEDULED',
    'WAITING_FOR_TEAMS',
    'LINEUP_PENDING',
    'LINEUPS_SUBMITTED',
    'LINEUPS_CONFIRMED',
    'READY_TO_SIMULATE',
    'SIMULATED',
    'SIMULATED_PENDING_ADMIN_CONFIRMATION',
    'COMPLETED',
    'FINAL',
    'POSTPONED',
    'CANCELLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lineup_status as enum ('PENDING', 'CONFIRMED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.venue_side as enum ('HOME', 'AWAY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.player_position as enum ('GK', 'DEF', 'MID', 'FWD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.football_position as enum ('GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST');
exception when duplicate_object then null; end $$;

do $$ begin
create type public.id_type as enum ('NID', 'BIRTH_ID');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.match_event_type as enum ('GOAL', 'ASSIST', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'PENALTY_GOAL', 'PENALTY_SAVED', 'PENALTY_MISS', 'INJURY', 'OWN_GOAL', 'HIT_WOODWORK');
exception when duplicate_object then null; end $$;

alter type public.match_event_type add value if not exists 'PENALTY_GOAL';
alter type public.match_event_type add value if not exists 'PENALTY_SAVED';
alter type public.match_event_type add value if not exists 'PENALTY_MISS';
alter type public.match_event_type add value if not exists 'INJURY';
alter type public.match_event_type add value if not exists 'OWN_GOAL';
alter type public.match_event_type add value if not exists 'HIT_WOODWORK';

create schema if not exists app_private;

create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  role public.user_role not null default 'USER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_managers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_role public.user_role not null,
  status public.request_status not null default 'PENDING',
  reason text,
  decision_reason text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint role_requests_manager_only check (requested_role = 'MANAGER')
);

create unique index if not exists role_requests_one_pending_manager
  on public.role_requests(user_id, requested_role)
  where status = 'PENDING';

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  logo_url text,
  organizer_name text,
  country text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null,
  season_year integer,
  registration_start_date date,
  registration_deadline date,
  phase public.season_phase not null default 'REGISTRATION_OPEN',
  format public.season_format not null,
  round_format public.season_format not null default 'SINGLE_ROUND_ROBIN',
  fixture_status text not null default 'NOT_GENERATED',
  start_date date,
  end_date date,
  total_teams integer,
  min_players_per_team integer,
  max_players_per_team integer,
  lineup_size integer,
  substitute_limit integer,
  lineup_submission_deadline_hours integer,
  group_count integer,
  teams_per_group integer,
  qualifiers_per_group integer,
  best_third_place_teams integer,
  total_knockout_teams integer,
  champion_team_registration_id uuid,
  active_matchday_number integer,
  active_matchday_date date,
  active_matchday_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_total_teams check (total_teams is null or total_teams >= 2),
  constraint valid_player_limits check (
    min_players_per_team is null
    or max_players_per_team is null
    or min_players_per_team <= max_players_per_team
  ),
  constraint valid_registration_dates check (
    registration_start_date is null
    or registration_deadline is null
    or registration_start_date <= registration_deadline
  ),
  constraint valid_season_dates check (start_date is null or end_date is null or start_date <= end_date),
  constraint valid_group_knockout_config check (
    format <> 'GROUP_STAGE_KNOCKOUT'
    or (
      group_count is not null
      and teams_per_group is not null
      and qualifiers_per_group is not null
      and best_third_place_teams is not null
      and total_knockout_teams is not null
      and group_count > 0
      and teams_per_group > 0
      and qualifiers_per_group > 0
      and best_third_place_teams >= 0
      and group_count * qualifiers_per_group + best_third_place_teams = total_knockout_teams
      and total_knockout_teams in (4, 8, 16, 32, 64)
    )
  )
);

alter table public.leagues add column if not exists short_name text;
alter table public.leagues add column if not exists logo_url text;
alter table public.leagues add column if not exists organizer_name text;

alter table public.seasons add column if not exists season_year integer;
alter table public.seasons add column if not exists registration_start_date date;
alter table public.seasons add column if not exists registration_deadline date;
alter table public.seasons add column if not exists phase public.season_phase not null default 'REGISTRATION_OPEN';
alter table public.seasons add column if not exists round_format public.season_format not null default 'SINGLE_ROUND_ROBIN';
alter table public.seasons add column if not exists fixture_status text not null default 'NOT_GENERATED';
alter table public.seasons add column if not exists active_matchday_number integer;
alter table public.seasons add column if not exists active_matchday_date date;
alter table public.seasons add column if not exists active_matchday_started_at timestamptz;
alter table public.seasons add column if not exists total_teams integer;
alter table public.seasons add column if not exists min_players_per_team integer;
alter table public.seasons add column if not exists max_players_per_team integer;
alter table public.seasons add column if not exists lineup_size integer;
alter table public.seasons add column if not exists substitute_limit integer;
alter table public.seasons add column if not exists lineup_submission_deadline_hours integer;
alter table public.seasons add column if not exists teams_per_group integer;
alter table public.seasons add column if not exists best_third_place_teams integer;
alter table public.seasons add column if not exists total_knockout_teams integer;

alter table public.seasons drop constraint if exists valid_team_limits;
alter table public.seasons drop constraint if exists valid_total_teams;
alter table public.seasons add constraint valid_total_teams
  check (total_teams is null or total_teams >= 2);

alter table public.seasons drop column if exists min_teams;
alter table public.seasons drop column if exists max_teams;
alter table public.seasons drop column if exists allow_draw;
alter table public.seasons drop column if exists status;
drop type if exists public.season_status;

alter table public.seasons drop constraint if exists valid_player_limits;
alter table public.seasons add constraint valid_player_limits
  check (
    min_players_per_team is null
    or max_players_per_team is null
    or min_players_per_team <= max_players_per_team
  );

alter table public.seasons drop constraint if exists valid_registration_dates;
alter table public.seasons add constraint valid_registration_dates
  check (
    registration_start_date is null
    or registration_deadline is null
    or registration_start_date <= registration_deadline
  );

alter table public.seasons drop constraint if exists valid_season_dates;
alter table public.seasons add constraint valid_season_dates
  check (start_date is null or end_date is null or start_date <= end_date);

alter table public.seasons drop constraint if exists valid_group_knockout_config;
alter table public.seasons add constraint valid_group_knockout_config
  check (
    format <> 'GROUP_STAGE_KNOCKOUT'
    or (
      group_count is not null
      and teams_per_group is not null
      and qualifiers_per_group is not null
      and best_third_place_teams is not null
      and total_knockout_teams is not null
      and group_count > 0
      and teams_per_group > 0
      and qualifiers_per_group > 0
      and best_third_place_teams >= 0
      and group_count * qualifiers_per_group + best_third_place_teams = total_knockout_teams
      and total_knockout_teams in (4, 8, 16, 32, 64)
    )
  );

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id),
  name text not null,
  short_name text not null,
  logo_url text,
  city text,
  primary_color text,
  secondary_color text,
  accent_color text,
  home_jersey_url text,
  away_jersey_url text,
  gk_home_jersey_url text,
  gk_away_jersey_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams add column if not exists logo_url text;
alter table public.teams add column if not exists secondary_color text;
alter table public.teams add column if not exists accent_color text;
alter table public.teams add column if not exists home_jersey_url text;
alter table public.teams add column if not exists away_jersey_url text;
alter table public.teams add column if not exists gk_home_jersey_url text;
alter table public.teams add column if not exists gk_away_jersey_url text;

create table if not exists public.team_registrations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  manager_id uuid not null references public.profiles(id),
  status public.request_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  removed_by uuid references public.profiles(id),
  removed_at timestamptz,
  removal_reason text,
  created_at timestamptz not null default now(),
  unique (season_id, team_id)
);

alter table public.team_registrations add column if not exists removed_by uuid references public.profiles(id);
alter table public.team_registrations add column if not exists removed_at timestamptz;
alter table public.team_registrations add column if not exists removal_reason text;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  date_of_birth date,
  nationality text,
  id_type public.id_type,
  id_number_hash text unique,
  id_number_last4 text,
  generated_identity_number text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players add column if not exists avatar_url text;
alter table public.players add column if not exists generated_identity_number text;
alter table public.players alter column date_of_birth drop not null;
alter table public.players alter column id_type drop not null;
alter table public.players alter column id_number_hash drop not null;
alter table public.players alter column id_number_last4 drop not null;

create table if not exists public.identity_proofs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  id_type public.id_type not null,
  id_number_hash text not null,
  id_number_last4 text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.player_season_registrations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  player_code text,
  position public.player_position not null,
  football_position public.football_position,
  position_category public.position_category,
  shirt_number integer,
  status public.request_status not null default 'PENDING',
  ability_rating public.player_ability_rating,
  preferred_foot public.preferred_foot not null default 'UNKNOWN',
  player_status public.player_lifecycle_status not null default 'ACTIVE',
  identity_mode public.identity_mode not null default 'VERIFIED',
  is_generated boolean not null default false,
  created_by_manager_id uuid references public.profiles(id),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  removed_by uuid references public.profiles(id),
  removed_at timestamptz,
  removal_reason text,
  suspended_by uuid references public.profiles(id),
  suspended_at timestamptz,
  suspension_reason text,
  suspension_type text,
  suspension_until date,
  suspension_matches_remaining integer,
  allow_resubmission boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shirt_number_range check (shirt_number is null or shirt_number between 1 and 99),
  constraint player_registrations_generated_identity_check check (
    (identity_mode = 'GENERATED' and is_generated = true)
    or identity_mode = 'VERIFIED'
  ),
  unique (season_id, player_id)
);

alter table public.player_season_registrations add column if not exists player_code text;
alter table public.player_season_registrations
  add column if not exists ability_rating public.player_ability_rating;
alter table public.player_season_registrations
  add column if not exists football_position public.football_position;
alter table public.player_season_registrations
  add column if not exists position_category public.position_category;
alter table public.player_season_registrations
  add column if not exists preferred_foot public.preferred_foot not null default 'UNKNOWN';
alter table public.player_season_registrations
  add column if not exists player_status public.player_lifecycle_status not null default 'PENDING';
alter table public.player_season_registrations
  add column if not exists identity_mode public.identity_mode not null default 'VERIFIED';
alter table public.player_season_registrations
  add column if not exists is_generated boolean not null default false;
alter table public.player_season_registrations
  add column if not exists created_by_manager_id uuid references public.profiles(id);
alter table public.player_season_registrations add column if not exists submitted_at timestamptz;
alter table public.player_season_registrations add column if not exists updated_at timestamptz not null default now();
alter table public.player_season_registrations add column if not exists removed_by uuid references public.profiles(id);
alter table public.player_season_registrations add column if not exists removed_at timestamptz;
alter table public.player_season_registrations add column if not exists removal_reason text;
alter table public.player_season_registrations add column if not exists suspended_by uuid references public.profiles(id);
alter table public.player_season_registrations add column if not exists suspended_at timestamptz;
alter table public.player_season_registrations add column if not exists suspension_reason text;
alter table public.player_season_registrations add column if not exists suspension_type text;
alter table public.player_season_registrations add column if not exists suspension_until date;
alter table public.player_season_registrations add column if not exists suspension_matches_remaining integer;
alter table public.player_season_registrations add column if not exists allow_resubmission boolean not null default false;

create unique index if not exists player_regs_unique_player_code
  on public.player_season_registrations(player_code)
  where player_code is not null;

alter table public.player_season_registrations drop constraint if exists player_season_registrations_team_registration_id_shirt_number_key;

create unique index if not exists player_regs_unique_active_squad_jersey
  on public.player_season_registrations(team_registration_id, shirt_number)
  where shirt_number is not null
    and player_status <> 'REMOVED'
    and (status in ('DRAFT', 'PENDING', 'APPROVED') or player_status = 'SUSPENDED');

create unique index if not exists players_unique_generated_identity_number
  on public.players(generated_identity_number)
  where generated_identity_number is not null;

create table if not exists public.player_hidden_attributes (
  id uuid primary key default gen_random_uuid(),
  player_registration_id uuid not null unique references public.player_season_registrations(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  pace integer not null check (pace between 1 and 99),
  shooting integer not null check (shooting between 1 and 99),
  passing integer not null check (passing between 1 and 99),
  dribbling integer not null check (dribbling between 1 and 99),
  defending integer not null check (defending between 1 and 99),
  physical integer not null check (physical between 1 and 99),
  goalkeeping integer not null check (goalkeeping between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  updated_at timestamptz not null default now()
);

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  round_no integer not null,
  matchday_number integer,
  stage text not null default 'LEAGUE',
  group_id uuid references public.season_groups(id) on delete set null,
  group_name text,
  home_team_registration_id uuid references public.team_registrations(id),
  away_team_registration_id uuid references public.team_registrations(id),
  home_source text,
  away_source text,
  kickoff_at timestamptz,
  venue text,
  status public.fixture_status not null default 'SCHEDULED',
  result_confirmed boolean not null default false,
  home_score integer,
  away_score integer,
  winner_team_registration_id uuid references public.team_registrations(id) on delete set null,
  simulation_seed text,
  simulated_at timestamptz,
  extra_time_played boolean not null default false,
  penalty_winner_team_registration_id uuid references public.team_registrations(id) on delete set null,
  penalties_home integer check (penalties_home is null or penalties_home >= 0),
  penalties_away integer check (penalties_away is null or penalties_away >= 0),
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixture_distinct_teams check (home_team_registration_id <> away_team_registration_id),
  constraint fixture_non_negative_scores check (
    (home_score is null or home_score >= 0) and (away_score is null or away_score >= 0)
  )
);

alter table public.fixtures add column if not exists league_id uuid references public.leagues(id) on delete cascade;
alter table public.fixtures add column if not exists group_id uuid references public.season_groups(id) on delete set null;
alter table public.fixtures add column if not exists matchday_number integer;
alter table public.fixtures add column if not exists home_source text;
alter table public.fixtures add column if not exists away_source text;
alter table public.fixtures add column if not exists result_confirmed boolean not null default false;
alter table public.fixtures add column if not exists winner_team_registration_id uuid references public.team_registrations(id) on delete set null;
alter table public.fixtures add column if not exists updated_at timestamptz not null default now();
alter table public.fixtures alter column home_team_registration_id drop not null;
alter table public.fixtures alter column away_team_registration_id drop not null;

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  side public.venue_side not null,
  formation text not null,
  playing_style text not null default 'BALANCED',
  status public.lineup_status not null default 'PENDING',
  captain_id uuid references public.player_season_registrations(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  confirmed_at timestamptz,
  rejection_reason text,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, team_registration_id),
  unique (fixture_id, side)
);

create table if not exists public.lineup_players (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  is_starter boolean not null,
  position public.player_position not null,
  football_position public.football_position,
  player_natural_position public.football_position,
  slot_key text,
  display_role text,
  shirt_number integer,
  is_substitute boolean not null default false,
  is_captain boolean not null default false,
  display_order integer,
  created_at timestamptz not null default now(),
  unique (lineup_id, player_registration_id)
);

create table if not exists public.manager_team_preferences (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  preferred_formation text not null default '4-3-3',
  preferred_playing_style text not null default 'BALANCED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manager_id, team_registration_id, season_id)
);

create table if not exists public.team_match_stats (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id),
  rating numeric(3,1) check (rating is null or rating between 4.8 and 9.8),
  possession integer not null check (possession between 0 and 100),
  expected_goals numeric(4,2) not null default 0 check (expected_goals >= 0),
  shots integer not null check (shots >= 0),
  shots_off_target integer not null default 0 check (shots_off_target >= 0),
  shots_on_target integer not null check (shots_on_target between 0 and shots),
  hit_woodwork integer not null default 0 check (hit_woodwork >= 0),
  big_chances integer not null check (big_chances between 0 and shots),
  big_chances_missed integer not null check (big_chances_missed between 0 and big_chances),
  passes integer not null check (passes >= 0),
  accurate_passes integer not null check (accurate_passes between 0 and passes),
  offsides integer not null default 0 check (offsides >= 0),
  tackles integer not null default 0 check (tackles >= 0),
  interceptions integer not null default 0 check (interceptions >= 0),
  blocks integer not null default 0 check (blocks >= 0),
  clearances integer not null default 0 check (clearances >= 0),
  keeper_saves integer not null default 0 check (keeper_saves >= 0),
  fouls integer not null check (fouls >= 0),
  yellow_cards integer not null check (yellow_cards >= 0),
  red_cards integer not null check (red_cards between 0 and 3),
  corners integer not null check (corners >= 0),
  created_at timestamptz not null default now(),
  unique (fixture_id, team_registration_id)
);

alter table public.team_match_stats add column if not exists expected_goals numeric(4,2) not null default 0 check (expected_goals >= 0);
alter table public.team_match_stats add column if not exists shots_off_target integer not null default 0 check (shots_off_target >= 0);
alter table public.team_match_stats add column if not exists hit_woodwork integer not null default 0 check (hit_woodwork >= 0);
alter table public.team_match_stats add column if not exists tackles integer not null default 0 check (tackles >= 0);
alter table public.team_match_stats add column if not exists interceptions integer not null default 0 check (interceptions >= 0);
alter table public.team_match_stats add column if not exists blocks integer not null default 0 check (blocks >= 0);
alter table public.team_match_stats add column if not exists clearances integer not null default 0 check (clearances >= 0);
alter table public.team_match_stats add column if not exists keeper_saves integer not null default 0 check (keeper_saves >= 0);

create table if not exists public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id),
  minutes integer not null check (minutes between 0 and 130),
  goals integer not null check (goals >= 0),
  assists integer not null check (assists >= 0),
  shots integer not null check (shots >= 0),
  shots_on_target integer not null default 0 check (shots_on_target between 0 and shots),
  chances_created integer not null default 0 check (chances_created >= 0),
  big_chances_created integer not null default 0 check (big_chances_created >= 0),
  big_chances_missed integer not null default 0 check (big_chances_missed >= 0),
  passes integer not null check (passes >= 0),
  accurate_passes integer not null check (accurate_passes between 0 and passes),
  tackles integer not null check (tackles >= 0),
  interceptions integer not null default 0 check (interceptions >= 0),
  clearances integer not null default 0 check (clearances >= 0),
  blocks integer not null default 0 check (blocks >= 0),
  fouls_committed integer not null default 0 check (fouls_committed >= 0),
  saves integer not null check (saves >= 0),
  dribbles_attempted integer not null check (dribbles_attempted >= 0),
  successful_dribbles integer not null check (successful_dribbles between 0 and dribbles_attempted),
  dribbled_past integer not null default 0 check (dribbled_past >= 0),
  dispossessed integer not null default 0 check (dispossessed >= 0),
  position_played public.football_position,
  goals_conceded integer check (goals_conceded is null or goals_conceded >= 0),
  accurate_long_balls integer check (accurate_long_balls is null or accurate_long_balls >= 0),
  diving_saves integer check (diving_saves is null or diving_saves between 0 and saves),
  saves_inside_box integer check (saves_inside_box is null or saves_inside_box between 0 and saves),
  clean_sheet boolean not null default false,
  penalty_scored integer not null default 0 check (penalty_scored >= 0),
  penalty_missed integer not null default 0 check (penalty_missed >= 0),
  penalty_saved_for_gk integer not null default 0 check (penalty_saved_for_gk >= 0),
  yellow_cards integer not null check (yellow_cards between 0 and 2),
  red_cards integer not null check (red_cards between 0 and 1),
  rating numeric(3,1) not null check (rating between 4.5 and 10),
  created_at timestamptz not null default now(),
  unique (fixture_id, player_registration_id)
);

alter table public.player_match_stats add column if not exists clean_sheet boolean not null default false;
alter table public.player_match_stats add column if not exists penalty_scored integer not null default 0 check (penalty_scored >= 0);
alter table public.player_match_stats add column if not exists penalty_missed integer not null default 0 check (penalty_missed >= 0);
alter table public.player_match_stats add column if not exists penalty_saved_for_gk integer not null default 0 check (penalty_saved_for_gk >= 0);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  minute integer not null check (minute between 1 and 130),
  side public.venue_side not null,
  type public.match_event_type not null,
  player_registration_id uuid not null references public.player_season_registrations(id),
  related_player_registration_id uuid references public.player_season_registrations(id),
  created_at timestamptz not null default now()
);

create table if not exists public.match_substitutions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  minute integer not null check (minute between 1 and 130),
  player_out_registration_id uuid not null references public.player_season_registrations(id),
  player_in_registration_id uuid not null references public.player_season_registrations(id),
  reason text not null check (reason in ('LOW_RATING', 'FATIGUE', 'TACTICAL_CHANGE', 'YELLOW_CARD_RISK', 'INJURY_PLACEHOLDER', 'INJURY')),
  created_at timestamptz not null default now(),
  constraint match_substitutions_distinct_players check (player_out_registration_id <> player_in_registration_id)
);

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

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  goal_difference integer not null default 0,
  points integer not null default 0,
  fair_play_score integer not null default 0,
  admin_draw_rank integer,
  updated_at timestamptz not null default now(),
  unique (season_id, team_registration_id)
);

create table if not exists public.player_season_stats (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  appearances integer not null default 0,
  starts integer not null default 0,
  minutes_played integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  shots integer not null default 0,
  shots_on_target integer not null default 0,
  chances_created integer not null default 0,
  big_chances_created integer not null default 0,
  total_passes integer not null default 0,
  accurate_passes integer not null default 0,
  dribbles_attempted integer not null default 0,
  successful_dribbles integer not null default 0,
  dribbled_past integer not null default 0,
  dispossessed integer not null default 0,
  tackles integer not null default 0,
  interceptions integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  average_rating numeric(4,2),
  best_match_rating numeric(3,1),
  lowest_match_rating numeric(3,1),
  player_of_match_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (season_id, player_registration_id)
);

alter table public.player_season_stats add column if not exists starts integer not null default 0;
alter table public.player_season_stats add column if not exists minutes_played integer not null default 0;
alter table public.player_season_stats add column if not exists shots integer not null default 0;
alter table public.player_season_stats add column if not exists shots_on_target integer not null default 0;
alter table public.player_season_stats add column if not exists chances_created integer not null default 0;
alter table public.player_season_stats add column if not exists big_chances_created integer not null default 0;
alter table public.player_season_stats add column if not exists total_passes integer not null default 0;
alter table public.player_season_stats add column if not exists accurate_passes integer not null default 0;
alter table public.player_season_stats add column if not exists dribbles_attempted integer not null default 0;
alter table public.player_season_stats add column if not exists successful_dribbles integer not null default 0;
alter table public.player_season_stats add column if not exists dribbled_past integer not null default 0;
alter table public.player_season_stats add column if not exists dispossessed integer not null default 0;
alter table public.player_season_stats add column if not exists tackles integer not null default 0;
alter table public.player_season_stats add column if not exists interceptions integer not null default 0;
alter table public.player_season_stats add column if not exists best_match_rating numeric(3,1);
alter table public.player_season_stats add column if not exists lowest_match_rating numeric(3,1);
alter table public.player_season_stats add column if not exists player_of_match_count integer not null default 0;

alter table public.player_season_stats
  drop constraint if exists player_season_stats_non_negative_dashboard_stats;

alter table public.player_season_stats
  add constraint player_season_stats_non_negative_dashboard_stats
  check (
    starts >= 0
    and minutes_played >= 0
    and shots >= 0
    and shots_on_target >= 0
    and shots_on_target <= shots
    and chances_created >= 0
    and big_chances_created >= 0
    and total_passes >= 0
    and accurate_passes >= 0
    and accurate_passes <= total_passes
    and dribbles_attempted >= 0
    and successful_dribbles >= 0
    and successful_dribbles <= dribbles_attempted
    and dribbled_past >= 0
    and dispossessed >= 0
    and tackles >= 0
    and interceptions >= 0
    and player_of_match_count >= 0
    and (best_match_rating is null or best_match_rating between 5.5 and 9.5)
    and (lowest_match_rating is null or lowest_match_rating between 5.5 and 9.5)
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.manager_messages (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  team_registration_id uuid references public.team_registrations(id) on delete set null,
  player_registration_id uuid references public.player_season_registrations(id) on delete set null,
  fixture_id uuid references public.fixtures(id) on delete set null,
  notification_key text,
  related_type public.manager_message_type not null,
  message text not null,
  created_by uuid references public.profiles(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.manager_messages add column if not exists player_registration_id uuid references public.player_season_registrations(id) on delete set null;
alter table public.manager_messages add column if not exists fixture_id uuid references public.fixtures(id) on delete set null;
alter table public.manager_messages add column if not exists notification_key text;
create unique index if not exists manager_messages_notification_key_uidx on public.manager_messages (notification_key);

create table if not exists public.season_groups (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name)
);

create table if not exists public.season_group_teams (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.season_groups(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  seed_no integer,
  status public.group_team_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (group_id, team_registration_id),
  unique (team_registration_id)
);

create table if not exists public.knockout_brackets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null default 'Main Bracket',
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name)
);

create table if not exists public.knockout_matches (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.knockout_brackets(id) on delete cascade,
  fixture_id uuid references public.fixtures(id) on delete set null,
  round_name text not null,
  round_no integer not null,
  match_no integer not null,
  home_source text,
  away_source text,
  winner_team_registration_id uuid references public.team_registrations(id) on delete set null,
  extra_time_played boolean not null default false,
  penalty_winner_team_registration_id uuid references public.team_registrations(id) on delete set null,
  penalties_home integer check (penalties_home is null or penalties_home >= 0),
  penalties_away integer check (penalties_away is null or penalties_away >= 0),
  status public.knockout_round_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bracket_id, round_no, match_no)
);

alter table public.seasons
  drop constraint if exists seasons_champion_team_fk;

alter table public.seasons
  add constraint seasons_champion_team_fk
  foreign key (champion_team_registration_id)
  references public.team_registrations(id);

create index if not exists idx_seasons_league on public.seasons(league_id);
create index if not exists idx_seasons_phase on public.seasons(phase);
create index if not exists idx_team_registrations_season_status on public.team_registrations(season_id, status);
create index if not exists idx_team_registrations_removed on public.team_registrations(season_id, removed_at);
create index if not exists idx_player_regs_team_status on public.player_season_registrations(team_registration_id, status);
create index if not exists idx_player_regs_lifecycle on public.player_season_registrations(team_registration_id, player_status);
create index if not exists idx_fixtures_season_round on public.fixtures(season_id, round_no);
create index if not exists idx_fixtures_season_stage_matchday on public.fixtures(season_id, stage, matchday_number, round_no);
create index if not exists idx_fixtures_group_id on public.fixtures(group_id);
create unique index if not exists fixtures_unique_real_team_pair_per_stage
  on public.fixtures(
    season_id,
    stage,
    coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid),
    home_team_registration_id,
    away_team_registration_id
  )
  where home_team_registration_id is not null
    and away_team_registration_id is not null
    and status <> 'CANCELLED';
create index if not exists idx_lineups_fixture on public.lineups(fixture_id);
create index if not exists idx_standings_season_sort on public.standings(season_id, points desc, goal_difference desc, goals_for desc, fair_play_score asc);
create index if not exists idx_player_stats_season_goals on public.player_season_stats(season_id, goals desc);
create index if not exists idx_manager_messages_season on public.manager_messages(season_id, created_at desc);
create index if not exists idx_manager_messages_manager_read on public.manager_messages(manager_id, read_at);
create index if not exists idx_manager_messages_player on public.manager_messages(player_registration_id);
create index if not exists idx_manager_messages_fixture on public.manager_messages(fixture_id);
create index if not exists idx_season_groups_season on public.season_groups(season_id);
create index if not exists idx_group_teams_group on public.season_group_teams(group_id);
create index if not exists idx_knockout_brackets_season on public.knockout_brackets(season_id);
create index if not exists idx_knockout_matches_bracket_round on public.knockout_matches(bracket_id, round_no, match_no);

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    'USER'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.app_users enable row level security;
alter table public.app_managers enable row level security;
alter table public.app_admins enable row level security;
alter table public.role_requests enable row level security;
alter table public.leagues enable row level security;
alter table public.seasons enable row level security;
alter table public.teams enable row level security;
alter table public.team_registrations enable row level security;
alter table public.players enable row level security;
alter table public.identity_proofs enable row level security;
alter table public.player_season_registrations enable row level security;
alter table public.player_hidden_attributes enable row level security;
alter table public.fixtures enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_players enable row level security;
alter table public.team_match_stats enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.match_events enable row level security;
alter table public.standings enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.notifications enable row level security;
alter table public.manager_messages enable row level security;
alter table public.season_groups enable row level security;
alter table public.season_group_teams enable row level security;
alter table public.knockout_brackets enable row level security;
alter table public.knockout_matches enable row level security;

grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.leagues, public.seasons, public.fixtures, public.standings, public.player_season_stats, public.season_groups, public.season_group_teams, public.knockout_brackets, public.knockout_matches to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.role_requests to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_self_name_only" on public.profiles;
create policy "profiles_update_self_name_only"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "role_requests_select_self" on public.role_requests;
create policy "role_requests_select_self"
on public.role_requests for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "role_requests_insert_self_manager" on public.role_requests;
create policy "role_requests_insert_self_manager"
on public.role_requests for insert
to authenticated
with check ((select auth.uid()) = user_id and requested_role = 'MANAGER');

drop policy if exists "leagues_public_read" on public.leagues;
create policy "leagues_public_read"
on public.leagues for select
to anon, authenticated
using (true);

drop policy if exists "seasons_public_read" on public.seasons;
create policy "seasons_public_read"
on public.seasons for select
to anon, authenticated
using (true);

drop policy if exists "fixtures_public_final_or_scheduled_read" on public.fixtures;
create policy "fixtures_public_final_or_scheduled_read"
on public.fixtures for select
to anon, authenticated
using (status in ('SCHEDULED', 'LINEUPS_CONFIRMED', 'FINAL'));

drop policy if exists "standings_public_read" on public.standings;
create policy "standings_public_read"
on public.standings for select
to anon, authenticated
using (true);

drop policy if exists "player_season_stats_public_read" on public.player_season_stats;
create policy "player_season_stats_public_read"
on public.player_season_stats for select
to anon, authenticated
using (true);

drop policy if exists "manager_messages_service_only" on public.manager_messages;
create policy "manager_messages_service_only"
on public.manager_messages for all
using (false)
with check (false);

drop policy if exists "season_groups_public_read" on public.season_groups;
create policy "season_groups_public_read"
on public.season_groups for select
to anon, authenticated
using (true);

drop policy if exists "season_group_teams_public_read" on public.season_group_teams;
create policy "season_group_teams_public_read"
on public.season_group_teams for select
to anon, authenticated
using (true);

drop policy if exists "knockout_brackets_public_read" on public.knockout_brackets;
create policy "knockout_brackets_public_read"
on public.knockout_brackets for select
to anon, authenticated
using (true);

drop policy if exists "knockout_matches_public_read" on public.knockout_matches;
create policy "knockout_matches_public_read"
on public.knockout_matches for select
to anon, authenticated
using (true);

drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self"
on public.notifications for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self"
on public.notifications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('identity-proofs', 'identity-proofs', false)
on conflict (id) do update set public = false;

drop policy if exists "identity_proofs_owner_upload" on storage.objects;
create policy "identity_proofs_owner_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'identity-proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "identity_proofs_owner_read" on storage.objects;
create policy "identity_proofs_owner_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'identity-proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
