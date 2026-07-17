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
  yellow_card_suspension_threshold integer not null default 3,
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
  constraint seasons_yellow_card_suspension_threshold_check check (
    yellow_card_suspension_threshold between 2 and 10
  ),
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
  primary_color text,
  secondary_color text,
  accent_color text,
  home_jersey_url text,
  away_jersey_url text,
  gk_home_jersey_url text,
  gk_away_jersey_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_id_manager_id_key unique (id, manager_id)
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
  team_id uuid not null,
  manager_id uuid not null references public.profiles(id),
  status public.request_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  removed_by uuid references public.profiles(id),
  removed_at timestamptz,
  removal_reason text,
  created_at timestamptz not null default now(),
  unique (season_id, team_id),
  constraint team_registrations_team_manager_fkey
    foreign key (team_id, manager_id)
    references public.teams(id, manager_id)
    on delete cascade,
  constraint team_registrations_id_season_id_key unique (id, season_id),
  constraint team_registrations_id_season_manager_key
    unique (id, season_id, manager_id)
);

alter table public.team_registrations add column if not exists removed_by uuid references public.profiles(id);
alter table public.team_registrations add column if not exists removed_at timestamptz;
alter table public.team_registrations add column if not exists removal_reason text;

create index if not exists team_registrations_team_manager_idx
  on public.team_registrations(team_id, manager_id);

create index if not exists team_registrations_manager_created_idx
  on public.team_registrations(manager_id, created_at desc);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  date_of_birth date,
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

create table if not exists public.player_season_registrations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_registration_id uuid not null,
  player_code text,
  position public.player_position not null,
  football_position public.football_position,
  position_category public.position_category,
  shirt_number integer not null,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shirt_number_range check (shirt_number is null or shirt_number between 1 and 99),
  constraint player_registrations_generated_identity_check check (
    (identity_mode = 'GENERATED' and is_generated = true)
    or identity_mode = 'VERIFIED'
  ),
  constraint player_registration_suspension_state_check check (
    (
      player_status = 'SUSPENDED'
      and nullif(btrim(suspension_reason), '') is not null
      and suspension_type in ('UNTIL_ADMIN_UNSUSPENDS', 'UNTIL_DATE', 'NEXT_MATCHES')
      and suspended_by is not null
      and suspended_at is not null
      and (
        (
          suspension_type = 'UNTIL_DATE'
          and suspension_until is not null
          and suspension_matches_remaining is null
        )
        or (
          suspension_type = 'NEXT_MATCHES'
          and suspension_until is null
          and suspension_matches_remaining >= 1
        )
        or (
          suspension_type = 'UNTIL_ADMIN_UNSUSPENDS'
          and suspension_until is null
          and suspension_matches_remaining is null
        )
      )
    )
    or (
      player_status <> 'SUSPENDED'
      and suspension_reason is null
      and suspension_type is null
      and suspension_until is null
      and suspension_matches_remaining is null
    )
  ),
  constraint player_registrations_team_season_fkey
    foreign key (team_registration_id, season_id)
    references public.team_registrations(id, season_id)
    on delete cascade,
  constraint player_season_registrations_id_season_id_key
    unique (id, season_id),
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

create index if not exists player_abilities_player_id_idx
  on public.player_abilities(player_id);

create index if not exists player_abilities_season_team_idx
  on public.player_abilities(season_id, team_registration_id);

create or replace function app_private.enforce_player_ability_registration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  registration_record public.player_season_registrations%rowtype;
  expected_position public.football_position;
begin
  select *
  into registration_record
  from public.player_season_registrations registration
  where registration.id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Player ability registration does not exist.';
  end if;

  expected_position := coalesce(
    registration_record.football_position,
    case registration_record.position
      when 'GK' then 'GK'::public.football_position
      when 'DEF' then 'CB'::public.football_position
      when 'MID' then 'CM'::public.football_position
      when 'FWD' then 'ST'::public.football_position
    end
  );

  if new.player_id is distinct from registration_record.player_id
    or new.team_registration_id is distinct from registration_record.team_registration_id
    or new.season_id is distinct from registration_record.season_id
    or new.position is distinct from expected_position then
    raise exception using
      errcode = '23514',
      message = 'Player ability identity fields must match its season registration.';
  end if;

  return new;
end
$function$;

create or replace function app_private.sync_player_registration_ability_tier()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    update public.player_season_registrations
    set
      ability_rating = null,
      updated_at = now()
    where id = old.player_registration_id
      and ability_rating is not null;
    return old;
  end if;

  update public.player_season_registrations
  set
    ability_rating = new.rating_tier,
    updated_at = now()
  where id = new.player_registration_id
    and ability_rating is distinct from new.rating_tier;

  return new;
end
$function$;

create or replace function app_private.protect_player_ability_dependency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  ability_record public.player_abilities%rowtype;
  old_expected_position public.football_position;
  new_expected_position public.football_position;
begin
  select *
  into ability_record
  from public.player_abilities ability
  where ability.player_registration_id = old.id;

  if not found then
    if new.ability_rating is not null then
      raise exception using
        errcode = '23514',
        message = 'A registration cannot have an ability tier without a player ability record.';
    end if;
    return new;
  end if;

  old_expected_position := coalesce(
    old.football_position,
    case old.position
      when 'GK' then 'GK'::public.football_position
      when 'DEF' then 'CB'::public.football_position
      when 'MID' then 'CM'::public.football_position
      when 'FWD' then 'ST'::public.football_position
    end
  );
  new_expected_position := coalesce(
    new.football_position,
    case new.position
      when 'GK' then 'GK'::public.football_position
      when 'DEF' then 'CB'::public.football_position
      when 'MID' then 'CM'::public.football_position
      when 'FWD' then 'ST'::public.football_position
    end
  );

  if new.player_id is distinct from old.player_id
    or new.team_registration_id is distinct from old.team_registration_id
    or new.season_id is distinct from old.season_id
    or new_expected_position is distinct from old_expected_position then
    raise exception using
      errcode = '23514',
      message = 'Rated player identity or position cannot change until its ability record is regenerated.';
  end if;

  if new.ability_rating is distinct from ability_record.rating_tier then
    raise exception using
      errcode = '23514',
      message = 'Registration ability tier must match the player ability record.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_player_ability_registration()
from public, anon, authenticated;

revoke all on function app_private.sync_player_registration_ability_tier()
from public, anon, authenticated;

revoke all on function app_private.protect_player_ability_dependency()
from public, anon, authenticated;

drop trigger if exists enforce_player_ability_registration
on public.player_abilities;

create trigger enforce_player_ability_registration
before insert or update of
  player_registration_id,
  player_id,
  team_registration_id,
  season_id,
  position
on public.player_abilities
for each row
execute function app_private.enforce_player_ability_registration();

drop trigger if exists sync_player_registration_ability_tier
on public.player_abilities;

create trigger sync_player_registration_ability_tier
after insert or update of rating_tier or delete
on public.player_abilities
for each row
execute function app_private.sync_player_registration_ability_tier();

drop trigger if exists protect_player_ability_dependency
on public.player_season_registrations;

create trigger protect_player_ability_dependency
before update of
  player_id,
  team_registration_id,
  season_id,
  position,
  football_position,
  ability_rating
on public.player_season_registrations
for each row
execute function app_private.protect_player_ability_dependency();

-- Fixtures reference season_groups, so the parent relation must exist first
-- when this schema is installed on a clean database.
create table if not exists public.season_groups (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name),
  constraint season_groups_id_season_id_key unique (id, season_id)
);

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  round_no integer not null,
  matchday_number integer,
  stage text not null default 'LEAGUE',
  group_id uuid,
  group_name text,
  home_team_registration_id uuid,
  away_team_registration_id uuid,
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
  constraint fixtures_valid_stage check (
    stage in (
      'LEAGUE',
      'GROUP',
      'ROUND_OF_64',
      'ROUND_OF_32',
      'ROUND_OF_16',
      'QUARTER_FINAL',
      'SEMI_FINAL',
      'FINAL'
    )
  ),
  constraint fixture_distinct_teams check (home_team_registration_id <> away_team_registration_id),
  constraint fixture_non_negative_scores check (
    (home_score is null or home_score >= 0) and (away_score is null or away_score >= 0)
  ),
  constraint fixtures_winner_is_participant_check check (
    winner_team_registration_id is null
    or (
      home_team_registration_id is not null
      and winner_team_registration_id = home_team_registration_id
    )
    or (
      away_team_registration_id is not null
      and winner_team_registration_id = away_team_registration_id
    )
  ),
  constraint fixtures_penalty_winner_is_participant_check check (
    penalty_winner_team_registration_id is null
    or (
      home_team_registration_id is not null
      and penalty_winner_team_registration_id = home_team_registration_id
    )
    or (
      away_team_registration_id is not null
      and penalty_winner_team_registration_id = away_team_registration_id
    )
  ),
  constraint fixtures_home_team_registration_id_fkey
    foreign key (home_team_registration_id, season_id)
    references public.team_registrations(id, season_id),
  constraint fixtures_away_team_registration_id_fkey
    foreign key (away_team_registration_id, season_id)
    references public.team_registrations(id, season_id),
  constraint fixtures_group_id_fkey
    foreign key (group_id, season_id)
    references public.season_groups(id, season_id)
    on delete set null (group_id),
  constraint fixtures_id_season_id_key unique (id, season_id)
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
  fixture_id uuid not null,
  team_registration_id uuid not null,
  season_id uuid not null references public.seasons(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete restrict,
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
  constraint lineups_fixture_season_fkey
    foreign key (fixture_id, season_id)
    references public.fixtures(id, season_id)
    on delete cascade,
  constraint lineups_team_season_manager_fkey
    foreign key (team_registration_id, season_id, manager_id)
    references public.team_registrations(id, season_id, manager_id)
    on delete cascade,
  unique (fixture_id, team_registration_id)
);

