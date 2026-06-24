-- Custom Football League Management System schema
-- Run in Supabase SQL Editor. Supabase CLI is optional.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('USER', 'MANAGER', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.season_format as enum ('SINGLE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'GROUP_STAGE_KNOCKOUT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fixture_status as enum (
    'SCHEDULED',
    'LINEUPS_SUBMITTED',
    'LINEUPS_CONFIRMED',
    'SIMULATED_PENDING_ADMIN_CONFIRMATION',
    'FINAL',
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
  create type public.id_type as enum ('NID', 'BIRTH_ID');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.match_event_type as enum ('GOAL', 'ASSIST', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION');
exception when duplicate_object then null; end $$;

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
  country text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null,
  format public.season_format not null,
  start_date date,
  end_date date,
  group_count integer,
  qualifiers_per_group integer,
  champion_team_registration_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_group_knockout_config check (
    format <> 'GROUP_STAGE_KNOCKOUT'
    or (
      group_count is not null
      and qualifiers_per_group is not null
      and group_count > 0
      and qualifiers_per_group > 0
      and group_count * qualifiers_per_group in (4, 8, 16, 32, 64)
    )
  )
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id),
  name text not null,
  short_name text not null,
  city text,
  primary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_registrations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  manager_id uuid not null references public.profiles(id),
  status public.request_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (season_id, team_id)
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  date_of_birth date not null,
  nationality text,
  id_type public.id_type not null,
  id_number_hash text not null unique,
  id_number_last4 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  position public.player_position not null,
  shirt_number integer,
  status public.request_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  constraint shirt_number_range check (shirt_number is null or shirt_number between 1 and 99),
  unique (season_id, player_id),
  unique (team_registration_id, shirt_number)
);

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

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  round_no integer not null,
  stage text not null default 'LEAGUE',
  group_name text,
  home_team_registration_id uuid not null references public.team_registrations(id),
  away_team_registration_id uuid not null references public.team_registrations(id),
  kickoff_at timestamptz,
  venue text,
  status public.fixture_status not null default 'SCHEDULED',
  home_score integer,
  away_score integer,
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fixture_distinct_teams check (home_team_registration_id <> away_team_registration_id),
  constraint fixture_non_negative_scores check (
    (home_score is null or home_score >= 0) and (away_score is null or away_score >= 0)
  )
);

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  side public.venue_side not null,
  formation text not null,
  status public.lineup_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (fixture_id, team_registration_id),
  unique (fixture_id, side)
);

create table if not exists public.lineup_players (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id) on delete cascade,
  is_starter boolean not null,
  position public.player_position not null,
  created_at timestamptz not null default now(),
  unique (lineup_id, player_registration_id)
);

create table if not exists public.team_match_stats (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id),
  possession integer not null check (possession between 0 and 100),
  shots integer not null check (shots >= 0),
  shots_on_target integer not null check (shots_on_target between 0 and shots),
  big_chances integer not null check (big_chances between 0 and shots),
  big_chances_missed integer not null check (big_chances_missed between 0 and big_chances),
  passes integer not null check (passes >= 0),
  accurate_passes integer not null check (accurate_passes between 0 and passes),
  fouls integer not null check (fouls >= 0),
  yellow_cards integer not null check (yellow_cards >= 0),
  red_cards integer not null check (red_cards between 0 and 3),
  corners integer not null check (corners >= 0),
  created_at timestamptz not null default now(),
  unique (fixture_id, team_registration_id)
);

create table if not exists public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_registration_id uuid not null references public.player_season_registrations(id),
  minutes integer not null check (minutes between 0 and 130),
  goals integer not null check (goals >= 0),
  assists integer not null check (assists >= 0),
  shots integer not null check (shots >= 0),
  passes integer not null check (passes >= 0),
  accurate_passes integer not null check (accurate_passes between 0 and passes),
  tackles integer not null check (tackles >= 0),
  saves integer not null check (saves >= 0),
  dribbles_attempted integer not null check (dribbles_attempted >= 0),
  successful_dribbles integer not null check (successful_dribbles between 0 and dribbles_attempted),
  yellow_cards integer not null check (yellow_cards between 0 and 2),
  red_cards integer not null check (red_cards between 0 and 1),
  rating numeric(3,1) not null check (rating between 5.5 and 9.5),
  created_at timestamptz not null default now(),
  unique (fixture_id, player_registration_id)
);

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
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  average_rating numeric(4,2),
  updated_at timestamptz not null default now(),
  unique (season_id, player_registration_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.seasons
  drop constraint if exists seasons_champion_team_fk;

alter table public.seasons
  add constraint seasons_champion_team_fk
  foreign key (champion_team_registration_id)
  references public.team_registrations(id);

create index if not exists idx_seasons_league on public.seasons(league_id);
create index if not exists idx_team_registrations_season_status on public.team_registrations(season_id, status);
create index if not exists idx_player_regs_team_status on public.player_season_registrations(team_registration_id, status);
create index if not exists idx_fixtures_season_round on public.fixtures(season_id, round_no);
create index if not exists idx_lineups_fixture on public.lineups(fixture_id);
create index if not exists idx_standings_season_sort on public.standings(season_id, points desc, goal_difference desc, goals_for desc, fair_play_score asc);
create index if not exists idx_player_stats_season_goals on public.player_season_stats(season_id, goals desc);

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

grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.leagues, public.seasons, public.fixtures, public.standings, public.player_season_stats to anon, authenticated;
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
