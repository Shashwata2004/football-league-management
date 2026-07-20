begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.seasons in share row exclusive mode;
lock table public.fixtures in share row exclusive mode;
lock table public.lineups in share row exclusive mode;

do $audit$
declare
  invalid_lineup_scope integer;
  invalid_league_sides integer;
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

  select count(*)
  into invalid_league_sides
  from public.lineups lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  join public.seasons season on season.id = fixture.season_id
  where season.format::text <> 'GROUP_STAGE_KNOCKOUT'
    and (
      lineup.side is null
      or lineup.team_registration_id is distinct from case lineup.side
        when 'HOME' then fixture.home_team_registration_id
        when 'AWAY' then fixture.away_team_registration_id
      end
    );

  if invalid_lineup_scope > 0 or invalid_league_sides > 0 then
    raise exception using
      message = 'Cannot make neutral lineup sides null because existing lineup data is invalid.',
      detail = format(
        'invalid_lineup_scope=%s, invalid_league_sides=%s',
        invalid_lineup_scope,
        invalid_league_sides
      );
  end if;
end
$audit$;

alter table public.lineups
  alter column side drop not null;

create or replace function app_private.enforce_lineup_fixture_side()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  fixture_season_id uuid;
  fixture_format text;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
  expected_team_id uuid;
begin
  select
    fixture.season_id,
    season.format::text,
    fixture.home_team_registration_id,
    fixture.away_team_registration_id,
    case new.side
      when 'HOME' then fixture.home_team_registration_id
      when 'AWAY' then fixture.away_team_registration_id
    end
  into
    fixture_season_id,
    fixture_format,
    fixture_home_team_id,
    fixture_away_team_id,
    expected_team_id
  from public.fixtures fixture
  join public.seasons season on season.id = fixture.season_id
  where fixture.id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup fixture does not exist.';
  end if;

  if new.season_id is distinct from fixture_season_id
    or (
      new.team_registration_id is distinct from fixture_home_team_id
      and new.team_registration_id is distinct from fixture_away_team_id
    )
    or (
      fixture_format = 'GROUP_STAGE_KNOCKOUT'
      and new.side is not null
    )
    or (
      fixture_format <> 'GROUP_STAGE_KNOCKOUT'
      and (
        new.side is null
        or expected_team_id is null
        or new.team_registration_id is distinct from expected_team_id
      )
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'lineups_fixture_format_side_check',
      message = 'Lineup team and side must match the season format and fixture assignment.';
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
    join public.seasons season on season.id = new.season_id
    where lineup.fixture_id = old.id
      and (
        lineup.season_id is distinct from new.season_id
        or (
          lineup.team_registration_id is distinct from new.home_team_registration_id
          and lineup.team_registration_id is distinct from new.away_team_registration_id
        )
        or (
          season.format::text = 'GROUP_STAGE_KNOCKOUT'
          and lineup.side is not null
        )
        or (
          season.format::text <> 'GROUP_STAGE_KNOCKOUT'
          and lineup.team_registration_id is distinct from case lineup.side
            when 'HOME' then new.home_team_registration_id
            when 'AWAY' then new.away_team_registration_id
          end
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

create or replace function app_private.protect_season_lineup_format()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.format is distinct from old.format
    and exists (
      select 1
      from public.lineups lineup
      where lineup.season_id = old.id
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'seasons_lineup_format_check',
      message = 'Season format cannot change after lineups have been created.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_lineup_fixture_side()
from public, anon, authenticated;

revoke all on function app_private.protect_fixture_lineup_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_season_lineup_format()
from public, anon, authenticated;

drop trigger if exists protect_season_lineup_format
on public.seasons;

create trigger protect_season_lineup_format
before update of format
on public.seasons
for each row
execute function app_private.protect_season_lineup_format();

update public.lineups lineup
set side = null
from public.fixtures fixture
join public.seasons season on season.id = fixture.season_id
where lineup.fixture_id = fixture.id
  and season.format::text = 'GROUP_STAGE_KNOCKOUT'
  and lineup.side is not null;

commit;

notify pgrst, 'reload schema';
