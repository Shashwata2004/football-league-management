begin;

lock table public.seasons in share row exclusive mode;
lock table public.team_registrations in share row exclusive mode;
lock table public.standings in share row exclusive mode;

do $audit$
declare
  orphan_standings_teams integer;
  standings_season_mismatches integer;
  orphan_champions integer;
  champion_season_mismatches integer;
  invalid_standings_totals integer;
begin
  select count(*)
  into orphan_standings_teams
  from public.standings standing
  left join public.team_registrations team_registration
    on team_registration.id = standing.team_registration_id
  where team_registration.id is null;

  select count(*)
  into standings_season_mismatches
  from public.standings standing
  join public.team_registrations team_registration
    on team_registration.id = standing.team_registration_id
  where standing.season_id is distinct from team_registration.season_id;

  select count(*)
  into orphan_champions
  from public.seasons season
  left join public.team_registrations champion
    on champion.id = season.champion_team_registration_id
  where season.champion_team_registration_id is not null
    and champion.id is null;

  select count(*)
  into champion_season_mismatches
  from public.seasons season
  join public.team_registrations champion
    on champion.id = season.champion_team_registration_id
  where champion.season_id is distinct from season.id;

  select count(*)
  into invalid_standings_totals
  from public.standings
  where played < 0
    or won < 0
    or drawn < 0
    or lost < 0
    or goals_for < 0
    or goals_against < 0
    or points < 0
    or fair_play_score < 0
    or played <> won + drawn + lost
    or goal_difference <> goals_for - goals_against
    or points <> won * 3 + drawn
    or (admin_draw_rank is not null and admin_draw_rank <= 0);

  if orphan_standings_teams > 0
    or standings_season_mismatches > 0
    or orphan_champions > 0
    or champion_season_mismatches > 0
    or invalid_standings_totals > 0 then
    raise exception using
      message = 'Cannot enforce standings and champion integrity because existing data is invalid.',
      detail = format(
        'orphan_standings_teams=%s, standings_season_mismatches=%s, orphan_champions=%s, champion_season_mismatches=%s, invalid_standings_totals=%s',
        orphan_standings_teams,
        standings_season_mismatches,
        orphan_champions,
        champion_season_mismatches,
        invalid_standings_totals
      );
  end if;
end
$audit$;

do $parent_key$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_registrations'::regclass
      and conname = 'team_registrations_id_season_id_key'
  ) then
    alter table public.team_registrations
      add constraint team_registrations_id_season_id_key
      unique (id, season_id);
  end if;
end
$parent_key$;

do $replace_foreign_keys$
declare
  standings_definition text;
  champion_definition text;
begin
  select pg_get_constraintdef(oid)
  into standings_definition
  from pg_constraint
  where conrelid = 'public.standings'::regclass
    and conname = 'standings_team_registration_id_fkey';

  if standings_definition is not null
    and (
      position(
        'FOREIGN KEY (team_registration_id, season_id)'
        in standings_definition
      ) = 0
      or position(
        'REFERENCES team_registrations(id, season_id)'
        in standings_definition
      ) = 0
      or position('ON DELETE CASCADE' in standings_definition) = 0
    ) then
    alter table public.standings
      drop constraint standings_team_registration_id_fkey;
  end if;

  select pg_get_constraintdef(oid)
  into champion_definition
  from pg_constraint
  where conrelid = 'public.seasons'::regclass
    and conname = 'seasons_champion_team_fk';

  if champion_definition is not null
    and (
      position(
        'FOREIGN KEY (champion_team_registration_id, id)'
        in champion_definition
      ) = 0
      or position(
        'REFERENCES team_registrations(id, season_id)'
        in champion_definition
      ) = 0
    ) then
    alter table public.seasons
      drop constraint seasons_champion_team_fk;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.standings'::regclass
      and conname = 'standings_team_registration_id_fkey'
  ) then
    alter table public.standings
      add constraint standings_team_registration_id_fkey
      foreign key (team_registration_id, season_id)
      references public.team_registrations(id, season_id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.seasons'::regclass
      and conname = 'seasons_champion_team_fk'
  ) then
    alter table public.seasons
      add constraint seasons_champion_team_fk
      foreign key (champion_team_registration_id, id)
      references public.team_registrations(id, season_id)
      not valid;
  end if;
end
$replace_foreign_keys$;

do $add_checks$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.standings'::regclass
      and conname = 'standings_non_negative_totals_check'
  ) then
    alter table public.standings
      add constraint standings_non_negative_totals_check
      check (
        played >= 0
        and won >= 0
        and drawn >= 0
        and lost >= 0
        and goals_for >= 0
        and goals_against >= 0
        and points >= 0
        and fair_play_score >= 0
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.standings'::regclass
      and conname = 'standings_record_consistency_check'
  ) then
    alter table public.standings
      add constraint standings_record_consistency_check
      check (
        played = won + drawn + lost
        and goal_difference = goals_for - goals_against
        and points = won * 3 + drawn
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.standings'::regclass
      and conname = 'standings_admin_draw_rank_check'
  ) then
    alter table public.standings
      add constraint standings_admin_draw_rank_check
      check (admin_draw_rank is null or admin_draw_rank > 0)
      not valid;
  end if;
end
$add_checks$;

alter table public.standings
  validate constraint standings_team_registration_id_fkey;

alter table public.seasons
  validate constraint seasons_champion_team_fk;

alter table public.standings
  validate constraint standings_non_negative_totals_check;

alter table public.standings
  validate constraint standings_record_consistency_check;

alter table public.standings
  validate constraint standings_admin_draw_rank_check;

commit;

notify pgrst, 'reload schema';
