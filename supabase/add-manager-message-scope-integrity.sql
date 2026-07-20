begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.team_registrations in share row exclusive mode;
lock table public.player_season_registrations in share row exclusive mode;
lock table public.fixtures in share row exclusive mode;
lock table public.manager_messages in share row exclusive mode;

do $audit$
declare
  blank_messages integer;
  invalid_team_scope integer;
  invalid_player_scope integer;
  invalid_fixture_scope integer;
begin
  select count(*)
  into blank_messages
  from public.manager_messages
  where nullif(btrim(message), '') is null
    or (
      notification_key is not null
      and nullif(btrim(notification_key), '') is null
    );

  select count(*)
  into invalid_team_scope
  from public.manager_messages manager_message
  join public.team_registrations team_registration
    on team_registration.id = manager_message.team_registration_id
  where manager_message.season_id is distinct from team_registration.season_id
    or manager_message.manager_id is distinct from team_registration.manager_id;

  select count(*)
  into invalid_player_scope
  from public.manager_messages manager_message
  join public.player_season_registrations player_registration
    on player_registration.id = manager_message.player_registration_id
  join public.team_registrations player_team
    on player_team.id = player_registration.team_registration_id
  where manager_message.season_id is distinct from player_registration.season_id
    or manager_message.manager_id is distinct from player_team.manager_id
    or (
      manager_message.team_registration_id is not null
      and manager_message.team_registration_id is distinct from player_registration.team_registration_id
    );

  select count(*)
  into invalid_fixture_scope
  from public.manager_messages manager_message
  join public.fixtures fixture
    on fixture.id = manager_message.fixture_id
  where manager_message.season_id is distinct from fixture.season_id
    or (
      manager_message.team_registration_id is not null
      and manager_message.team_registration_id is distinct from fixture.home_team_registration_id
      and manager_message.team_registration_id is distinct from fixture.away_team_registration_id
    );

  if blank_messages > 0
    or invalid_team_scope > 0
    or invalid_player_scope > 0
    or invalid_fixture_scope > 0 then
    raise exception using
      message = 'Cannot enforce manager message scope integrity because existing data is invalid.',
      detail = format(
        'blank_messages=%s, invalid_team_scope=%s, invalid_player_scope=%s, invalid_fixture_scope=%s',
        blank_messages,
        invalid_team_scope,
        invalid_player_scope,
        invalid_fixture_scope
      );
  end if;
end
$audit$;

alter table public.manager_messages
  drop constraint if exists manager_messages_content_check;

alter table public.manager_messages
  add constraint manager_messages_content_check
  check (
    nullif(btrim(message), '') is not null
    and (
      notification_key is null
      or nullif(btrim(notification_key), '') is not null
    )
  )
  not valid;

create index if not exists idx_manager_messages_team
  on public.manager_messages(team_registration_id, created_at desc)
  where team_registration_id is not null;

create schema if not exists app_private;

create or replace function app_private.enforce_manager_message_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  team_manager_id uuid;
  team_season_id uuid;
  player_team_id uuid;
  player_manager_id uuid;
  player_season_id uuid;
  fixture_season_id uuid;
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
begin
  if new.team_registration_id is not null then
    select team_registration.manager_id, team_registration.season_id
    into team_manager_id, team_season_id
    from public.team_registrations team_registration
    where team_registration.id = new.team_registration_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Manager message team registration does not exist.';
    end if;

    if new.manager_id is distinct from team_manager_id
      or new.season_id is distinct from team_season_id then
      raise exception using
        errcode = '23514',
        message = 'Manager message must match the team registration manager and season.';
    end if;
  end if;

  if new.player_registration_id is not null then
    select
      player_registration.team_registration_id,
      player_team.manager_id,
      player_registration.season_id
    into
      player_team_id,
      player_manager_id,
      player_season_id
    from public.player_season_registrations player_registration
    join public.team_registrations player_team
      on player_team.id = player_registration.team_registration_id
    where player_registration.id = new.player_registration_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Manager message player registration does not exist.';
    end if;

    if new.manager_id is distinct from player_manager_id
      or new.season_id is distinct from player_season_id
      or (
        new.team_registration_id is not null
        and new.team_registration_id is distinct from player_team_id
      ) then
      raise exception using
        errcode = '23514',
        message = 'Manager message player must match its manager, team, and season scope.';
    end if;
  end if;

  if new.fixture_id is not null then
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
        message = 'Manager message fixture does not exist.';
    end if;

    if new.season_id is distinct from fixture_season_id
      or (
        new.team_registration_id is not null
        and new.team_registration_id is distinct from fixture_home_team_id
        and new.team_registration_id is distinct from fixture_away_team_id
      ) then
      raise exception using
        errcode = '23514',
        message = 'Manager message fixture must match its team and season scope.';
    end if;
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_manager_message_team_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.manager_messages manager_message
    where manager_message.team_registration_id = old.id
      and (
        manager_message.manager_id is distinct from new.manager_id
        or manager_message.season_id is distinct from new.season_id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Team registration manager or season cannot invalidate manager messages.';
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_manager_message_player_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.manager_messages manager_message
    where manager_message.player_registration_id = old.id
      and (
        manager_message.season_id is distinct from new.season_id
        or (
          manager_message.team_registration_id is not null
          and manager_message.team_registration_id is distinct from new.team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Player registration team or season cannot invalidate manager messages.';
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_manager_message_fixture_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.manager_messages manager_message
    where manager_message.fixture_id = old.id
      and (
        manager_message.season_id is distinct from new.season_id
        or (
          manager_message.team_registration_id is not null
          and manager_message.team_registration_id is distinct from new.home_team_registration_id
          and manager_message.team_registration_id is distinct from new.away_team_registration_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Fixture participants or season cannot invalidate manager messages.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_manager_message_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_manager_message_team_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_manager_message_player_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_manager_message_fixture_scope()
from public, anon, authenticated;

drop trigger if exists enforce_manager_message_scope
on public.manager_messages;

create trigger enforce_manager_message_scope
before insert or update of
  season_id,
  manager_id,
  team_registration_id,
  player_registration_id,
  fixture_id
on public.manager_messages
for each row
execute function app_private.enforce_manager_message_scope();

drop trigger if exists protect_manager_message_team_scope
on public.team_registrations;

create trigger protect_manager_message_team_scope
before update of manager_id, season_id
on public.team_registrations
for each row
execute function app_private.protect_manager_message_team_scope();

drop trigger if exists protect_manager_message_player_scope
on public.player_season_registrations;

create trigger protect_manager_message_player_scope
before update of team_registration_id, season_id
on public.player_season_registrations
for each row
execute function app_private.protect_manager_message_player_scope();

drop trigger if exists protect_manager_message_fixture_scope
on public.fixtures;

create trigger protect_manager_message_fixture_scope
before update of
  season_id,
  home_team_registration_id,
  away_team_registration_id
on public.fixtures
for each row
execute function app_private.protect_manager_message_fixture_scope();

alter table public.manager_messages
  validate constraint manager_messages_content_check;

commit;

notify pgrst, 'reload schema';
