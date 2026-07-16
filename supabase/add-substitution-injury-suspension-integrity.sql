begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.fixtures in share row exclusive mode;
lock table public.player_season_registrations in share row exclusive mode;
lock table public.match_substitutions in share row exclusive mode;
lock table public.match_injuries in share row exclusive mode;
lock table public.player_suspensions in share row exclusive mode;

do $audit$
declare
  invalid_substitutions integer;
  duplicate_substitution_roles integer;
  invalid_injuries integer;
  duplicate_injuries integer;
  invalid_suspensions integer;
  invalid_suspension_states integer;
  duplicate_active_suspensions integer;
  invalid_registration_suspensions integer;
begin
  select count(*)
  into invalid_substitutions
  from public.match_substitutions substitution
  join public.fixtures fixture
    on fixture.id = substitution.fixture_id
  join public.player_season_registrations outgoing_player
    on outgoing_player.id = substitution.player_out_registration_id
  join public.player_season_registrations incoming_player
    on incoming_player.id = substitution.player_in_registration_id
  where substitution.team_registration_id is distinct from fixture.home_team_registration_id
      and substitution.team_registration_id is distinct from fixture.away_team_registration_id
    or outgoing_player.season_id is distinct from fixture.season_id
    or incoming_player.season_id is distinct from fixture.season_id
    or outgoing_player.team_registration_id is distinct from substitution.team_registration_id
    or incoming_player.team_registration_id is distinct from substitution.team_registration_id;

  select count(*)
  into duplicate_substitution_roles
  from (
    select fixture_id, player_out_registration_id
    from public.match_substitutions
    group by fixture_id, player_out_registration_id
    having count(*) > 1

    union all

    select fixture_id, player_in_registration_id
    from public.match_substitutions
    group by fixture_id, player_in_registration_id
    having count(*) > 1
  ) duplicate_role;

  select count(*)
  into invalid_injuries
  from public.match_injuries injury
  join public.fixtures fixture
    on fixture.id = injury.fixture_id
  join public.player_season_registrations player_registration
    on player_registration.id = injury.player_registration_id
  where (
      injury.team_registration_id is distinct from fixture.home_team_registration_id
      and injury.team_registration_id is distinct from fixture.away_team_registration_id
    )
    or player_registration.season_id is distinct from fixture.season_id
    or player_registration.team_registration_id is distinct from injury.team_registration_id
    or nullif(btrim(injury.injury_type), '') is null
    or nullif(btrim(injury.severity), '') is null;

  select count(*)
  into duplicate_injuries
  from (
    select fixture_id, player_registration_id
    from public.match_injuries
    group by fixture_id, player_registration_id
    having count(*) > 1
  ) duplicate_injury;

  select count(*)
  into invalid_suspensions
  from public.player_suspensions suspension
  join public.player_season_registrations player_registration
    on player_registration.id = suspension.player_registration_id
  left join public.fixtures source_fixture
    on source_fixture.id = suspension.source_fixture_id
  where player_registration.team_registration_id is distinct from suspension.team_registration_id
    or player_registration.season_id is distinct from suspension.season_id
    or (
      suspension.source_fixture_id is not null
      and (
        source_fixture.season_id is distinct from suspension.season_id
        or (
          suspension.team_registration_id is distinct from source_fixture.home_team_registration_id
          and suspension.team_registration_id is distinct from source_fixture.away_team_registration_id
        )
      )
    );

  select count(*)
  into invalid_suspension_states
  from public.player_suspensions
  where nullif(btrim(reason), '') is null
    or reason not in ('RED_CARD', 'YELLOW_CARD_ACCUMULATION')
    or (
      status = 'ACTIVE'
      and matches_remaining <= 0
    )
    or (
      status in ('SERVED', 'CANCELLED')
      and matches_remaining <> 0
    );

  select count(*)
  into duplicate_active_suspensions
  from (
    select player_registration_id
    from public.player_suspensions
    where status = 'ACTIVE'
      and matches_remaining > 0
    group by player_registration_id
    having count(*) > 1
  ) duplicate_suspension;

  select count(*)
  into invalid_registration_suspensions
  from public.player_season_registrations
  where (
      player_status = 'SUSPENDED'
      and (
        nullif(btrim(suspension_reason), '') is null
        or suspension_type not in ('UNTIL_ADMIN_UNSUSPENDS', 'UNTIL_DATE', 'NEXT_MATCHES')
        or suspended_by is null
        or suspended_at is null
        or (
          suspension_type = 'UNTIL_DATE'
          and (
            suspension_until is null
            or suspension_matches_remaining is not null
          )
        )
        or (
          suspension_type = 'NEXT_MATCHES'
          and (
            suspension_until is not null
            or coalesce(suspension_matches_remaining, 0) < 1
          )
        )
        or (
          suspension_type = 'UNTIL_ADMIN_UNSUSPENDS'
          and (
            suspension_until is not null
            or suspension_matches_remaining is not null
          )
        )
      )
    )
    or (
      player_status <> 'SUSPENDED'
      and (
        suspension_reason is not null
        or suspension_type is not null
        or suspension_until is not null
        or suspension_matches_remaining is not null
      )
    );

  if invalid_substitutions > 0
    or duplicate_substitution_roles > 0
    or invalid_injuries > 0
    or duplicate_injuries > 0
    or invalid_suspensions > 0
    or invalid_suspension_states > 0
    or duplicate_active_suspensions > 0
    or invalid_registration_suspensions > 0 then
    raise exception using
      message = 'Cannot enforce substitution, injury, and suspension integrity because existing data is invalid.',
      detail = format(
        'invalid_substitutions=%s, duplicate_substitution_roles=%s, invalid_injuries=%s, duplicate_injuries=%s, invalid_suspensions=%s, invalid_suspension_states=%s, duplicate_active_suspensions=%s, invalid_registration_suspensions=%s',
        invalid_substitutions,
        duplicate_substitution_roles,
        invalid_injuries,
        duplicate_injuries,
        invalid_suspensions,
        invalid_suspension_states,
        duplicate_active_suspensions,
        invalid_registration_suspensions
      );
  end if;
