begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.fixtures in share row exclusive mode;
lock table public.player_season_registrations in share row exclusive mode;
lock table public.player_match_stats in share row exclusive mode;
lock table public.match_events in share row exclusive mode;

do $audit$
declare
  missing_required_related_players integer;
  invalid_penalty_saved_relations integer;
begin
  select count(*)
  into missing_required_related_players
  from public.match_events
  where type in ('ASSIST', 'SUBSTITUTION', 'PENALTY_SAVED')
    and related_player_registration_id is null;

  select count(*)
  into invalid_penalty_saved_relations
  from public.match_events event
  join public.player_season_registrations event_player
    on event_player.id = event.player_registration_id
  join public.player_season_registrations related_player
    on related_player.id = event.related_player_registration_id
  where event.type = 'PENALTY_SAVED'
    and related_player.team_registration_id
      is not distinct from event_player.team_registration_id;

  if missing_required_related_players > 0
    or invalid_penalty_saved_relations > 0 then
    raise exception using
      message = 'Cannot enforce match-event related-player integrity because existing data is invalid.',
      detail = format(
        'missing_required_related_players=%s, invalid_penalty_saved_relations=%s',
        missing_required_related_players,
        invalid_penalty_saved_relations
      );
  end if;
end
$audit$;

alter table public.match_events
  drop constraint if exists match_events_required_related_player_check;

alter table public.match_events
  add constraint match_events_required_related_player_check
  check (
    type not in ('ASSIST', 'SUBSTITUTION', 'PENALTY_SAVED')
    or related_player_registration_id is not null
  )
  not valid;

create or replace function app_private.enforce_match_event_participants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
  player_season_id uuid;
  player_team_id uuid;
  related_player_season_id uuid;
  related_player_team_id uuid;
