begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.fixtures in share row exclusive mode;
lock table public.team_registrations in share row exclusive mode;
lock table public.lineups in share row exclusive mode;

do $audit$
declare
  null_managers integer;
  invalid_manager_scope integer;
  invalid_fixture_side integer;
begin
  select count(*)
  into null_managers
  from public.lineups
  where manager_id is null;

  select count(*)
  into invalid_manager_scope
  from public.lineups lineup
  join public.team_registrations team_registration
    on team_registration.id = lineup.team_registration_id
  where lineup.season_id is distinct from team_registration.season_id
    or lineup.manager_id is distinct from team_registration.manager_id;

  select count(*)
  into invalid_fixture_side
  from public.lineups lineup
  join public.fixtures fixture
    on fixture.id = lineup.fixture_id
  where lineup.season_id is distinct from fixture.season_id
    or lineup.team_registration_id is distinct from case lineup.side
      when 'HOME' then fixture.home_team_registration_id
      when 'AWAY' then fixture.away_team_registration_id
    end;

  if null_managers > 0
    or invalid_manager_scope > 0
    or invalid_fixture_side > 0 then
    raise exception using
      message = 'Cannot enforce lineup fixture scope integrity because existing data is invalid.',
      detail = format(
        'null_managers=%s, invalid_manager_scope=%s, invalid_fixture_side=%s',
        null_managers,
        invalid_manager_scope,
        invalid_fixture_side
      );
  end if;
end
$audit$;

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_registrations'::regclass
      and conname = 'team_registrations_id_season_manager_key'
  ) then
    alter table public.team_registrations
      add constraint team_registrations_id_season_manager_key
      unique (id, season_id, manager_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.lineups'::regclass
      and conname = 'lineups_team_season_manager_fkey'
  ) then
    alter table public.lineups
      add constraint lineups_team_season_manager_fkey
      foreign key (team_registration_id, season_id, manager_id)
      references public.team_registrations(id, season_id, manager_id)
      on delete cascade
      not valid;
  end if;
end
$constraints$;

alter table public.lineups
  alter column manager_id set not null;

alter table public.lineups
  validate constraint lineups_team_season_manager_fkey;

-- Keep one unambiguous PostgREST relationship to team_registrations. The
-- replacement composite FK preserves cascading deletion and additionally
-- guarantees that the submitting manager owns the registered team.
alter table public.lineups
  drop constraint if exists lineups_team_season_fkey;

create index if not exists lineups_team_season_manager_idx
  on public.lineups(team_registration_id, season_id, manager_id);

create schema if not exists app_private;

create or replace function app_private.enforce_lineup_fixture_side()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  fixture_season_id uuid;
  expected_team_id uuid;
begin
  select
    fixture.season_id,
    case new.side
      when 'HOME' then fixture.home_team_registration_id
      when 'AWAY' then fixture.away_team_registration_id
    end
  into
    fixture_season_id,
    expected_team_id
  from public.fixtures fixture
  where fixture.id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup fixture does not exist.';
  end if;

  if new.season_id is distinct from fixture_season_id
    or expected_team_id is null
    or new.team_registration_id is distinct from expected_team_id then
    raise exception using
      errcode = '23514',
      message = 'Lineup team and side must match the fixture home or away assignment.';
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
        or lineup.team_registration_id is distinct from case lineup.side
          when 'HOME' then new.home_team_registration_id
          when 'AWAY' then new.away_team_registration_id
        end
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Fixture participants or season cannot invalidate submitted lineups.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_lineup_fixture_side()
from public, anon, authenticated;

revoke all on function app_private.protect_fixture_lineup_scope()
from public, anon, authenticated;

drop trigger if exists enforce_lineup_fixture_side
on public.lineups;

create trigger enforce_lineup_fixture_side
before insert or update of
  fixture_id,
  team_registration_id,
  season_id,
  side
on public.lineups
for each row
execute function app_private.enforce_lineup_fixture_side();

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

commit;

notify pgrst, 'reload schema';
