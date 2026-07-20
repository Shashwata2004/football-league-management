begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.team_registrations in share row exclusive mode;
lock table public.manager_team_preferences in share row exclusive mode;

do $audit$
declare
  invalid_scope_rows integer;
  blank_preference_rows integer;
begin
  select count(*)
  into invalid_scope_rows
  from public.manager_team_preferences preference
  join public.team_registrations team_registration
    on team_registration.id = preference.team_registration_id
  where preference.manager_id is distinct from team_registration.manager_id
    or preference.season_id is distinct from team_registration.season_id;

  select count(*)
  into blank_preference_rows
  from public.manager_team_preferences
  where nullif(btrim(preferred_formation), '') is null
    or nullif(btrim(preferred_playing_style), '') is null;

  if invalid_scope_rows > 0 or blank_preference_rows > 0 then
    raise exception using
      message = 'Cannot enforce manager preference scope integrity because existing data is invalid.',
      detail = format(
        'invalid_scope_rows=%s, blank_preference_rows=%s',
        invalid_scope_rows,
        blank_preference_rows
      );
  end if;
end
$audit$;

alter table public.manager_team_preferences
  drop constraint if exists manager_team_preferences_non_blank_check;

alter table public.manager_team_preferences
  add constraint manager_team_preferences_non_blank_check
  check (
    nullif(btrim(preferred_formation), '') is not null
    and nullif(btrim(preferred_playing_style), '') is not null
  )
  not valid;

create index if not exists manager_team_preferences_team_registration_idx
  on public.manager_team_preferences(team_registration_id);

create schema if not exists app_private;

create or replace function app_private.enforce_manager_preference_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  registration_manager_id uuid;
  registration_season_id uuid;
begin
  select
    team_registration.manager_id,
    team_registration.season_id
  into
    registration_manager_id,
    registration_season_id
  from public.team_registrations team_registration
  where team_registration.id = new.team_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Manager preference team registration does not exist.';
  end if;

  if new.manager_id is distinct from registration_manager_id
    or new.season_id is distinct from registration_season_id then
    raise exception using
      errcode = '23514',
      message = 'Manager preference must match the team registration manager and season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_manager_preference_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.manager_team_preferences preference
    where preference.team_registration_id = old.id
      and (
        preference.manager_id is distinct from new.manager_id
        or preference.season_id is distinct from new.season_id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Team registration manager or season cannot change while scoped preferences exist.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_manager_preference_scope()
from public, anon, authenticated;

revoke all on function app_private.protect_manager_preference_scope()
from public, anon, authenticated;

drop trigger if exists enforce_manager_preference_scope
on public.manager_team_preferences;

create trigger enforce_manager_preference_scope
before insert or update of manager_id, team_registration_id, season_id
on public.manager_team_preferences
for each row
execute function app_private.enforce_manager_preference_scope();

drop trigger if exists protect_manager_preference_scope
on public.team_registrations;

create trigger protect_manager_preference_scope
before update of manager_id, season_id
on public.team_registrations
for each row
execute function app_private.protect_manager_preference_scope();

alter table public.manager_team_preferences
  validate constraint manager_team_preferences_non_blank_check;

commit;

notify pgrst, 'reload schema';