begin
  select season_id, home_team_registration_id, away_team_registration_id
  into fixture_season_id, fixture_home_team_id, fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_events_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  select season_id, team_registration_id
  into player_season_id, player_team_id
  from public.player_season_registrations
  where id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_events_player_registration_id_fkey',
      message = 'The referenced event player registration does not exist.';
  end if;

  if player_season_id is distinct from fixture_season_id
    or (
      player_team_id is distinct from fixture_home_team_id
      and player_team_id is distinct from fixture_away_team_id
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'match_events_fixture_participant_check',
      message = 'A match event player must be a registered participant in the same fixture season.';
  end if;

  if new.type <> 'OWN_GOAL'
    and (
      (new.side = 'HOME' and player_team_id is distinct from fixture_home_team_id)
      or (new.side = 'AWAY' and player_team_id is distinct from fixture_away_team_id)
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'match_events_side_player_check',
      message = 'The event side must match the player team, except for an own goal.';
  end if;

  if new.related_player_registration_id is not null then
    select season_id, team_registration_id
    into related_player_season_id, related_player_team_id
    from public.player_season_registrations
    where id = new.related_player_registration_id;

    if not found then
      raise exception using
        errcode = '23503',
        constraint = 'match_events_related_player_registration_id_fkey',
        message = 'The referenced related player registration does not exist.';
    end if;

    if related_player_season_id is distinct from fixture_season_id
      or (
        related_player_team_id is distinct from fixture_home_team_id
        and related_player_team_id is distinct from fixture_away_team_id
      )
      or (
        new.type = 'PENALTY_SAVED'
        and related_player_team_id is not distinct from player_team_id
      )
      or (
        new.type not in ('OWN_GOAL', 'PENALTY_SAVED')
        and related_player_team_id is distinct from player_team_id
      ) then
      raise exception using
        errcode = '23514',
        constraint = 'match_events_related_fixture_participant_check',
        message = 'The related event player must belong to the correct participating team and fixture season.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function app_private.enforce_fixture_player_match_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.player_match_stats player_stat
    join public.player_season_registrations player_registration
      on player_registration.id = player_stat.player_registration_id
    where player_stat.fixture_id = new.id
      and (
        player_registration.season_id is distinct from new.season_id
        or (
          player_registration.team_registration_id is distinct from new.home_team_registration_id
          and player_registration.team_registration_id is distinct from new.away_team_registration_id
        )
      )
  ) or exists (
    select 1
    from public.match_events event
    join public.player_season_registrations player_registration
      on player_registration.id = event.player_registration_id
    left join public.player_season_registrations related_player
      on related_player.id = event.related_player_registration_id
    where event.fixture_id = new.id
      and (
        player_registration.season_id is distinct from new.season_id
        or (
          player_registration.team_registration_id is distinct from new.home_team_registration_id
          and player_registration.team_registration_id is distinct from new.away_team_registration_id
        )
        or (
          event.type <> 'OWN_GOAL'
          and (
            (event.side = 'HOME' and player_registration.team_registration_id is distinct from new.home_team_registration_id)
            or (event.side = 'AWAY' and player_registration.team_registration_id is distinct from new.away_team_registration_id)
          )
        )
        or (
          event.related_player_registration_id is not null
          and (
            related_player.season_id is distinct from new.season_id
            or (
              related_player.team_registration_id is distinct from new.home_team_registration_id
              and related_player.team_registration_id is distinct from new.away_team_registration_id
            )
            or (
              event.type = 'PENALTY_SAVED'
              and related_player.team_registration_id is not distinct from player_registration.team_registration_id
            )
            or (
              event.type not in ('OWN_GOAL', 'PENALTY_SAVED')
              and related_player.team_registration_id is distinct from player_registration.team_registration_id
            )
          )
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'fixtures_player_match_data_participant_check',
      message = 'Fixture season or participants cannot invalidate existing player match statistics or events.';
  end if;

  return new;
end;
$$;

create or replace function app_private.enforce_player_registration_match_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.player_match_stats player_stat
    join public.fixtures fixture
      on fixture.id = player_stat.fixture_id
    where player_stat.player_registration_id = new.id
      and (
        new.season_id is distinct from fixture.season_id
        or (
          new.team_registration_id is distinct from fixture.home_team_registration_id
          and new.team_registration_id is distinct from fixture.away_team_registration_id
        )
      )
  ) or exists (
    select 1
    from public.match_events event
    join public.fixtures fixture
      on fixture.id = event.fixture_id
    where event.player_registration_id = new.id
      and (
        new.season_id is distinct from fixture.season_id
        or (
          new.team_registration_id is distinct from fixture.home_team_registration_id
          and new.team_registration_id is distinct from fixture.away_team_registration_id
        )
        or (
          event.type <> 'OWN_GOAL'
          and (
            (event.side = 'HOME' and new.team_registration_id is distinct from fixture.home_team_registration_id)
            or (event.side = 'AWAY' and new.team_registration_id is distinct from fixture.away_team_registration_id)
          )
        )
      )
  ) or exists (
    select 1
    from public.match_events event
    join public.fixtures fixture
      on fixture.id = event.fixture_id
    join public.player_season_registrations event_player
      on event_player.id = event.player_registration_id
    where event.related_player_registration_id = new.id
      and (
        new.season_id is distinct from fixture.season_id
        or (
          new.team_registration_id is distinct from fixture.home_team_registration_id
          and new.team_registration_id is distinct from fixture.away_team_registration_id
        )
        or (
          event.type = 'PENALTY_SAVED'
          and new.team_registration_id is not distinct from event_player.team_registration_id
        )
        or (
          event.type not in ('OWN_GOAL', 'PENALTY_SAVED')
          and new.team_registration_id is distinct from event_player.team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'player_registrations_match_data_consistency_check',
      message = 'A player registration cannot be changed in a way that invalidates existing match statistics or events.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_match_event_participants()
from public, anon, authenticated;

revoke all
on function app_private.enforce_fixture_player_match_data()
from public, anon, authenticated;

revoke all
on function app_private.enforce_player_registration_match_data()
from public, anon, authenticated;

alter table public.match_events
  validate constraint match_events_required_related_player_check;

commit;

notify pgrst, 'reload schema';
