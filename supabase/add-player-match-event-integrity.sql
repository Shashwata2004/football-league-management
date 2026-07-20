begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.fixtures in share row exclusive mode;
lock table public.player_season_registrations in share row exclusive mode;
lock table public.player_match_stats in share row exclusive mode;
lock table public.match_events in share row exclusive mode;

do $audit$
declare
  invalid_player_stats integer;
  invalid_event_players integer;
  invalid_related_players integer;
  invalid_event_sides integer;
  invalid_stat_totals integer;
  invalid_event_relations integer;
begin
  select count(*)
  into invalid_player_stats
  from public.player_match_stats player_stat
  join public.fixtures fixture
    on fixture.id = player_stat.fixture_id
  join public.player_season_registrations player_registration
    on player_registration.id = player_stat.player_registration_id
  where player_registration.season_id is distinct from fixture.season_id
    or (
      player_registration.team_registration_id is distinct from fixture.home_team_registration_id
      and player_registration.team_registration_id is distinct from fixture.away_team_registration_id
    );

  select count(*)
  into invalid_event_players
  from public.match_events event
  join public.fixtures fixture
    on fixture.id = event.fixture_id
  join public.player_season_registrations player_registration
    on player_registration.id = event.player_registration_id
  where player_registration.season_id is distinct from fixture.season_id
    or (
      player_registration.team_registration_id is distinct from fixture.home_team_registration_id
      and player_registration.team_registration_id is distinct from fixture.away_team_registration_id
    );

  select count(*)
  into invalid_related_players
  from public.match_events event
  join public.fixtures fixture
    on fixture.id = event.fixture_id
  join public.player_season_registrations related_player
    on related_player.id = event.related_player_registration_id
  where event.related_player_registration_id is not null
    and (
      related_player.season_id is distinct from fixture.season_id
      or (
        related_player.team_registration_id is distinct from fixture.home_team_registration_id
        and related_player.team_registration_id is distinct from fixture.away_team_registration_id
      )
    );

  select count(*)
  into invalid_event_sides
  from public.match_events event
  join public.fixtures fixture
    on fixture.id = event.fixture_id
  join public.player_season_registrations player_registration
    on player_registration.id = event.player_registration_id
  left join public.player_season_registrations related_player
    on related_player.id = event.related_player_registration_id
  where event.type <> 'OWN_GOAL'
    and (
      (
        event.side = 'HOME'
        and player_registration.team_registration_id is distinct from fixture.home_team_registration_id
      )
      or (
        event.side = 'AWAY'
        and player_registration.team_registration_id is distinct from fixture.away_team_registration_id
      )
      or (
        event.related_player_registration_id is not null
        and related_player.team_registration_id is distinct from player_registration.team_registration_id
      )
    );

  select count(*)
  into invalid_stat_totals
  from public.player_match_stats
  where penalty_scored > goals
    or penalty_scored + penalty_missed > shots
    or penalty_saved_for_gk > saves
    or (
      accurate_long_balls is not null
      and accurate_long_balls > accurate_passes
    )
    or (
      clean_sheet
      and coalesce(goals_conceded, 0) <> 0
    );

  select count(*)
  into invalid_event_relations
  from public.match_events
  where related_player_registration_id = player_registration_id;

  if invalid_player_stats > 0
    or invalid_event_players > 0
    or invalid_related_players > 0
    or invalid_event_sides > 0
    or invalid_stat_totals > 0
    or invalid_event_relations > 0 then
    raise exception using
      message = 'Cannot enforce player match and event integrity because existing data is invalid.',
      detail = format(
        'invalid_player_stats=%s, invalid_event_players=%s, invalid_related_players=%s, invalid_event_sides=%s, invalid_stat_totals=%s, invalid_event_relations=%s',
        invalid_player_stats,
        invalid_event_players,
        invalid_related_players,
        invalid_event_sides,
        invalid_stat_totals,
        invalid_event_relations
      );
  end if;
end
$audit$;

