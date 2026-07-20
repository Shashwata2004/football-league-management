begin;

lock table public.fixtures in share row exclusive mode;
lock table public.team_registrations in share row exclusive mode;
lock table public.lineups in share row exclusive mode;

do $audit$
declare
  null_seasons integer;
  fixture_season_mismatches integer;
  team_season_mismatches integer;
begin
  select count(*)
  into null_seasons
  from public.lineups
  where season_id is null;

  select count(*)
  into fixture_season_mismatches
  from public.lineups lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.season_id is distinct from fixture.season_id;

  select count(*)
  into team_season_mismatches
  from public.lineups lineup
  join public.team_registrations team_registration
    on team_registration.id = lineup.team_registration_id
  where lineup.season_id is distinct from team_registration.season_id;

  if null_seasons > 0
    or fixture_season_mismatches > 0
    or team_season_mismatches > 0 then
    raise exception using
      message = 'Cannot enforce lineup season consistency because existing data is invalid.',
      detail = format(
        'null_seasons=%s, fixture_season_mismatches=%s, team_season_mismatches=%s',
        null_seasons,
        fixture_season_mismatches,
        team_season_mismatches
      );
  end if;
end
$audit$;

do $parent_keys$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fixtures'::regclass
      and conname = 'fixtures_id_season_id_key'
  ) then
    alter table public.fixtures
      add constraint fixtures_id_season_id_key
      unique (id, season_id);
  end if;

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
$parent_keys$;

alter table public.lineups
  alter column season_id set not null;

do $foreign_keys$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.lineups'::regclass
      and conname = 'lineups_fixture_season_fkey'
  ) then
    alter table public.lineups
      add constraint lineups_fixture_season_fkey
      foreign key (fixture_id, season_id)
      references public.fixtures(id, season_id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.lineups'::regclass
      and conname = 'lineups_team_season_fkey'
  ) then
    alter table public.lineups
      add constraint lineups_team_season_fkey
      foreign key (team_registration_id, season_id)
      references public.team_registrations(id, season_id)
      on delete cascade
      not valid;
  end if;
end
$foreign_keys$;

alter table public.lineups
  validate constraint lineups_fixture_season_fkey;

alter table public.lineups
  validate constraint lineups_team_season_fkey;

-- Keep one unambiguous relationship per parent table for PostgREST embeds.
-- The composite keys preserve the same cascading-delete behavior while also
-- guaranteeing that the lineup, fixture, and registered team share a season.
alter table public.lineups
  drop constraint if exists lineups_fixture_id_fkey,
  drop constraint if exists lineups_team_registration_id_fkey;

commit;

notify pgrst, 'reload schema';
