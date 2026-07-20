begin;

lock table public.team_registrations in share row exclusive mode;
lock table public.fixtures in share row exclusive mode;

do $audit$
declare
  orphan_home_teams integer;
  orphan_away_teams integer;
  home_season_mismatches integer;
  away_season_mismatches integer;
begin
  select count(*)
  into orphan_home_teams
  from public.fixtures fixture
  left join public.team_registrations team_registration
    on team_registration.id = fixture.home_team_registration_id
  where fixture.home_team_registration_id is not null
    and team_registration.id is null;

  select count(*)
  into orphan_away_teams
  from public.fixtures fixture
  left join public.team_registrations team_registration
    on team_registration.id = fixture.away_team_registration_id
  where fixture.away_team_registration_id is not null
    and team_registration.id is null;

  select count(*)
  into home_season_mismatches
  from public.fixtures fixture
  join public.team_registrations team_registration
    on team_registration.id = fixture.home_team_registration_id
  where fixture.season_id is distinct from team_registration.season_id;

  select count(*)
  into away_season_mismatches
  from public.fixtures fixture
  join public.team_registrations team_registration
    on team_registration.id = fixture.away_team_registration_id
  where fixture.season_id is distinct from team_registration.season_id;

  if orphan_home_teams > 0
    or orphan_away_teams > 0
    or home_season_mismatches > 0
    or away_season_mismatches > 0 then
    raise exception using
      message = 'Cannot enforce fixture team season consistency because existing data is invalid.',
      detail = format(
        'orphan_home_teams=%s, orphan_away_teams=%s, home_season_mismatches=%s, away_season_mismatches=%s',
        orphan_home_teams,
        orphan_away_teams,
        home_season_mismatches,
        away_season_mismatches
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
  home_definition text;
  away_definition text;
begin
  select pg_get_constraintdef(oid)
  into home_definition
  from pg_constraint
  where conrelid = 'public.fixtures'::regclass
    and conname = 'fixtures_home_team_registration_id_fkey';

  if home_definition is not null
    and (
      position(
        'FOREIGN KEY (home_team_registration_id, season_id)'
        in home_definition
      ) = 0
      or position(
        'REFERENCES team_registrations(id, season_id)'
        in home_definition
      ) = 0
    ) then
    alter table public.fixtures
      drop constraint fixtures_home_team_registration_id_fkey;
  end if;

  select pg_get_constraintdef(oid)
  into away_definition
  from pg_constraint
  where conrelid = 'public.fixtures'::regclass
    and conname = 'fixtures_away_team_registration_id_fkey';

  if away_definition is not null
    and (
      position(
        'FOREIGN KEY (away_team_registration_id, season_id)'
        in away_definition
      ) = 0
      or position(
        'REFERENCES team_registrations(id, season_id)'
        in away_definition
      ) = 0
    ) then
    alter table public.fixtures
      drop constraint fixtures_away_team_registration_id_fkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fixtures'::regclass
      and conname = 'fixtures_home_team_registration_id_fkey'
  ) then
    alter table public.fixtures
      add constraint fixtures_home_team_registration_id_fkey
      foreign key (home_team_registration_id, season_id)
      references public.team_registrations(id, season_id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fixtures'::regclass
      and conname = 'fixtures_away_team_registration_id_fkey'
  ) then
    alter table public.fixtures
      add constraint fixtures_away_team_registration_id_fkey
      foreign key (away_team_registration_id, season_id)
      references public.team_registrations(id, season_id)
      not valid;
  end if;
end
$replace_foreign_keys$;

alter table public.fixtures
  validate constraint fixtures_home_team_registration_id_fkey;

alter table public.fixtures
  validate constraint fixtures_away_team_registration_id_fkey;

commit;

notify pgrst, 'reload schema';
