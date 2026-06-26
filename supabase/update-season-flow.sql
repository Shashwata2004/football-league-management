-- Run this in Supabase SQL Editor to update an existing project for the new admin league/season flow.

alter table public.leagues add column if not exists short_name text;
alter table public.leagues add column if not exists logo_url text;
alter table public.leagues add column if not exists organizer_name text;

alter table public.seasons add column if not exists season_year integer;
alter table public.seasons add column if not exists registration_start_date date;
alter table public.seasons add column if not exists registration_deadline date;
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

update public.seasons
set
  group_count = 2,
  teams_per_group = 4,
  qualifiers_per_group = 2,
  best_third_place_teams = 0,
  total_knockout_teams = 4
where format = 'GROUP_STAGE_KNOCKOUT'
  and (
    group_count is null
    or teams_per_group is null
    or qualifiers_per_group is null
    or best_third_place_teams is null
    or total_knockout_teams is null
    or group_count <= 0
    or teams_per_group <= 0
    or qualifiers_per_group <= 0
    or best_third_place_teams < 0
    or group_count * qualifiers_per_group + best_third_place_teams <> total_knockout_teams
    or total_knockout_teams not in (4, 8, 16, 32, 64)
  );

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

notify pgrst, 'reload schema';