end
$audit$;

alter table public.match_injuries
  drop constraint if exists match_injuries_descriptor_check;

alter table public.match_injuries
  add constraint match_injuries_descriptor_check
  check (
    nullif(btrim(injury_type), '') is not null
    and nullif(btrim(severity), '') is not null
  )
  not valid;

alter table public.player_suspensions
  drop constraint if exists player_suspensions_integrity_check;

alter table public.player_suspensions
  add constraint player_suspensions_integrity_check
  check (
    nullif(btrim(reason), '') is not null
    and reason in ('RED_CARD', 'YELLOW_CARD_ACCUMULATION')
    and (
      (
        status = 'ACTIVE'
        and matches_remaining > 0
      )
      or (
        status in ('SERVED', 'CANCELLED')
        and matches_remaining = 0
      )
    )
  )
  not valid;

alter table public.player_season_registrations
  drop constraint if exists player_registration_suspension_state_check;

alter table public.player_season_registrations
  add constraint player_registration_suspension_state_check
  check (
    (
      player_status = 'SUSPENDED'
      and nullif(btrim(suspension_reason), '') is not null
      and suspension_type in ('UNTIL_ADMIN_UNSUSPENDS', 'UNTIL_DATE', 'NEXT_MATCHES')
      and suspended_by is not null
      and suspended_at is not null
      and (
        (
          suspension_type = 'UNTIL_DATE'
          and suspension_until is not null
          and suspension_matches_remaining is null
        )
        or (
          suspension_type = 'NEXT_MATCHES'
          and suspension_until is null
          and suspension_matches_remaining >= 1
        )
        or (
          suspension_type = 'UNTIL_ADMIN_UNSUSPENDS'
          and suspension_until is null
          and suspension_matches_remaining is null
        )
      )
    )
    or (
      player_status <> 'SUSPENDED'
      and suspension_reason is null
      and suspension_type is null
      and suspension_until is null
      and suspension_matches_remaining is null
    )
  )
  not valid;

create unique index if not exists match_substitutions_fixture_outgoing_uidx
  on public.match_substitutions(fixture_id, player_out_registration_id);

create unique index if not exists match_substitutions_fixture_incoming_uidx
  on public.match_substitutions(fixture_id, player_in_registration_id);

create unique index if not exists match_injuries_fixture_player_uidx
  on public.match_injuries(fixture_id, player_registration_id);

create index if not exists match_injuries_active_player_idx
  on public.match_injuries(player_registration_id, created_at desc)
  where expected_matches_out > 0;

create index if not exists match_injuries_active_team_idx
  on public.match_injuries(team_registration_id, fixture_id)
  where expected_matches_out > 0;

create unique index if not exists player_suspensions_one_active_player_uidx
  on public.player_suspensions(player_registration_id)
  where status = 'ACTIVE'
    and matches_remaining > 0;

create index if not exists player_suspensions_active_team_idx
  on public.player_suspensions(team_registration_id, player_registration_id)
  where status = 'ACTIVE'
    and matches_remaining > 0;

