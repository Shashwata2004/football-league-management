-- Admin selected league/season dashboard flow schema.
-- Run after update-season-flow.sql. Safe to re-run.

do $$ begin
  create type public.season_phase as enum (
    'REGISTRATION_OPEN',
    'REGISTRATION_CLOSED',
    'ACTIVE',
    'COMPLETED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.player_ability_rating as enum ('LOW', 'MODERATE', 'HIGH');
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

alter table public.seasons
  add column if not exists phase public.season_phase not null default 'REGISTRATION_OPEN';

alter table public.player_season_registrations
  add column if not exists ability_rating public.player_ability_rating;

create table if not exists public.manager_messages (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  team_registration_id uuid references public.team_registrations(id) on delete set null,
  related_type public.manager_message_type not null,
  message text not null,
  created_by uuid references public.profiles(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.manager_messages
  add column if not exists notification_key text;

create unique index if not exists manager_messages_notification_key_uidx
  on public.manager_messages (notification_key);

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

create index if not exists idx_seasons_phase on public.seasons(phase);
create index if not exists idx_manager_messages_season on public.manager_messages(season_id, created_at desc);
create index if not exists idx_manager_messages_manager_read on public.manager_messages(manager_id, read_at);
create index if not exists idx_season_groups_season on public.season_groups(season_id);
create index if not exists idx_group_teams_group on public.season_group_teams(group_id);

alter table public.manager_messages enable row level security;
alter table public.season_groups enable row level security;
alter table public.season_group_teams enable row level security;

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

notify pgrst, 'reload schema';
