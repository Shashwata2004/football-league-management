-- Team/player admin dashboard flow schema.
-- Safe to re-run. Does not insert dummy data.

do $$ begin
  create type public.preferred_foot as enum ('LEFT', 'RIGHT', 'BOTH', 'UNKNOWN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.player_lifecycle_status as enum (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'REMOVED',
    'SUSPENDED'
  );
exception when duplicate_object then null; end $$;

alter table public.teams
  add column if not exists logo_url text;

alter table public.team_registrations
  add column if not exists removed_by uuid references public.profiles(id),
  add column if not exists removed_at timestamptz,
  add column if not exists removal_reason text;

alter table public.players
  add column if not exists avatar_url text;

alter table public.player_season_registrations
  add column if not exists preferred_foot public.preferred_foot not null default 'UNKNOWN',
  add column if not exists player_status public.player_lifecycle_status not null default 'PENDING',
  add column if not exists removed_by uuid references public.profiles(id),
  add column if not exists removed_at timestamptz,
  add column if not exists removal_reason text,
  add column if not exists suspended_by uuid references public.profiles(id),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

update public.player_season_registrations
set player_status = case
  when status = 'APPROVED' then 'APPROVED'::public.player_lifecycle_status
  when status = 'REJECTED' then 'REJECTED'::public.player_lifecycle_status
  else 'PENDING'::public.player_lifecycle_status
end
where player_status = 'PENDING';

alter table public.manager_messages
  add column if not exists player_registration_id uuid references public.player_season_registrations(id) on delete set null,
  add column if not exists fixture_id uuid references public.fixtures(id) on delete set null;

alter table public.player_season_stats
  add column if not exists starts integer not null default 0,
  add column if not exists minutes_played integer not null default 0,
  add column if not exists shots integer not null default 0,
  add column if not exists shots_on_target integer not null default 0,
  add column if not exists chances_created integer not null default 0,
  add column if not exists big_chances_created integer not null default 0,
  add column if not exists total_passes integer not null default 0,
  add column if not exists accurate_passes integer not null default 0,
  add column if not exists dribbles_attempted integer not null default 0,
  add column if not exists successful_dribbles integer not null default 0,
  add column if not exists dispossessed integer not null default 0,
  add column if not exists tackles integer not null default 0,
  add column if not exists interceptions integer not null default 0,
  add column if not exists best_match_rating numeric(3,1),
  add column if not exists lowest_match_rating numeric(3,1),
  add column if not exists player_of_match_count integer not null default 0;

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
    and dispossessed >= 0
    and tackles >= 0
    and interceptions >= 0
    and yellow_cards >= 0
    and red_cards >= 0
    and player_of_match_count >= 0
  );

create index if not exists idx_teams_logo_url on public.teams(logo_url);
create index if not exists idx_team_registrations_removed on public.team_registrations(season_id, removed_at);
create index if not exists idx_player_regs_lifecycle on public.player_season_registrations(team_registration_id, player_status);
create index if not exists idx_manager_messages_player on public.manager_messages(player_registration_id);
create index if not exists idx_manager_messages_fixture on public.manager_messages(fixture_id);

notify pgrst, 'reload schema';