create index if not exists player_suspensions_source_fixture_idx
  on public.player_suspensions(source_fixture_id)
  where source_fixture_id is not null;

create or replace function app_private.enforce_match_substitution_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
  outgoing_season_id uuid;
  outgoing_team_id uuid;
  incoming_season_id uuid;
  incoming_team_id uuid;
begin
  select season_id, home_team_registration_id, away_team_registration_id
  into fixture_season_id, fixture_home_team_id, fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_substitutions_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  if new.team_registration_id is distinct from fixture_home_team_id
    and new.team_registration_id is distinct from fixture_away_team_id then
    raise exception using
      errcode = '23514',
      constraint = 'match_substitutions_fixture_team_check',
      message = 'A substitution team must be a participant in the fixture.';
  end if;

  select season_id, team_registration_id
  into outgoing_season_id, outgoing_team_id
  from public.player_season_registrations
  where id = new.player_out_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_substitutions_player_out_registration_id_fkey',
      message = 'The outgoing player registration does not exist.';
  end if;

  select season_id, team_registration_id
  into incoming_season_id, incoming_team_id
  from public.player_season_registrations
  where id = new.player_in_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_substitutions_player_in_registration_id_fkey',
      message = 'The incoming player registration does not exist.';
  end if;

  if outgoing_season_id is distinct from fixture_season_id
    or incoming_season_id is distinct from fixture_season_id
    or outgoing_team_id is distinct from new.team_registration_id
    or incoming_team_id is distinct from new.team_registration_id then
    raise exception using
      errcode = '23514',
      constraint = 'match_substitutions_player_team_season_check',
      message = 'Both substitution players must belong to the selected fixture team and season.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_match_substitution_integrity()
from public, anon, authenticated;

create or replace function app_private.enforce_match_injury_integrity()
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
  select season_id, home_team_registration_id, away_team_registration_id
  into fixture_season_id, fixture_home_team_id, fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_injuries_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  select season_id, team_registration_id
  into player_season_id, player_team_id
  from public.player_season_registrations
  where id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'match_injuries_player_registration_id_fkey',
      message = 'The referenced injured player registration does not exist.';
  end if;

  if (
      new.team_registration_id is distinct from fixture_home_team_id
      and new.team_registration_id is distinct from fixture_away_team_id
    )
    or player_season_id is distinct from fixture_season_id
    or player_team_id is distinct from new.team_registration_id then
    raise exception using
      errcode = '23514',
      constraint = 'match_injuries_fixture_participant_check',
      message = 'An injury must belong to a player on a participating team in the same fixture season.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_match_injury_integrity()
from public, anon, authenticated;

create or replace function app_private.enforce_player_suspension_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  player_season_id uuid;
  player_team_id uuid;
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
begin
  select season_id, team_registration_id
  into player_season_id, player_team_id
  from public.player_season_registrations
  where id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'player_suspensions_player_registration_id_fkey',
      message = 'The referenced suspended player registration does not exist.';
  end if;

  if player_season_id is distinct from new.season_id
    or player_team_id is distinct from new.team_registration_id then
    raise exception using
      errcode = '23514',
      constraint = 'player_suspensions_player_team_season_check',
      message = 'A suspension must use the player registration team and season.';
  end if;

  if new.source_fixture_id is not null then
    select season_id, home_team_registration_id, away_team_registration_id
    into fixture_season_id, fixture_home_team_id, fixture_away_team_id
    from public.fixtures
    where id = new.source_fixture_id;

    if not found then
      raise exception using
        errcode = '23503',
        constraint = 'player_suspensions_source_fixture_id_fkey',
        message = 'The referenced suspension source fixture does not exist.';
    end if;

    if fixture_season_id is distinct from new.season_id
      or (
        new.team_registration_id is distinct from fixture_home_team_id
        and new.team_registration_id is distinct from fixture_away_team_id
      ) then
      raise exception using
        errcode = '23514',
        constraint = 'player_suspensions_source_fixture_check',
        message = 'A suspension source fixture must include the player team in the same season.';
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_player_suspension_integrity()
from public, anon, authenticated;

