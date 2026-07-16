begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.fixtures in share row exclusive mode;
lock table public.lineups in share row exclusive mode;

do $audit$
declare
  invalid_lineup_scope integer;
begin
  select count(*)
  into invalid_lineup_scope
  from public.lineups lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.season_id is distinct from fixture.season_id
    or (
      lineup.team_registration_id is distinct from fixture.home_team_registration_id
      and lineup.team_registration_id is distinct from fixture.away_team_registration_id
    );

  if invalid_lineup_scope > 0 then
    raise exception using
      message = 'Cannot remove lineup side because existing lineup scope is invalid.',
      detail = format('invalid_lineup_scope=%s', invalid_lineup_scope);
  end if;
end
$audit$;

drop trigger if exists enforce_lineup_fixture_side
on public.lineups;

drop trigger if exists enforce_lineup_fixture_team
on public.lineups;

drop trigger if exists protect_season_lineup_format
on public.seasons;

alter table public.lineups
  drop constraint if exists lineups_fixture_id_side_key;

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
      constraint = 'lineups_fixture_id_fkey',
      message = 'Lineup fixture does not exist.';
  end if;

  if new.season_id is distinct from fixture_season_id
    or (
      new.team_registration_id is distinct from fixture_home_team_id
      and new.team_registration_id is distinct from fixture_away_team_id
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'lineups_fixture_team_check',
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
      constraint = 'fixtures_lineup_scope_check',
      message = 'Fixture participants or season cannot invalidate submitted lineups.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_lineup_fixture_team()
from public, anon, authenticated;

revoke all on function app_private.protect_fixture_lineup_scope()
from public, anon, authenticated;

drop function if exists app_private.enforce_lineup_fixture_side();
drop function if exists app_private.protect_season_lineup_format();

alter table public.lineups
  drop column if exists side;

create trigger enforce_lineup_fixture_team
before insert or update of
  fixture_id,
  team_registration_id,
  season_id
on public.lineups
for each row
execute function app_private.enforce_lineup_fixture_team();

commit;

notify pgrst, 'reload schema';
