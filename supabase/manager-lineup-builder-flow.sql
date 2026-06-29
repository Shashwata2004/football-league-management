-- Manager lineup builder flow.
-- Safe to re-run. Adds previous-lineup memory, tactical slots, and manager-visible ability support.

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

alter table public.lineups
  add column if not exists season_id uuid references public.seasons(id) on delete cascade,
  add column if not exists manager_id uuid references public.profiles(id) on delete set null,
  add column if not exists playing_style text not null default 'BALANCED',
  add column if not exists captain_id uuid references public.player_season_registrations(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists updated_at timestamptz not null default now();

update public.lineups l
set season_id = f.season_id
from public.fixtures f
where l.fixture_id = f.id
  and l.season_id is null;

alter table public.lineup_players
  add column if not exists slot_key text,
  add column if not exists display_role text,
  add column if not exists player_natural_position public.football_position,
  add column if not exists is_substitute boolean not null default false,
  add column if not exists display_order integer;

update public.lineup_players
set is_substitute = not is_starter
where is_substitute = false
  and is_starter = false;

alter table public.player_abilities
  add column if not exists visible_to_manager boolean not null default true;

update public.player_abilities
set visible_to_manager = true;

create index if not exists idx_manager_team_preferences_lookup
  on public.manager_team_preferences(manager_id, team_registration_id, season_id);

create index if not exists idx_lineups_team_season_submitted
  on public.lineups(team_registration_id, season_id, submitted_at desc nulls last, created_at desc);

create index if not exists idx_lineup_players_slot
  on public.lineup_players(lineup_id, slot_key, display_order);

alter table public.manager_team_preferences enable row level security;

drop policy if exists "manager_team_preferences_service_only" on public.manager_team_preferences;
create policy "manager_team_preferences_service_only"
on public.manager_team_preferences for all
using (false)
with check (false);

notify pgrst, 'reload schema';