alter table public.player_match_stats
  drop constraint if exists player_match_stats_penalty_consistency_check;

alter table public.player_match_stats
  add constraint player_match_stats_penalty_consistency_check
  check (
    penalty_scored <= goals
    and penalty_scored + penalty_missed <= shots
    and penalty_saved_for_gk <= saves
    and (
      accurate_long_balls is null
      or accurate_long_balls <= accurate_passes
    )
    and (
      not clean_sheet
      or coalesce(goals_conceded, 0) = 0
    )
  )
  not valid;

alter table public.match_events
  drop constraint if exists match_events_distinct_players_check;

alter table public.match_events
  add constraint match_events_distinct_players_check
  check (
    related_player_registration_id is null
    or related_player_registration_id <> player_registration_id
  )
  not valid;

create index if not exists idx_player_match_stats_player_registration
  on public.player_match_stats(player_registration_id, fixture_id);

create index if not exists idx_match_events_fixture_minute
  on public.match_events(fixture_id, minute);

create index if not exists idx_match_events_player_registration
  on public.match_events(player_registration_id, fixture_id);

create index if not exists idx_match_events_related_player_registration
  on public.match_events(related_player_registration_id, fixture_id)
  where related_player_registration_id is not null;

create or replace function app_private.enforce_player_match_stat_participant()
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
begin
  select
    season_id,
    home_team_registration_id,
    away_team_registration_id
  into
    fixture_season_id,
    fixture_home_team_id,
    fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'player_match_stats_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  select season_id, team_registration_id
  into player_season_id, player_team_id
  from public.player_season_registrations
  where id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'player_match_stats_player_registration_id_fkey',
      message = 'The referenced player registration does not exist.';
  end if;

  if player_season_id is distinct from fixture_season_id
    or (
      player_team_id is distinct from fixture_home_team_id
      and player_team_id is distinct from fixture_away_team_id
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'player_match_stats_fixture_participant_check',
      message = 'Player match statistics must belong to a registered participant in the same fixture season.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_player_match_stat_participant()
from public, anon, authenticated;

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
  select
    season_id,
    home_team_registration_id,
    away_team_registration_id
  into
    fixture_season_id,
    fixture_home_team_id,
    fixture_away_team_id
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
        new.type <> 'OWN_GOAL'
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

revoke all
on function app_private.enforce_match_event_participants()
from public, anon, authenticated;

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
              event.type <> 'OWN_GOAL'
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

revoke all
on function app_private.enforce_fixture_player_match_data()
from public, anon, authenticated;

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
          event.type <> 'OWN_GOAL'
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
on function app_private.enforce_player_registration_match_data()
from public, anon, authenticated;

drop trigger if exists enforce_player_match_stat_participant
on public.player_match_stats;

create trigger enforce_player_match_stat_participant
  before insert or update of fixture_id, player_registration_id
  on public.player_match_stats
  for each row
  execute function app_private.enforce_player_match_stat_participant();

drop trigger if exists enforce_match_event_participants
on public.match_events;

create trigger enforce_match_event_participants
  before insert or update of fixture_id, side, type, player_registration_id, related_player_registration_id
  on public.match_events
  for each row
  execute function app_private.enforce_match_event_participants();

drop trigger if exists enforce_fixture_player_match_data
on public.fixtures;

create trigger enforce_fixture_player_match_data
  before update of season_id, home_team_registration_id, away_team_registration_id
  on public.fixtures
  for each row
  execute function app_private.enforce_fixture_player_match_data();

drop trigger if exists enforce_player_registration_match_data
on public.player_season_registrations;

create trigger enforce_player_registration_match_data
  before update of season_id, team_registration_id
  on public.player_season_registrations
  for each row
  execute function app_private.enforce_player_registration_match_data();

alter table public.player_match_stats
  validate constraint player_match_stats_penalty_consistency_check;

alter table public.match_events
  validate constraint match_events_distinct_players_check;

commit;

notify pgrst, 'reload schema';
