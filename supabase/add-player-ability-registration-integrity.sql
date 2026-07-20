begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.player_season_registrations in share row exclusive mode;
lock table public.player_abilities in share row exclusive mode;

do $audit$
declare
  invalid_identity_rows integer;
  invalid_tier_rows integer;
begin
  select count(*)
  into invalid_identity_rows
  from public.player_abilities ability
  join public.player_season_registrations registration
    on registration.id = ability.player_registration_id
  where ability.player_id is distinct from registration.player_id
    or ability.team_registration_id is distinct from registration.team_registration_id
    or ability.season_id is distinct from registration.season_id
    or ability.position is distinct from coalesce(
      registration.football_position,
      case registration.position
        when 'GK' then 'GK'::public.football_position
        when 'DEF' then 'CB'::public.football_position
        when 'MID' then 'CM'::public.football_position
        when 'FWD' then 'ST'::public.football_position
      end
    );

  select count(*)
  into invalid_tier_rows
  from public.player_abilities ability
  join public.player_season_registrations registration
    on registration.id = ability.player_registration_id
  where ability.rating_tier is distinct from registration.ability_rating;

  if invalid_identity_rows > 0 or invalid_tier_rows > 0 then
    raise exception using
      message = 'Cannot enforce player ability registration integrity because existing data is invalid.',
      detail = format(
        'invalid_identity_rows=%s, invalid_tier_rows=%s',
        invalid_identity_rows,
        invalid_tier_rows
      );
  end if;
end
$audit$;

create index if not exists player_abilities_player_id_idx
  on public.player_abilities(player_id);

create index if not exists player_abilities_season_team_idx
  on public.player_abilities(season_id, team_registration_id);

create schema if not exists app_private;

create or replace function app_private.enforce_player_ability_registration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  registration_record public.player_season_registrations%rowtype;
  expected_position public.football_position;
begin
  select *
  into registration_record
  from public.player_season_registrations registration
  where registration.id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Player ability registration does not exist.';
  end if;

  expected_position := coalesce(
    registration_record.football_position,
    case registration_record.position
      when 'GK' then 'GK'::public.football_position
      when 'DEF' then 'CB'::public.football_position
      when 'MID' then 'CM'::public.football_position
      when 'FWD' then 'ST'::public.football_position
    end
  );

  if new.player_id is distinct from registration_record.player_id
    or new.team_registration_id is distinct from registration_record.team_registration_id
    or new.season_id is distinct from registration_record.season_id
    or new.position is distinct from expected_position then
    raise exception using
      errcode = '23514',
      message = 'Player ability identity fields must match its season registration.';
  end if;

  return new;
end
$function$;

create or replace function app_private.sync_player_registration_ability_tier()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    update public.player_season_registrations
    set
      ability_rating = null,
      updated_at = now()
    where id = old.player_registration_id
      and ability_rating is not null;
    return old;
  end if;

  update public.player_season_registrations
  set
    ability_rating = new.rating_tier,
    updated_at = now()
  where id = new.player_registration_id
    and ability_rating is distinct from new.rating_tier;

  return new;
end
$function$;

create or replace function app_private.protect_player_ability_dependency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  ability_record public.player_abilities%rowtype;
  old_expected_position public.football_position;
  new_expected_position public.football_position;
begin
  select *
  into ability_record
  from public.player_abilities ability
  where ability.player_registration_id = old.id;

  if not found then
    if new.ability_rating is not null then
      raise exception using
        errcode = '23514',
        message = 'A registration cannot have an ability tier without a player ability record.';
    end if;
    return new;
  end if;

  old_expected_position := coalesce(
    old.football_position,
    case old.position
      when 'GK' then 'GK'::public.football_position
      when 'DEF' then 'CB'::public.football_position
      when 'MID' then 'CM'::public.football_position
      when 'FWD' then 'ST'::public.football_position
    end
  );
  new_expected_position := coalesce(
    new.football_position,
    case new.position
      when 'GK' then 'GK'::public.football_position
      when 'DEF' then 'CB'::public.football_position
      when 'MID' then 'CM'::public.football_position
      when 'FWD' then 'ST'::public.football_position
    end
  );

  if new.player_id is distinct from old.player_id
    or new.team_registration_id is distinct from old.team_registration_id
    or new.season_id is distinct from old.season_id
    or new_expected_position is distinct from old_expected_position then
    raise exception using
      errcode = '23514',
      message = 'Rated player identity or position cannot change until its ability record is regenerated.';
  end if;

  if new.ability_rating is distinct from ability_record.rating_tier then
    raise exception using
      errcode = '23514',
      message = 'Registration ability tier must match the player ability record.';
  end if;

  return new;
end
$function$;

revoke all on function app_private.enforce_player_ability_registration()
from public, anon, authenticated;

revoke all on function app_private.sync_player_registration_ability_tier()
from public, anon, authenticated;

revoke all on function app_private.protect_player_ability_dependency()
from public, anon, authenticated;

drop trigger if exists enforce_player_ability_registration
on public.player_abilities;

create trigger enforce_player_ability_registration
before insert or update of
  player_registration_id,
  player_id,
  team_registration_id,
  season_id,
  position
on public.player_abilities
for each row
execute function app_private.enforce_player_ability_registration();

drop trigger if exists sync_player_registration_ability_tier
on public.player_abilities;

create trigger sync_player_registration_ability_tier
after insert or update of rating_tier or delete
on public.player_abilities
for each row
execute function app_private.sync_player_registration_ability_tier();

drop trigger if exists protect_player_ability_dependency
on public.player_season_registrations;

create trigger protect_player_ability_dependency
before update of
  player_id,
  team_registration_id,
  season_id,
  position,
  football_position,
  ability_rating
on public.player_season_registrations
for each row
execute function app_private.protect_player_ability_dependency();

commit;

notify pgrst, 'reload schema';