create or replace function app_private.enforce_fixture_absence_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.match_substitutions substitution
    join public.player_season_registrations outgoing_player
      on outgoing_player.id = substitution.player_out_registration_id
    join public.player_season_registrations incoming_player
      on incoming_player.id = substitution.player_in_registration_id
    where substitution.fixture_id = new.id
      and (
        (
          substitution.team_registration_id is distinct from new.home_team_registration_id
          and substitution.team_registration_id is distinct from new.away_team_registration_id
        )
        or outgoing_player.season_id is distinct from new.season_id
        or incoming_player.season_id is distinct from new.season_id
        or outgoing_player.team_registration_id is distinct from substitution.team_registration_id
        or incoming_player.team_registration_id is distinct from substitution.team_registration_id
      )
  ) or exists (
    select 1
    from public.match_injuries injury
    join public.player_season_registrations player_registration
      on player_registration.id = injury.player_registration_id
    where injury.fixture_id = new.id
      and (
        (
          injury.team_registration_id is distinct from new.home_team_registration_id
          and injury.team_registration_id is distinct from new.away_team_registration_id
        )
        or player_registration.season_id is distinct from new.season_id
        or player_registration.team_registration_id is distinct from injury.team_registration_id
      )
  ) or exists (
    select 1
    from public.player_suspensions suspension
    where suspension.source_fixture_id = new.id
      and (
        suspension.season_id is distinct from new.season_id
        or (
          suspension.team_registration_id is distinct from new.home_team_registration_id
          and suspension.team_registration_id is distinct from new.away_team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'fixtures_absence_data_consistency_check',
      message = 'Fixture season or participants cannot invalidate existing substitutions, injuries, or suspensions.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_fixture_absence_data()
from public, anon, authenticated;

create or replace function app_private.enforce_player_registration_absence_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.match_substitutions substitution
    join public.fixtures fixture
      on fixture.id = substitution.fixture_id
    where (
        substitution.player_out_registration_id = new.id
        or substitution.player_in_registration_id = new.id
      )
      and (
        new.season_id is distinct from fixture.season_id
        or new.team_registration_id is distinct from substitution.team_registration_id
      )
  ) or exists (
    select 1
    from public.match_injuries injury
    join public.fixtures fixture
      on fixture.id = injury.fixture_id
    where injury.player_registration_id = new.id
      and (
        new.season_id is distinct from fixture.season_id
        or new.team_registration_id is distinct from injury.team_registration_id
      )
  ) or exists (
    select 1
    from public.player_suspensions suspension
    where suspension.player_registration_id = new.id
      and (
        new.season_id is distinct from suspension.season_id
        or new.team_registration_id is distinct from suspension.team_registration_id
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'player_registrations_absence_data_consistency_check',
      message = 'A player registration cannot be changed in a way that invalidates substitutions, injuries, or suspensions.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_player_registration_absence_data()
from public, anon, authenticated;

drop trigger if exists enforce_match_substitution_integrity
on public.match_substitutions;

create trigger enforce_match_substitution_integrity
  before insert or update of fixture_id, team_registration_id, player_out_registration_id, player_in_registration_id
  on public.match_substitutions
  for each row
  execute function app_private.enforce_match_substitution_integrity();

drop trigger if exists enforce_match_injury_integrity
on public.match_injuries;

create trigger enforce_match_injury_integrity
  before insert or update of fixture_id, player_registration_id, team_registration_id
  on public.match_injuries
  for each row
  execute function app_private.enforce_match_injury_integrity();

drop trigger if exists enforce_player_suspension_integrity
on public.player_suspensions;

create trigger enforce_player_suspension_integrity
  before insert or update of player_registration_id, team_registration_id, season_id, source_fixture_id
  on public.player_suspensions
  for each row
  execute function app_private.enforce_player_suspension_integrity();

drop trigger if exists enforce_fixture_absence_data
on public.fixtures;

create trigger enforce_fixture_absence_data
  before update of season_id, home_team_registration_id, away_team_registration_id
  on public.fixtures
  for each row
  execute function app_private.enforce_fixture_absence_data();

drop trigger if exists enforce_player_registration_absence_data
on public.player_season_registrations;

create trigger enforce_player_registration_absence_data
  before update of season_id, team_registration_id
  on public.player_season_registrations
  for each row
  execute function app_private.enforce_player_registration_absence_data();

alter table public.match_injuries enable row level security;
alter table public.player_suspensions enable row level security;

drop policy if exists "match_injuries_service_only"
on public.match_injuries;

create policy "match_injuries_service_only"
on public.match_injuries for all
using (false)
with check (false);

drop policy if exists "player_suspensions_service_only"
on public.player_suspensions;

create policy "player_suspensions_service_only"
on public.player_suspensions for all
using (false)
with check (false);

alter table public.match_injuries
  validate constraint match_injuries_descriptor_check;

alter table public.player_suspensions
  validate constraint player_suspensions_integrity_check;

alter table public.player_season_registrations
  validate constraint player_registration_suspension_state_check;

commit;

notify pgrst, 'reload schema';