create index if not exists lineups_team_season_manager_idx
  on public.lineups(team_registration_id, season_id, manager_id);

create or replace function app_private.enforce_lineup_fixture_team()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
begin
  select
    fixture.season_id,
    fixture.home_team_registration_id,
    fixture.away_team_registration_id
  into
    fixture_season_id,
    fixture_home_team_id,
    fixture_away_team_id
  from public.fixtures fixture
  where fixture.id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup fixture does not exist.';
  end if;

  if new.season_id is distinct from fixture_season_id
    or (
      new.team_registration_id is distinct from fixture_home_team_id
      and new.team_registration_id is distinct from fixture_away_team_id
    ) then
    raise exception using
      errcode = '23514',
      message = 'Lineup team must be a participant in the same fixture season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_fixture_lineup_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.lineups lineup
    where lineup.fixture_id = old.id
      and (
        lineup.season_id is distinct from new.season_id
        or (
          lineup.team_registration_id is distinct from new.home_team_registration_id
          and lineup.team_registration_id is distinct from new.away_team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Fixture participants or season cannot invalidate submitted lineups.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_lineup_fixture_team()
from public, anon, authenticated;

revoke all on function app_private.protect_fixture_lineup_scope()
from public, anon, authenticated;

drop trigger if exists enforce_lineup_fixture_team
on public.lineups;

create trigger enforce_lineup_fixture_team
before insert or update of
  fixture_id,
  team_registration_id,
  season_id
on public.lineups
for each row
execute function app_private.enforce_lineup_fixture_team();

drop trigger if exists protect_fixture_lineup_scope
on public.fixtures;

create trigger protect_fixture_lineup_scope
before update of
  season_id,
  home_team_registration_id,
  away_team_registration_id
on public.fixtures
for each row
execute function app_private.protect_fixture_lineup_scope();

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
  shirt_number integer not null,
  is_captain boolean not null default false,
  display_order integer,
  created_at timestamptz not null default now(),
  constraint lineup_players_slot_role_consistency check (
    (is_starter and slot_key is not null)
    or (not is_starter and slot_key is null)
  ),
  constraint lineup_players_captain_must_start check (
    not is_captain or is_starter
  ),
  constraint lineup_players_shirt_number_range_check check (
    shirt_number between 1 and 99
  ),
  unique (lineup_id, player_registration_id)
);

create unique index if not exists lineup_players_one_captain_per_lineup_uidx
  on public.lineup_players(lineup_id)
  where is_captain;

create unique index if not exists lineup_players_unique_starter_slot_uidx
  on public.lineup_players(lineup_id, slot_key)
  where is_starter and slot_key is not null;

create or replace function app_private.set_lineup_player_shirt_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  registration_shirt_number integer;
begin
  select player_registration.shirt_number
  into registration_shirt_number
  from public.player_season_registrations player_registration
  where player_registration.id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup player registration does not exist.';
  end if;

  if registration_shirt_number is null then
    raise exception using
      errcode = '23514',
      message = 'A lineup player must have a registered shirt number.';
  end if;

  new.shirt_number := registration_shirt_number;
  return new;
end
$function$;

revoke all
on function app_private.set_lineup_player_shirt_number()
from public, anon, authenticated;

drop trigger if exists set_lineup_player_shirt_number
on public.lineup_players;

create trigger set_lineup_player_shirt_number
before insert or update of player_registration_id, shirt_number
on public.lineup_players
for each row
execute function app_private.set_lineup_player_shirt_number();

create table if not exists public.lineup_set_piece_takers (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  set_piece_type text not null check (set_piece_type in ('PENALTY', 'FREE_KICK')),
  priority smallint not null check (priority between 1 and 60),
  created_at timestamptz not null default now(),
  unique (lineup_id, set_piece_type, priority),
  unique (lineup_id, set_piece_type, player_registration_id)
);

create index if not exists idx_lineup_set_piece_takers_lineup
  on public.lineup_set_piece_takers(lineup_id, set_piece_type, priority);

create index if not exists lineups_captain_id_idx
  on public.lineups(captain_id)
  where captain_id is not null;

create index if not exists lineup_set_piece_takers_player_lineup_idx
  on public.lineup_set_piece_takers(player_registration_id, lineup_id);

create or replace function app_private.enforce_lineup_captain_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  captain_team_id uuid;
  captain_season_id uuid;
begin
  if new.captain_id is null then
    return new;
  end if;

  select
    player_registration.team_registration_id,
    player_registration.season_id
  into
    captain_team_id,
    captain_season_id
  from public.player_season_registrations player_registration
  where player_registration.id = new.captain_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup captain registration does not exist.';
  end if;

  if captain_team_id is distinct from new.team_registration_id
    or captain_season_id is distinct from new.season_id then
    raise exception using
      errcode = '23514',
      message = 'Lineup captain must belong to the lineup team and season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.enforce_lineup_player_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  lineup_team_id uuid;
  lineup_season_id uuid;
  player_team_id uuid;
  player_season_id uuid;
begin
  select lineup.team_registration_id, lineup.season_id
  into lineup_team_id, lineup_season_id
  from public.lineups lineup
  where lineup.id = new.lineup_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup does not exist.';
  end if;

  select
    player_registration.team_registration_id,
    player_registration.season_id
  into
    player_team_id,
    player_season_id
  from public.player_season_registrations player_registration
  where player_registration.id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup player registration does not exist.';
  end if;

  if player_team_id is distinct from lineup_team_id
    or player_season_id is distinct from lineup_season_id then
    raise exception using
      errcode = '23514',
      message = 'Lineup player must belong to the lineup team and season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.enforce_set_piece_taker_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  lineup_team_id uuid;
  lineup_season_id uuid;
  player_team_id uuid;
  player_season_id uuid;
begin
  if not exists (
    select 1
    from public.lineup_players lineup_player
    where lineup_player.lineup_id = new.lineup_id
      and lineup_player.player_registration_id = new.player_registration_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Set-piece taker must belong to the submitted lineup.';
  end if;

  select lineup.team_registration_id, lineup.season_id
  into lineup_team_id, lineup_season_id
  from public.lineups lineup
  where lineup.id = new.lineup_id;

  select
    player_registration.team_registration_id,
    player_registration.season_id
  into
    player_team_id,
    player_season_id
  from public.player_season_registrations player_registration
  where player_registration.id = new.player_registration_id;

  if player_team_id is distinct from lineup_team_id
    or player_season_id is distinct from lineup_season_id then
    raise exception using
      errcode = '23514',
      message = 'Set-piece taker must belong to the lineup team and season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.validate_published_lineup(
  target_lineup_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  lineup_record public.lineups%rowtype;
  matching_captains integer;
begin
  select *
  into lineup_record
  from public.lineups lineup
  where lineup.id = target_lineup_id;

  if not found or lineup_record.status not in ('PENDING', 'CONFIRMED') then
    return;
  end if;

  if lineup_record.captain_id is null then
    raise exception using
      errcode = '23514',
      message = 'A pending or confirmed lineup must have a captain.';
  end if;

  select count(*)
  into matching_captains
  from public.lineup_players lineup_player
  where lineup_player.lineup_id = lineup_record.id
    and lineup_player.player_registration_id = lineup_record.captain_id
    and lineup_player.is_starter
    and lineup_player.is_captain;

  if matching_captains <> 1 then
    raise exception using
      errcode = '23514',
      message = 'Published lineup captain must be exactly one marked starter in that lineup.';
  end if;

  if exists (
    select 1
    from public.lineup_players lineup_player
    join public.player_season_registrations player_registration
      on player_registration.id = lineup_player.player_registration_id
    where lineup_player.lineup_id = lineup_record.id
      and (
        player_registration.team_registration_id is distinct from lineup_record.team_registration_id
        or player_registration.season_id is distinct from lineup_record.season_id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Published lineup contains a player from another team or season.';
  end if;

  if exists (
    select 1
    from public.lineup_set_piece_takers taker
    left join public.lineup_players lineup_player
      on lineup_player.lineup_id = taker.lineup_id
     and lineup_player.player_registration_id = taker.player_registration_id
    where taker.lineup_id = lineup_record.id
      and lineup_player.id is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Published lineup has a set-piece taker outside its submitted squad.';
  end if;
end
$function$;

create or replace function app_private.validate_lineup_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_name = 'lineups' then
    perform app_private.validate_published_lineup(new.id);
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform app_private.validate_published_lineup(old.lineup_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform app_private.validate_published_lineup(new.lineup_id);
    return new;
  end if;

  return old;
end
$function$;

revoke all on function app_private.enforce_lineup_captain_scope() from public;
revoke all on function app_private.enforce_lineup_player_scope() from public;
revoke all on function app_private.enforce_set_piece_taker_scope() from public;
revoke all on function app_private.validate_published_lineup(uuid) from public;
revoke all on function app_private.validate_lineup_after_change() from public;

drop trigger if exists lineups_enforce_captain_scope
on public.lineups;

create trigger lineups_enforce_captain_scope
before insert or update of captain_id, team_registration_id, season_id
on public.lineups
for each row
execute function app_private.enforce_lineup_captain_scope();

drop trigger if exists lineup_players_enforce_scope
on public.lineup_players;

create trigger lineup_players_enforce_scope
before insert or update of lineup_id, player_registration_id
on public.lineup_players
for each row
execute function app_private.enforce_lineup_player_scope();

drop trigger if exists lineup_set_piece_takers_enforce_scope
on public.lineup_set_piece_takers;

create trigger lineup_set_piece_takers_enforce_scope
before insert or update of lineup_id, player_registration_id
on public.lineup_set_piece_takers
for each row
execute function app_private.enforce_set_piece_taker_scope();

drop trigger if exists lineups_validate_published_state
on public.lineups;

create trigger lineups_validate_published_state
after insert or update of status, captain_id, team_registration_id, season_id
on public.lineups
for each row
execute function app_private.validate_lineup_after_change();

drop trigger if exists lineup_players_validate_published_state
on public.lineup_players;

create trigger lineup_players_validate_published_state
after insert or update or delete
on public.lineup_players
for each row
execute function app_private.validate_lineup_after_change();

create table if not exists public.manager_team_preferences (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  preferred_formation text not null default '4-3-3',
  preferred_playing_style text not null default 'BALANCED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manager_team_preferences_non_blank_check check (
    nullif(btrim(preferred_formation), '') is not null
    and nullif(btrim(preferred_playing_style), '') is not null
  ),
  unique (manager_id, team_registration_id, season_id)
);

create index if not exists manager_team_preferences_team_registration_idx
  on public.manager_team_preferences(team_registration_id);

create or replace function app_private.enforce_manager_preference_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  registration_manager_id uuid;
  registration_season_id uuid;
begin
  select
    team_registration.manager_id,
    team_registration.season_id
  into
    registration_manager_id,
    registration_season_id
  from public.team_registrations team_registration
  where team_registration.id = new.team_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Manager preference team registration does not exist.';
  end if;

  if new.manager_id is distinct from registration_manager_id
    or new.season_id is distinct from registration_season_id then
    raise exception using
      errcode = '23514',
      message = 'Manager preference must match the team registration manager and season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_manager_preference_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.manager_team_preferences preference
    where preference.team_registration_id = old.id
      and (
        preference.manager_id is distinct from new.manager_id
        or preference.season_id is distinct from new.season_id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Team registration manager or season cannot change while scoped preferences exist.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_manager_preference_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_manager_preference_scope()
from public, anon, authenticated;

drop trigger if exists enforce_manager_preference_scope
on public.manager_team_preferences;

create trigger enforce_manager_preference_scope
before insert or update of manager_id, team_registration_id, season_id
on public.manager_team_preferences
for each row
execute function app_private.enforce_manager_preference_scope();

drop trigger if exists protect_manager_preference_scope
on public.team_registrations;

create trigger protect_manager_preference_scope
before update of manager_id, season_id
on public.team_registrations
for each row
execute function app_private.protect_manager_preference_scope();

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
  constraint team_match_stats_shot_consistency_check check (
    shots_off_target = shots - shots_on_target
    and hit_woodwork <= shots_off_target
  ),
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
  constraint player_match_stats_penalty_consistency_check check (
    penalty_scored <= goals
    and penalty_scored + penalty_missed <= shots
    and penalty_saved_for_gk <= saves
    and (
      accurate_long_balls is null
      or accurate_long_balls <= accurate_passes
    )
    and (
      not clean_sheet
      or coalesce(goals_conceded, 0) = 0
    )
  ),
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
  created_at timestamptz not null default now(),
  constraint match_events_distinct_players_check check (
    related_player_registration_id is null
    or related_player_registration_id <> player_registration_id
  ),
  constraint match_events_required_related_player_check check (
    type not in ('ASSIST', 'SUBSTITUTION', 'PENALTY_SAVED')
    or related_player_registration_id is not null
  )
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
  created_at timestamptz not null default now(),
  constraint match_injuries_descriptor_check check (
    nullif(btrim(injury_type), '') is not null
    and nullif(btrim(severity), '') is not null
  )
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
  updated_at timestamptz not null default now(),
  constraint player_suspensions_integrity_check check (
    nullif(btrim(reason), '') is not null
    and reason in ('RED_CARD', 'YELLOW_CARD_ACCUMULATION')
    and (
      (
        status = 'ACTIVE'
        and matches_remaining > 0
      )
      or (
        status in ('SERVED', 'CANCELLED')
        and matches_remaining = 0
      )
    )
  )
);

create unique index if not exists match_substitutions_fixture_outgoing_uidx
  on public.match_substitutions(fixture_id, player_out_registration_id);

create unique index if not exists match_substitutions_fixture_incoming_uidx
  on public.match_substitutions(fixture_id, player_in_registration_id);

create unique index if not exists match_injuries_fixture_player_uidx
  on public.match_injuries(fixture_id, player_registration_id);

create index if not exists match_injuries_active_player_idx
  on public.match_injuries(player_registration_id, created_at desc)
  where expected_matches_out > 0;

create index if not exists match_injuries_active_team_idx
  on public.match_injuries(team_registration_id, fixture_id)
  where expected_matches_out > 0;

create unique index if not exists player_suspensions_one_active_player_uidx
  on public.player_suspensions(player_registration_id)
  where status = 'ACTIVE'
    and matches_remaining > 0;

create index if not exists player_suspensions_active_team_idx
  on public.player_suspensions(team_registration_id, player_registration_id)
  where status = 'ACTIVE'
    and matches_remaining > 0;

create index if not exists player_suspensions_source_fixture_idx
  on public.player_suspensions(source_fixture_id)
  where source_fixture_id is not null;

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_registration_id uuid not null,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  fair_play_score integer not null default 0,
  admin_draw_rank integer,
  updated_at timestamptz not null default now(),
  constraint standings_team_registration_id_fkey
    foreign key (team_registration_id, season_id)
    references public.team_registrations(id, season_id)
    on delete cascade,
  constraint standings_non_negative_totals_check check (
    won >= 0
    and drawn >= 0
    and lost >= 0
    and goals_for >= 0
    and goals_against >= 0
  ),
  constraint standings_fair_play_score_check check (
    fair_play_score <= 0
  ),
  constraint standings_admin_draw_rank_check check (
    admin_draw_rank is null or admin_draw_rank > 0
  ),
  unique (season_id, team_registration_id)
);

create table if not exists public.player_season_stats (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_registration_id uuid not null,
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
  constraint player_season_stats_player_registration_id_fkey
    foreign key (player_registration_id, season_id)
    references public.player_season_registrations(id, season_id)
    on delete cascade,
  constraint player_season_stats_non_negative_dashboard_stats check (
    appearances >= 0
    and starts >= 0
    and minutes_played >= 0
    and goals >= 0
    and assists >= 0
    and shots >= 0
    and shots_on_target >= 0
    and chances_created >= 0
    and big_chances_created >= 0
    and total_passes >= 0
    and accurate_passes >= 0
    and dribbles_attempted >= 0
    and successful_dribbles >= 0
    and dribbled_past >= 0
    and dispossessed >= 0
    and tackles >= 0
    and interceptions >= 0
    and yellow_cards >= 0
    and red_cards >= 0
    and player_of_match_count >= 0
  ),
  constraint player_season_stats_aggregate_consistency_check check (
    starts <= appearances
    and minutes_played <= appearances * 130
    and shots_on_target <= shots
    and accurate_passes <= total_passes
    and successful_dribbles <= dribbles_attempted
    and player_of_match_count <= appearances
    and (
      (
        appearances = 0
        and average_rating is null
        and best_match_rating is null
        and lowest_match_rating is null
      )
      or (
        appearances > 0
        and average_rating is not null
        and best_match_rating is not null
        and lowest_match_rating is not null
        and average_rating between 4.5 and 10
        and best_match_rating between 4.5 and 10
        and lowest_match_rating between 4.5 and 10
        and lowest_match_rating <= average_rating
        and average_rating <= best_match_rating
      )
    )
  ),
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
    appearances >= 0
    and starts >= 0
    and minutes_played >= 0
    and goals >= 0
    and assists >= 0
    and shots >= 0
    and shots_on_target >= 0
    and chances_created >= 0
    and big_chances_created >= 0
    and total_passes >= 0
    and accurate_passes >= 0
    and dribbles_attempted >= 0
    and successful_dribbles >= 0
    and dribbled_past >= 0
    and dispossessed >= 0
    and tackles >= 0
    and interceptions >= 0
    and yellow_cards >= 0
    and red_cards >= 0
    and player_of_match_count >= 0
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
  created_at timestamptz not null default now(),
  constraint manager_messages_content_check check (
    nullif(btrim(message), '') is not null
    and (
      notification_key is null
      or nullif(btrim(notification_key), '') is not null
    )
  )
);

alter table public.manager_messages add column if not exists player_registration_id uuid references public.player_season_registrations(id) on delete set null;
alter table public.manager_messages add column if not exists fixture_id uuid references public.fixtures(id) on delete set null;
alter table public.manager_messages add column if not exists notification_key text;
create unique index if not exists manager_messages_notification_key_uidx on public.manager_messages (notification_key);

create index if not exists idx_manager_messages_team
  on public.manager_messages(team_registration_id, created_at desc)
  where team_registration_id is not null;

create or replace function app_private.enforce_manager_message_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  team_manager_id uuid;
  team_season_id uuid;
  player_team_id uuid;
  player_manager_id uuid;
  player_season_id uuid;
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
begin
  if new.team_registration_id is not null then
    select team_registration.manager_id, team_registration.season_id
    into team_manager_id, team_season_id
    from public.team_registrations team_registration
    where team_registration.id = new.team_registration_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Manager message team registration does not exist.';
    end if;

    if new.manager_id is distinct from team_manager_id
      or new.season_id is distinct from team_season_id then
      raise exception using
        errcode = '23514',
        message = 'Manager message must match the team registration manager and season.';
    end if;
  end if;

  if new.player_registration_id is not null then
    select
      player_registration.team_registration_id,
      player_team.manager_id,
      player_registration.season_id
    into
      player_team_id,
      player_manager_id,
      player_season_id
    from public.player_season_registrations player_registration
    join public.team_registrations player_team
      on player_team.id = player_registration.team_registration_id
    where player_registration.id = new.player_registration_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Manager message player registration does not exist.';
    end if;

    if new.manager_id is distinct from player_manager_id
      or new.season_id is distinct from player_season_id
      or (
        new.team_registration_id is not null
        and new.team_registration_id is distinct from player_team_id
      ) then
      raise exception using
        errcode = '23514',
        message = 'Manager message player must match its manager, team, and season scope.';
    end if;
  end if;

  if new.fixture_id is not null then
    select
      fixture.season_id,
      fixture.home_team_registration_id,
      fixture.away_team_registration_id
    into
      fixture_season_id,
      fixture_home_team_id,
      fixture_away_team_id
    from public.fixtures fixture
    where fixture.id = new.fixture_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Manager message fixture does not exist.';
    end if;

    if new.season_id is distinct from fixture_season_id
      or (
        new.team_registration_id is not null
        and new.team_registration_id is distinct from fixture_home_team_id
        and new.team_registration_id is distinct from fixture_away_team_id
      ) then
      raise exception using
        errcode = '23514',
        message = 'Manager message fixture must match its team and season scope.';
    end if;
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_manager_message_team_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.manager_messages manager_message
    where manager_message.team_registration_id = old.id
      and (
        manager_message.manager_id is distinct from new.manager_id
        or manager_message.season_id is distinct from new.season_id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Team registration manager or season cannot invalidate manager messages.';
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_manager_message_player_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.manager_messages manager_message
    where manager_message.player_registration_id = old.id
      and (
        manager_message.season_id is distinct from new.season_id
        or (
          manager_message.team_registration_id is not null
          and manager_message.team_registration_id is distinct from new.team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Player registration team or season cannot invalidate manager messages.';
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_manager_message_fixture_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.manager_messages manager_message
    where manager_message.fixture_id = old.id
      and (
        manager_message.season_id is distinct from new.season_id
        or (
          manager_message.team_registration_id is not null
          and manager_message.team_registration_id is distinct from new.home_team_registration_id
          and manager_message.team_registration_id is distinct from new.away_team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Fixture participants or season cannot invalidate manager messages.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_manager_message_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_manager_message_team_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_manager_message_player_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_manager_message_fixture_scope()
from public, anon, authenticated;

drop trigger if exists enforce_manager_message_scope
on public.manager_messages;

create trigger enforce_manager_message_scope
before insert or update of
  season_id,
  manager_id,
  team_registration_id,
  player_registration_id,
  fixture_id
on public.manager_messages
for each row
execute function app_private.enforce_manager_message_scope();

drop trigger if exists protect_manager_message_team_scope
on public.team_registrations;

create trigger protect_manager_message_team_scope
before update of manager_id, season_id
on public.team_registrations
for each row
execute function app_private.protect_manager_message_team_scope();

drop trigger if exists protect_manager_message_player_scope
on public.player_season_registrations;

create trigger protect_manager_message_player_scope
before update of team_registration_id, season_id
on public.player_season_registrations
for each row
execute function app_private.protect_manager_message_player_scope();

drop trigger if exists protect_manager_message_fixture_scope
on public.fixtures;

create trigger protect_manager_message_fixture_scope
before update of
  season_id,
  home_team_registration_id,
  away_team_registration_id
on public.fixtures
for each row
execute function app_private.protect_manager_message_fixture_scope();

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

-- Fans (USER role) follow persistent clubs. Reads/writes go through the Express
-- API using the service role, like every other tournament table.
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

create unique index if not exists user_favorite_teams_one_primary_uidx
  on public.user_favorite_teams(user_id)
  where is_primary = true;

create or replace function app_private.lock_group_after_fixture_generation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.stage = 'GROUP' and new.group_id is not null then
    update public.season_groups
    set
      locked = true,
      updated_at = now()
    where id = new.group_id
      and locked = false;
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_locked_group_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if (
    tg_op = 'INSERT'
    and exists (
      select 1
      from public.season_groups season_group
      where season_group.id = new.group_id
        and season_group.locked
    )
  ) or (
    tg_op = 'DELETE'
    and exists (
      select 1
      from public.season_groups season_group
      where season_group.id = old.group_id
        and season_group.locked
    )
  ) or (
    tg_op = 'UPDATE'
    and exists (
      select 1
      from public.season_groups season_group
      where season_group.id in (old.group_id, new.group_id)
        and season_group.locked
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Group assignments are locked because group fixtures have already been generated.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

create or replace function app_private.protect_locked_season_group()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if old.locked then
      raise exception using
        errcode = '23514',
        message = 'A group cannot be changed or unlocked after group fixtures are generated.';
    end if;
    return old;
  end if;

  if old.locked and (
    new.locked = false
    or new.season_id is distinct from old.season_id
    or new.name is distinct from old.name
  ) then
    raise exception using
      errcode = '23514',
      message = 'A group cannot be changed or unlocked after group fixtures are generated.';
  end if;

  return new;
end
$function$;

revoke all
on function app_private.lock_group_after_fixture_generation()
from public, anon, authenticated;

revoke all
on function app_private.protect_locked_group_assignment()
from public, anon, authenticated;

revoke all
on function app_private.protect_locked_season_group()
from public, anon, authenticated;

drop trigger if exists lock_group_after_fixture_generation
on public.fixtures;

create trigger lock_group_after_fixture_generation
after insert or update of stage, group_id
on public.fixtures
for each row
execute function app_private.lock_group_after_fixture_generation();

drop trigger if exists protect_locked_group_assignment
on public.season_group_teams;

create trigger protect_locked_group_assignment
before insert or update or delete
on public.season_group_teams
for each row
execute function app_private.protect_locked_group_assignment();

drop trigger if exists protect_locked_season_group
on public.season_groups;

create trigger protect_locked_season_group
before update of season_id, name, locked or delete
on public.season_groups
for each row
execute function app_private.protect_locked_season_group();

alter table public.seasons
  drop constraint if exists seasons_champion_team_fk;

alter table public.seasons
  add constraint seasons_champion_team_fk
  foreign key (champion_team_registration_id, id)
  references public.team_registrations(id, season_id);

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
create index if not exists idx_team_match_stats_team_registration
  on public.team_match_stats(team_registration_id, fixture_id);
create index if not exists idx_player_match_stats_player_registration
  on public.player_match_stats(player_registration_id, fixture_id);
create index if not exists idx_match_events_fixture_minute
  on public.match_events(fixture_id, minute);
create index if not exists idx_match_events_player_registration
  on public.match_events(player_registration_id, fixture_id);
create index if not exists idx_match_events_related_player_registration
  on public.match_events(related_player_registration_id, fixture_id)
  where related_player_registration_id is not null;
create index if not exists idx_standings_season_sort
  on public.standings(
    season_id,
    ((won * 3) + drawn) desc,
    (goals_for - goals_against) desc,
    goals_for desc,
    fair_play_score desc,
    admin_draw_rank asc
  );
create index if not exists idx_player_stats_season_goals on public.player_season_stats(season_id, goals desc);
create index if not exists idx_manager_messages_season on public.manager_messages(season_id, created_at desc);
create index if not exists idx_manager_messages_manager_read on public.manager_messages(manager_id, read_at);
create index if not exists idx_manager_messages_player on public.manager_messages(player_registration_id);
create index if not exists idx_manager_messages_fixture on public.manager_messages(fixture_id);
create index if not exists idx_season_groups_season on public.season_groups(season_id);
create index if not exists idx_group_teams_group on public.season_group_teams(group_id);

-- Foreign-key and high-use query indexes.
create index if not exists lineup_players_player_registration_idx
  on public.lineup_players(player_registration_id, lineup_id);
create index if not exists player_registrations_created_by_manager_idx
  on public.player_season_registrations(created_by_manager_id)
  where created_by_manager_id is not null;
create index if not exists player_registrations_player_idx
  on public.player_season_registrations(player_id);
create index if not exists player_registrations_removed_by_idx
  on public.player_season_registrations(removed_by)
  where removed_by is not null;
create index if not exists player_registrations_reviewed_by_idx
  on public.player_season_registrations(reviewed_by)
  where reviewed_by is not null;
create index if not exists player_registrations_suspended_by_idx
  on public.player_season_registrations(suspended_by)
  where suspended_by is not null;
create index if not exists player_abilities_generated_by_admin_idx
  on public.player_abilities(generated_by_admin_id)
  where generated_by_admin_id is not null;
create index if not exists player_abilities_team_season_idx
  on public.player_abilities(team_registration_id, season_id);
create index if not exists player_season_stats_player_season_idx
  on public.player_season_stats(player_registration_id, season_id);
create index if not exists match_substitutions_player_in_fixture_idx
  on public.match_substitutions(player_in_registration_id, fixture_id);
create index if not exists match_substitutions_player_out_fixture_idx
  on public.match_substitutions(player_out_registration_id, fixture_id);
create index if not exists match_substitutions_team_fixture_idx
  on public.match_substitutions(team_registration_id, fixture_id);
create index if not exists manager_messages_created_by_idx
  on public.manager_messages(created_by)
  where created_by is not null;
create index if not exists manager_messages_manager_created_idx
  on public.manager_messages(manager_id, created_at desc);
create index if not exists lineups_manager_created_idx
  on public.lineups(manager_id, created_at desc);
create index if not exists lineups_reviewed_by_idx
  on public.lineups(reviewed_by)
  where reviewed_by is not null;
create index if not exists lineups_season_created_idx
  on public.lineups(season_id, created_at desc);
create index if not exists fixtures_home_team_schedule_idx
  on public.fixtures(home_team_registration_id, season_id, kickoff_at)
  where home_team_registration_id is not null;
create index if not exists fixtures_away_team_schedule_idx
  on public.fixtures(away_team_registration_id, season_id, kickoff_at)
  where away_team_registration_id is not null;
create index if not exists fixtures_finalized_by_idx
  on public.fixtures(finalized_by)
  where finalized_by is not null;
create index if not exists fixtures_league_season_idx
  on public.fixtures(league_id, season_id)
  where league_id is not null;
create index if not exists fixtures_penalty_winner_idx
  on public.fixtures(penalty_winner_team_registration_id)
  where penalty_winner_team_registration_id is not null;
create index if not exists fixtures_winner_idx
  on public.fixtures(winner_team_registration_id)
  where winner_team_registration_id is not null;
create index if not exists manager_preferences_season_manager_idx
  on public.manager_team_preferences(season_id, manager_id);
create index if not exists standings_team_season_idx
  on public.standings(team_registration_id, season_id);
create index if not exists team_registrations_removed_by_idx
  on public.team_registrations(removed_by)
  where removed_by is not null;
create index if not exists team_registrations_reviewed_by_idx
  on public.team_registrations(reviewed_by)
  where reviewed_by is not null;
create index if not exists teams_manager_created_idx
  on public.teams(manager_id, created_at desc);
create index if not exists player_suspensions_season_status_idx
  on public.player_suspensions(season_id, status);
create index if not exists seasons_champion_team_idx
  on public.seasons(champion_team_registration_id, id)
  where champion_team_registration_id is not null;
create or replace view public.season_standings_report
with (security_invoker = true)
as
with base_standings as (
  select
    standing.*,
    standing.won + standing.drawn + standing.lost as played,
    standing.goals_for - standing.goals_against as goal_difference,
    standing.won * 3 + standing.drawn as points
  from public.standings standing
),
scoped_standings as (
  select
    standing.*,
    group_team.group_id,
    season_group.name as group_name
  from base_standings standing
  left join public.season_group_teams group_team
    on group_team.team_registration_id = standing.team_registration_id
  left join public.season_groups season_group
    on season_group.id = group_team.group_id
),
head_to_head as (
  select
    standing.id as standing_id,
    coalesce(
      sum(
        case
          when fixture.home_team_registration_id = standing.team_registration_id
            and fixture.home_score > fixture.away_score then 3
          when fixture.away_team_registration_id = standing.team_registration_id
            and fixture.away_score > fixture.home_score then 3
          when fixture.home_score = fixture.away_score then 1
          else 0
        end
      ),
      0
    )::integer as points
  from scoped_standings standing
  left join scoped_standings opponent
    on opponent.season_id = standing.season_id
   and opponent.team_registration_id <> standing.team_registration_id
   and opponent.points = standing.points
   and opponent.goal_difference = standing.goal_difference
   and opponent.goals_for = standing.goals_for
   and opponent.group_id is not distinct from standing.group_id
  left join public.fixtures fixture
    on fixture.season_id = standing.season_id
   and fixture.result_confirmed = true
   and fixture.stage in ('LEAGUE', 'GROUP')
   and (
     (
       fixture.home_team_registration_id = standing.team_registration_id
       and fixture.away_team_registration_id = opponent.team_registration_id
     )
     or (
       fixture.away_team_registration_id = standing.team_registration_id
       and fixture.home_team_registration_id = opponent.team_registration_id
     )
   )
  group by standing.id
)
select
  standing.id as standing_id,
  standing.season_id,
  season.league_id,
  league.name as league_name,
  season.name as season_name,
  season.season_year,
  standing.group_id,
  standing.group_name,
  standing.team_registration_id,
  team.id as team_id,
  team.name as team_name,
  team.short_name as team_short_name,
  team.logo_url as team_logo_url,
  standing.played,
  standing.won,
  standing.drawn,
  standing.lost,
  standing.goals_for,
  standing.goals_against,
  standing.goal_difference,
  standing.points,
  standing.fair_play_score,
  standing.admin_draw_rank,
  row_number() over (
    partition by standing.season_id, standing.group_id
    order by
      standing.points desc,
      standing.goal_difference desc,
      standing.goals_for desc,
      head_to_head.points desc,
      standing.fair_play_score desc,
      standing.admin_draw_rank nulls last,
      standing.team_registration_id
  )::integer as position,
  standing.updated_at,
  head_to_head.points as head_to_head_points
from scoped_standings standing
join head_to_head
  on head_to_head.standing_id = standing.id
join public.seasons season
  on season.id = standing.season_id
join public.leagues league
  on league.id = season.league_id
join public.team_registrations team_registration
  on team_registration.id = standing.team_registration_id
 and team_registration.season_id = standing.season_id
join public.teams team
  on team.id = team_registration.team_id;

create or replace view public.team_season_statistics_report
with (security_invoker = true)
as
with match_totals as (
  select
    team_stat.team_registration_id,
    fixture.season_id,
    count(*)::integer as matches_with_statistics,
    coalesce(sum(team_stat.expected_goals), 0::numeric) as total_expected_goals,
    round(coalesce(avg(team_stat.expected_goals), 0::numeric), 2) as average_expected_goals,
    round(coalesce(avg(team_stat.possession), 0::numeric), 2) as average_possession,
    coalesce(sum(team_stat.shots), 0)::integer as total_shots,
    coalesce(sum(team_stat.shots_on_target), 0)::integer as total_shots_on_target,
    coalesce(sum(team_stat.shots_off_target), 0)::integer as total_shots_off_target,
    coalesce(sum(team_stat.big_chances), 0)::integer as total_big_chances,
    coalesce(sum(team_stat.big_chances_missed), 0)::integer as total_big_chances_missed,
    coalesce(sum(team_stat.passes), 0)::integer as total_passes,
    coalesce(sum(team_stat.accurate_passes), 0)::integer as total_accurate_passes,
    coalesce(sum(team_stat.fouls), 0)::integer as total_fouls,
    coalesce(sum(team_stat.yellow_cards), 0)::integer as total_yellow_cards,
    coalesce(sum(team_stat.red_cards), 0)::integer as total_red_cards,
    coalesce(sum(team_stat.corners), 0)::integer as total_corners,
    coalesce(sum(team_stat.offsides), 0)::integer as total_offsides,
    coalesce(sum(team_stat.hit_woodwork), 0)::integer as total_hit_woodwork,
    coalesce(sum(team_stat.tackles), 0)::integer as total_tackles,
    coalesce(sum(team_stat.interceptions), 0)::integer as total_interceptions,
    coalesce(sum(team_stat.blocks), 0)::integer as total_blocks,
    coalesce(sum(team_stat.clearances), 0)::integer as total_clearances,
    coalesce(sum(team_stat.keeper_saves), 0)::integer as total_keeper_saves,
    round(coalesce(avg(team_stat.rating), 0::numeric), 2) as average_team_rating
  from public.team_match_stats team_stat
  join public.fixtures fixture
    on fixture.id = team_stat.fixture_id
  group by team_stat.team_registration_id, fixture.season_id
)
select
  team_registration.season_id,
  season.league_id,
  league.name as league_name,
  season.name as season_name,
  season.season_year,
  team_registration.id as team_registration_id,
  team.id as team_id,
  team.name as team_name,
  team.short_name as team_short_name,
  team.logo_url as team_logo_url,
  coalesce(match_totals.matches_with_statistics, 0) as matches_with_statistics,
  coalesce(match_totals.total_expected_goals, 0::numeric) as total_expected_goals,
  coalesce(match_totals.average_expected_goals, 0::numeric) as average_expected_goals,
  coalesce(match_totals.average_possession, 0::numeric) as average_possession,
  coalesce(match_totals.total_shots, 0) as total_shots,
  coalesce(match_totals.total_shots_on_target, 0) as total_shots_on_target,
  coalesce(match_totals.total_shots_off_target, 0) as total_shots_off_target,
  coalesce(match_totals.total_big_chances, 0) as total_big_chances,
  coalesce(match_totals.total_big_chances_missed, 0) as total_big_chances_missed,
  coalesce(match_totals.total_passes, 0) as total_passes,
  coalesce(match_totals.total_accurate_passes, 0) as total_accurate_passes,
  coalesce(match_totals.total_fouls, 0) as total_fouls,
  coalesce(match_totals.total_yellow_cards, 0) as total_yellow_cards,
  coalesce(match_totals.total_red_cards, 0) as total_red_cards,
  coalesce(match_totals.total_corners, 0) as total_corners,
  coalesce(match_totals.total_offsides, 0) as total_offsides,
  coalesce(match_totals.total_hit_woodwork, 0) as total_hit_woodwork,
  coalesce(match_totals.total_tackles, 0) as total_tackles,
  coalesce(match_totals.total_interceptions, 0) as total_interceptions,
  coalesce(match_totals.total_blocks, 0) as total_blocks,
  coalesce(match_totals.total_clearances, 0) as total_clearances,
  coalesce(match_totals.total_keeper_saves, 0) as total_keeper_saves,
  coalesce(match_totals.average_team_rating, 0::numeric) as average_team_rating,
  coalesce(standing.won + standing.drawn + standing.lost, 0) as played,
  coalesce(standing.won, 0) as won,
  coalesce(standing.drawn, 0) as drawn,
  coalesce(standing.lost, 0) as lost,
  coalesce(standing.goals_for, 0) as goals_for,
  coalesce(standing.goals_against, 0) as goals_against,
  coalesce(standing.goals_for - standing.goals_against, 0) as goal_difference,
  coalesce(standing.won * 3 + standing.drawn, 0) as points
from public.team_registrations team_registration
join public.seasons season
  on season.id = team_registration.season_id
join public.leagues league
  on league.id = season.league_id
join public.teams team
  on team.id = team_registration.team_id
left join match_totals
  on match_totals.team_registration_id = team_registration.id
 and match_totals.season_id = team_registration.season_id
left join public.standings standing
  on standing.team_registration_id = team_registration.id
 and standing.season_id = team_registration.season_id;

drop view if exists public.match_summary_report;

create view public.match_summary_report
with (security_invoker = true)
as
select
  fixture.id as fixture_id,
  fixture.season_id,
  fixture.league_id,
  league.name as league_name,
  season.name as season_name,
  season.season_year,
  fixture.stage,
  fixture.round_no,
  fixture.matchday_number,
  fixture.group_name,
  fixture.kickoff_at,
  fixture.status,
  fixture.result_confirmed,
  fixture.home_team_registration_id,
  home_team.name as home_team_name,
  home_team.short_name as home_team_short_name,
  home_team.logo_url as home_team_logo_url,
  fixture.away_team_registration_id,
  away_team.name as away_team_name,
  away_team.short_name as away_team_short_name,
  away_team.logo_url as away_team_logo_url,
  fixture.home_score,
  fixture.away_score,
  fixture.extra_time_played,
  fixture.penalties_home,
  fixture.penalties_away,
  fixture.winner_team_registration_id,
  winner_team.name as winner_team_name,
  fixture.penalty_winner_team_registration_id,
  penalty_winner_team.name as penalty_winner_team_name,
  home_stat.expected_goals as home_expected_goals,
  away_stat.expected_goals as away_expected_goals,
  home_stat.possession as home_possession,
  away_stat.possession as away_possession,
  home_stat.shots as home_shots,
  away_stat.shots as away_shots,
  home_stat.shots_on_target as home_shots_on_target,
  away_stat.shots_on_target as away_shots_on_target,
  home_stat.rating as home_team_rating,
  away_stat.rating as away_team_rating,
  fixture.finalized_at,
  fixture.updated_at
from public.fixtures fixture
join public.seasons season
  on season.id = fixture.season_id
left join public.leagues league
  on league.id = fixture.league_id
left join public.team_registrations home_registration
  on home_registration.id = fixture.home_team_registration_id
left join public.teams home_team
  on home_team.id = home_registration.team_id
left join public.team_registrations away_registration
  on away_registration.id = fixture.away_team_registration_id
left join public.teams away_team
  on away_team.id = away_registration.team_id
left join public.team_registrations winner_registration
  on winner_registration.id = fixture.winner_team_registration_id
left join public.teams winner_team
  on winner_team.id = winner_registration.team_id
left join public.team_registrations penalty_winner_registration
  on penalty_winner_registration.id = fixture.penalty_winner_team_registration_id
left join public.teams penalty_winner_team
  on penalty_winner_team.id = penalty_winner_registration.team_id
left join public.team_match_stats home_stat
  on home_stat.fixture_id = fixture.id
 and home_stat.team_registration_id = fixture.home_team_registration_id
left join public.team_match_stats away_stat
  on away_stat.fixture_id = fixture.id
 and away_stat.team_registration_id = fixture.away_team_registration_id;

comment on view public.season_standings_report is
  'Canonical read-only standings model. Derived totals, tie-breaks, labels, and positions are calculated from normalized base relations.';
comment on view public.team_season_statistics_report is
  'Secure read-only team season aggregates, including summed expected goals.';
comment on view public.match_summary_report is
  'Secure read-only fixture summary with participant labels and team match statistics.';

revoke all on public.season_standings_report from public, anon, authenticated;
revoke all on public.team_season_statistics_report from public, anon, authenticated;
revoke all on public.match_summary_report from public, anon, authenticated;
revoke all on public.season_standings_report from service_role;
revoke all on public.team_season_statistics_report from service_role;
revoke all on public.match_summary_report from service_role;

grant select on public.season_standings_report to service_role;
grant select on public.team_season_statistics_report to service_role;
grant select on public.match_summary_report to service_role;

create or replace function app_private.enforce_season_group_team_consistency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  group_season_id uuid;
  team_season_id uuid;
begin
  select season_id
  into group_season_id
  from public.season_groups
  where id = new.group_id;

  select season_id
  into team_season_id
  from public.team_registrations
  where id = new.team_registration_id;

  if group_season_id is not null
    and team_season_id is not null
    and group_season_id is distinct from team_season_id then
    raise exception using
      errcode = '23514',
      constraint = 'season_group_teams_same_season_check',
      message = 'A team registration can only be assigned to a group from the same season.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_season_group_team_consistency()
from public, anon, authenticated;

drop trigger if exists enforce_season_group_team_consistency
on public.season_group_teams;

create trigger enforce_season_group_team_consistency
  before insert or update of group_id, team_registration_id
  on public.season_group_teams
  for each row
  execute function app_private.enforce_season_group_team_consistency();

create or replace function app_private.enforce_team_match_stats_participant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
begin
  select
    home_team_registration_id,
    away_team_registration_id
  into
    fixture_home_team_id,
    fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'team_match_stats_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  if new.team_registration_id is distinct from fixture_home_team_id
    and new.team_registration_id is distinct from fixture_away_team_id then
    raise exception using
      errcode = '23514',
      constraint = 'team_match_stats_fixture_participant_check',
      message = 'Team match statistics must belong to the fixture home or away team.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_team_match_stats_participant()
from public, anon, authenticated;

create or replace function app_private.enforce_fixture_team_match_stats_participants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.team_match_stats team_stat
    where team_stat.fixture_id = new.id
      and team_stat.team_registration_id is distinct from new.home_team_registration_id
      and team_stat.team_registration_id is distinct from new.away_team_registration_id
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'fixtures_team_match_stats_participant_check',
      message = 'Fixture participants cannot exclude a team that already has match statistics.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_fixture_team_match_stats_participants()
from public, anon, authenticated;

create or replace function app_private.validate_team_match_stats_pair()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_fixture_id uuid;
  affected_fixture_ids uuid[];
  stat_count integer;
  possession_total integer;
begin
  if tg_op = 'DELETE' then
    affected_fixture_ids := array[old.fixture_id];
  elsif tg_op = 'UPDATE' then
    affected_fixture_ids := array[new.fixture_id, old.fixture_id];
  else
    affected_fixture_ids := array[new.fixture_id];
  end if;

  for target_fixture_id in
    select distinct fixture_id
    from unnest(affected_fixture_ids) affected_fixture(fixture_id)
    where fixture_id is not null
  loop
    if not exists (
      select 1
      from public.fixtures
      where id = target_fixture_id
    ) then
      continue;
    end if;

    select count(*), coalesce(sum(possession), 0)
    into stat_count, possession_total
    from public.team_match_stats
    where fixture_id = target_fixture_id;

    if stat_count not in (0, 2) then
      raise exception using
        errcode = '23514',
        constraint = 'team_match_stats_complete_fixture_pair_check',
        message = 'A fixture must have either no team statistics or one row for each participant.';
    end if;

    if stat_count = 2 and possession_total <> 100 then
      raise exception using
        errcode = '23514',
        constraint = 'team_match_stats_possession_total_check',
        message = 'Home and away possession must total 100.';
    end if;
  end loop;

  return null;
end;
$$;

revoke all
on function app_private.validate_team_match_stats_pair()
from public, anon, authenticated;

drop trigger if exists enforce_team_match_stats_participant
on public.team_match_stats;

create trigger enforce_team_match_stats_participant
  before insert or update of fixture_id, team_registration_id
  on public.team_match_stats
  for each row
  execute function app_private.enforce_team_match_stats_participant();

drop trigger if exists enforce_fixture_team_match_stats_participants
on public.fixtures;

create trigger enforce_fixture_team_match_stats_participants
  before update of home_team_registration_id, away_team_registration_id
  on public.fixtures
  for each row
  execute function app_private.enforce_fixture_team_match_stats_participants();

drop trigger if exists validate_team_match_stats_pair
on public.team_match_stats;

create constraint trigger validate_team_match_stats_pair
  after insert or update or delete
  on public.team_match_stats
  deferrable initially deferred
  for each row
  execute function app_private.validate_team_match_stats_pair();

create or replace function app_private.enforce_player_match_stat_participant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
  player_season_id uuid;
  player_team_id uuid;
begin
  select season_id, home_team_registration_id, away_team_registration_id
  into fixture_season_id, fixture_home_team_id, fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'player_match_stats_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  select season_id, team_registration_id
  into player_season_id, player_team_id
  from public.player_season_registrations
  where id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'player_match_stats_player_registration_id_fkey',
      message = 'The referenced player registration does not exist.';
  end if;

  if player_season_id is distinct from fixture_season_id
    or (
      player_team_id is distinct from fixture_home_team_id
      and player_team_id is distinct from fixture_away_team_id
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'player_match_stats_fixture_participant_check',
      message = 'Player match statistics must belong to a registered participant in the same fixture season.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_player_match_stat_participant()
from public, anon, authenticated;

create or replace function app_private.enforce_match_event_participants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
  player_season_id uuid;
  player_team_id uuid;
  related_player_season_id uuid;
  related_player_team_id uuid;
begin
  select season_id, home_team_registration_id, away_team_registration_id
  into fixture_season_id, fixture_home_team_id, fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_events_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  select season_id, team_registration_id
  into player_season_id, player_team_id
  from public.player_season_registrations
  where id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_events_player_registration_id_fkey',
      message = 'The referenced event player registration does not exist.';
  end if;

  if player_season_id is distinct from fixture_season_id
    or (
      player_team_id is distinct from fixture_home_team_id
      and player_team_id is distinct from fixture_away_team_id
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'match_events_fixture_participant_check',
      message = 'A match event player must be a registered participant in the same fixture season.';
  end if;

  if new.type <> 'OWN_GOAL'
    and (
      (new.side = 'HOME' and player_team_id is distinct from fixture_home_team_id)
      or (new.side = 'AWAY' and player_team_id is distinct from fixture_away_team_id)
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'match_events_side_player_check',
      message = 'The event side must match the player team, except for an own goal.';
  end if;

  if new.related_player_registration_id is not null then
    select season_id, team_registration_id
    into related_player_season_id, related_player_team_id
    from public.player_season_registrations
    where id = new.related_player_registration_id;

    if not found then
      raise exception using
        errcode = '23503',
        constraint = 'match_events_related_player_registration_id_fkey',
        message = 'The referenced related player registration does not exist.';
    end if;

    if related_player_season_id is distinct from fixture_season_id
      or (
        related_player_team_id is distinct from fixture_home_team_id
        and related_player_team_id is distinct from fixture_away_team_id
      )
      or (
        new.type = 'PENALTY_SAVED'
        and related_player_team_id is not distinct from player_team_id
      )
      or (
        new.type not in ('OWN_GOAL', 'PENALTY_SAVED')
        and related_player_team_id is distinct from player_team_id
      ) then
      raise exception using
        errcode = '23514',
        constraint = 'match_events_related_fixture_participant_check',
        message = 'The related event player must belong to the correct participating team and fixture season.';
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_match_event_participants()
from public, anon, authenticated;

create or replace function app_private.enforce_fixture_player_match_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.player_match_stats player_stat
    join public.player_season_registrations player_registration
      on player_registration.id = player_stat.player_registration_id
    where player_stat.fixture_id = new.id
      and (
        player_registration.season_id is distinct from new.season_id
        or (
          player_registration.team_registration_id is distinct from new.home_team_registration_id
          and player_registration.team_registration_id is distinct from new.away_team_registration_id
        )
      )
  ) or exists (
    select 1
    from public.match_events event
    join public.player_season_registrations player_registration
      on player_registration.id = event.player_registration_id
    left join public.player_season_registrations related_player
      on related_player.id = event.related_player_registration_id
    where event.fixture_id = new.id
      and (
        player_registration.season_id is distinct from new.season_id
        or (
          player_registration.team_registration_id is distinct from new.home_team_registration_id
          and player_registration.team_registration_id is distinct from new.away_team_registration_id
        )
        or (
          event.type <> 'OWN_GOAL'
          and (
            (event.side = 'HOME' and player_registration.team_registration_id is distinct from new.home_team_registration_id)
            or (event.side = 'AWAY' and player_registration.team_registration_id is distinct from new.away_team_registration_id)
          )
        )
        or (
          event.related_player_registration_id is not null
          and (
            related_player.season_id is distinct from new.season_id
            or (
              related_player.team_registration_id is distinct from new.home_team_registration_id
              and related_player.team_registration_id is distinct from new.away_team_registration_id
            )
            or (
              event.type = 'PENALTY_SAVED'
              and related_player.team_registration_id is not distinct from player_registration.team_registration_id
            )
            or (
              event.type not in ('OWN_GOAL', 'PENALTY_SAVED')
              and related_player.team_registration_id is distinct from player_registration.team_registration_id
            )
          )
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'fixtures_player_match_data_participant_check',
      message = 'Fixture season or participants cannot invalidate existing player match statistics or events.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_fixture_player_match_data()
from public, anon, authenticated;

create or replace function app_private.enforce_player_registration_match_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.player_match_stats player_stat
    join public.fixtures fixture
      on fixture.id = player_stat.fixture_id
    where player_stat.player_registration_id = new.id
      and (
        new.season_id is distinct from fixture.season_id
        or (
          new.team_registration_id is distinct from fixture.home_team_registration_id
          and new.team_registration_id is distinct from fixture.away_team_registration_id
        )
      )
  ) or exists (
    select 1
    from public.match_events event
    join public.fixtures fixture
      on fixture.id = event.fixture_id
    where event.player_registration_id = new.id
      and (
        new.season_id is distinct from fixture.season_id
        or (
          new.team_registration_id is distinct from fixture.home_team_registration_id
          and new.team_registration_id is distinct from fixture.away_team_registration_id
        )
        or (
          event.type <> 'OWN_GOAL'
          and (
            (event.side = 'HOME' and new.team_registration_id is distinct from fixture.home_team_registration_id)
            or (event.side = 'AWAY' and new.team_registration_id is distinct from fixture.away_team_registration_id)
          )
        )
      )
  ) or exists (
    select 1
    from public.match_events event
    join public.fixtures fixture
      on fixture.id = event.fixture_id
    join public.player_season_registrations event_player
      on event_player.id = event.player_registration_id
    where event.related_player_registration_id = new.id
      and (
        new.season_id is distinct from fixture.season_id
        or (
          new.team_registration_id is distinct from fixture.home_team_registration_id
          and new.team_registration_id is distinct from fixture.away_team_registration_id
        )
        or (
          event.type = 'PENALTY_SAVED'
          and new.team_registration_id is not distinct from event_player.team_registration_id
        )
        or (
          event.type not in ('OWN_GOAL', 'PENALTY_SAVED')
          and new.team_registration_id is distinct from event_player.team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'player_registrations_match_data_consistency_check',
      message = 'A player registration cannot be changed in a way that invalidates existing match statistics or events.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_player_registration_match_data()
from public, anon, authenticated;

drop trigger if exists enforce_player_match_stat_participant
on public.player_match_stats;

create trigger enforce_player_match_stat_participant
  before insert or update of fixture_id, player_registration_id
  on public.player_match_stats
  for each row
  execute function app_private.enforce_player_match_stat_participant();

drop trigger if exists enforce_match_event_participants
on public.match_events;

create trigger enforce_match_event_participants
  before insert or update of fixture_id, side, type, player_registration_id, related_player_registration_id
  on public.match_events
  for each row
  execute function app_private.enforce_match_event_participants();

drop trigger if exists enforce_fixture_player_match_data
on public.fixtures;

create trigger enforce_fixture_player_match_data
  before update of season_id, home_team_registration_id, away_team_registration_id
  on public.fixtures
  for each row
  execute function app_private.enforce_fixture_player_match_data();

drop trigger if exists enforce_player_registration_match_data
on public.player_season_registrations;

create trigger enforce_player_registration_match_data
  before update of season_id, team_registration_id
  on public.player_season_registrations
  for each row
  execute function app_private.enforce_player_registration_match_data();

create or replace function app_private.enforce_match_substitution_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
  outgoing_season_id uuid;
  outgoing_team_id uuid;
  incoming_season_id uuid;
  incoming_team_id uuid;
begin
  select season_id, home_team_registration_id, away_team_registration_id
  into fixture_season_id, fixture_home_team_id, fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_substitutions_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  if new.team_registration_id is distinct from fixture_home_team_id
    and new.team_registration_id is distinct from fixture_away_team_id then
    raise exception using
      errcode = '23514',
      constraint = 'match_substitutions_fixture_team_check',
      message = 'A substitution team must be a participant in the fixture.';
  end if;

  select season_id, team_registration_id
  into outgoing_season_id, outgoing_team_id
  from public.player_season_registrations
  where id = new.player_out_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_substitutions_player_out_registration_id_fkey',
      message = 'The outgoing player registration does not exist.';
  end if;

  select season_id, team_registration_id
  into incoming_season_id, incoming_team_id
  from public.player_season_registrations
  where id = new.player_in_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_substitutions_player_in_registration_id_fkey',
      message = 'The incoming player registration does not exist.';
  end if;

  if outgoing_season_id is distinct from fixture_season_id
    or incoming_season_id is distinct from fixture_season_id
    or outgoing_team_id is distinct from new.team_registration_id
    or incoming_team_id is distinct from new.team_registration_id then
    raise exception using
      errcode = '23514',
      constraint = 'match_substitutions_player_team_season_check',
      message = 'Both substitution players must belong to the selected fixture team and season.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_match_substitution_integrity()
from public, anon, authenticated;

create or replace function app_private.enforce_match_injury_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
  player_season_id uuid;
  player_team_id uuid;
begin
  select season_id, home_team_registration_id, away_team_registration_id
  into fixture_season_id, fixture_home_team_id, fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_injuries_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  select season_id, team_registration_id
  into player_season_id, player_team_id
  from public.player_season_registrations
  where id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_injuries_player_registration_id_fkey',
      message = 'The referenced injured player registration does not exist.';
  end if;

  if (
      new.team_registration_id is distinct from fixture_home_team_id
      and new.team_registration_id is distinct from fixture_away_team_id
    )
    or player_season_id is distinct from fixture_season_id
    or player_team_id is distinct from new.team_registration_id then
    raise exception using
      errcode = '23514',
      constraint = 'match_injuries_fixture_participant_check',
      message = 'An injury must belong to a player on a participating team in the same fixture season.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_match_injury_integrity()
from public, anon, authenticated;

create or replace function app_private.enforce_player_suspension_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  player_season_id uuid;
  player_team_id uuid;
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
begin
  select season_id, team_registration_id
  into player_season_id, player_team_id
  from public.player_season_registrations
  where id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'player_suspensions_player_registration_id_fkey',
      message = 'The referenced suspended player registration does not exist.';
  end if;

  if player_season_id is distinct from new.season_id
    or player_team_id is distinct from new.team_registration_id then
    raise exception using
      errcode = '23514',
      constraint = 'player_suspensions_player_team_season_check',
      message = 'A suspension must use the player registration team and season.';
  end if;

  if new.source_fixture_id is not null then
    select season_id, home_team_registration_id, away_team_registration_id
    into fixture_season_id, fixture_home_team_id, fixture_away_team_id
    from public.fixtures
    where id = new.source_fixture_id;

    if not found then
      raise exception using
        errcode = '23503',
        constraint = 'player_suspensions_source_fixture_id_fkey',
        message = 'The referenced suspension source fixture does not exist.';
    end if;

    if fixture_season_id is distinct from new.season_id
      or (
        new.team_registration_id is distinct from fixture_home_team_id
        and new.team_registration_id is distinct from fixture_away_team_id
      ) then
      raise exception using
        errcode = '23514',
        constraint = 'player_suspensions_source_fixture_check',
        message = 'A suspension source fixture must include the player team in the same season.';
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_player_suspension_integrity()
from public, anon, authenticated;

create or replace function app_private.enforce_fixture_absence_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.match_substitutions substitution
    join public.player_season_registrations outgoing_player
      on outgoing_player.id = substitution.player_out_registration_id
    join public.player_season_registrations incoming_player
      on incoming_player.id = substitution.player_in_registration_id
    where substitution.fixture_id = new.id
      and (
        (
          substitution.team_registration_id is distinct from new.home_team_registration_id
          and substitution.team_registration_id is distinct from new.away_team_registration_id
        )
        or outgoing_player.season_id is distinct from new.season_id
        or incoming_player.season_id is distinct from new.season_id
        or outgoing_player.team_registration_id is distinct from substitution.team_registration_id
        or incoming_player.team_registration_id is distinct from substitution.team_registration_id
      )
  ) or exists (
    select 1
    from public.match_injuries injury
    join public.player_season_registrations player_registration
      on player_registration.id = injury.player_registration_id
    where injury.fixture_id = new.id
      and (
        (
          injury.team_registration_id is distinct from new.home_team_registration_id
          and injury.team_registration_id is distinct from new.away_team_registration_id
        )
        or player_registration.season_id is distinct from new.season_id
        or player_registration.team_registration_id is distinct from injury.team_registration_id
      )
  ) or exists (
    select 1
    from public.player_suspensions suspension
    where suspension.source_fixture_id = new.id
      and (
        suspension.season_id is distinct from new.season_id
        or (
          suspension.team_registration_id is distinct from new.home_team_registration_id
          and suspension.team_registration_id is distinct from new.away_team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'fixtures_absence_data_consistency_check',
      message = 'Fixture season or participants cannot invalidate existing substitutions, injuries, or suspensions.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_fixture_absence_data()
from public, anon, authenticated;

create or replace function app_private.enforce_player_registration_absence_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.match_substitutions substitution
    join public.fixtures fixture
      on fixture.id = substitution.fixture_id
    where (
        substitution.player_out_registration_id = new.id
        or substitution.player_in_registration_id = new.id
      )
      and (
        new.season_id is distinct from fixture.season_id
        or new.team_registration_id is distinct from substitution.team_registration_id
      )
  ) or exists (
    select 1
    from public.match_injuries injury
    join public.fixtures fixture
      on fixture.id = injury.fixture_id
    where injury.player_registration_id = new.id
      and (
        new.season_id is distinct from fixture.season_id
        or new.team_registration_id is distinct from injury.team_registration_id
      )
  ) or exists (
    select 1
    from public.player_suspensions suspension
    where suspension.player_registration_id = new.id
      and (
        new.season_id is distinct from suspension.season_id
        or new.team_registration_id is distinct from suspension.team_registration_id
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'player_registrations_absence_data_consistency_check',
      message = 'A player registration cannot be changed in a way that invalidates substitutions, injuries, or suspensions.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_player_registration_absence_data()
from public, anon, authenticated;

drop trigger if exists enforce_match_substitution_integrity
on public.match_substitutions;

create trigger enforce_match_substitution_integrity
  before insert or update of fixture_id, team_registration_id, player_out_registration_id, player_in_registration_id
  on public.match_substitutions
  for each row
  execute function app_private.enforce_match_substitution_integrity();

drop trigger if exists enforce_match_injury_integrity
on public.match_injuries;

create trigger enforce_match_injury_integrity
  before insert or update of fixture_id, player_registration_id, team_registration_id
  on public.match_injuries
  for each row
  execute function app_private.enforce_match_injury_integrity();

drop trigger if exists enforce_player_suspension_integrity
on public.player_suspensions;

create trigger enforce_player_suspension_integrity
  before insert or update of player_registration_id, team_registration_id, season_id, source_fixture_id
  on public.player_suspensions
  for each row
  execute function app_private.enforce_player_suspension_integrity();

drop trigger if exists enforce_fixture_absence_data
on public.fixtures;

create trigger enforce_fixture_absence_data
  before update of season_id, home_team_registration_id, away_team_registration_id
  on public.fixtures
  for each row
  execute function app_private.enforce_fixture_absence_data();

drop trigger if exists enforce_player_registration_absence_data
on public.player_season_registrations;

create trigger enforce_player_registration_absence_data
  before update of season_id, team_registration_id
  on public.player_season_registrations
  for each row
  execute function app_private.enforce_player_registration_absence_data();

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    'USER'
  )
  on conflict (id) do nothing;

  return new;
end
$function$;

revoke all on function app_private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.app_users enable row level security;
alter table public.app_managers enable row level security;
alter table public.app_admins enable row level security;
alter table public.leagues enable row level security;
alter table public.seasons enable row level security;
alter table public.teams enable row level security;
alter table public.team_registrations enable row level security;
alter table public.players enable row level security;
alter table public.player_season_registrations enable row level security;
alter table public.fixtures enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_players enable row level security;
alter table public.lineup_set_piece_takers enable row level security;
alter table public.team_match_stats enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.match_events enable row level security;
alter table public.match_substitutions enable row level security;
alter table public.match_injuries enable row level security;
alter table public.player_suspensions enable row level security;
alter table public.standings enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.manager_messages enable row level security;
alter table public.season_groups enable row level security;
alter table public.season_group_teams enable row level security;
alter table public.user_favorite_teams enable row level security;

grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.leagues, public.seasons, public.fixtures, public.standings, public.player_season_stats, public.season_groups, public.season_group_teams to anon, authenticated;
grant select on public.profiles to authenticated;
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

drop policy if exists "match_injuries_service_only" on public.match_injuries;
create policy "match_injuries_service_only"
on public.match_injuries for all
using (false)
with check (false);

drop policy if exists "player_suspensions_service_only" on public.player_suspensions;
create policy "player_suspensions_service_only"
on public.player_suspensions for all
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

drop policy if exists "user_favorite_teams_service_only" on public.user_favorite_teams;
create policy "user_favorite_teams_service_only"
on public.user_favorite_teams for all
using (false)
with check (false);
