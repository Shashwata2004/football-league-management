begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.player_abilities in share row exclusive mode;

-- A player's football position is part of the generated ability profile. Abort
-- instead of silently rewriting registrations if historical seasons disagree.
do $audit$
declare
  conflicting_positions integer;
begin
  select count(*)
  into conflicting_positions
  from (
    select ability.player_id
    from public.player_abilities ability
    group by ability.player_id
    having count(distinct ability.position) > 1
  ) conflicts;

  if conflicting_positions > 0 then
    raise exception using
      message = 'Cannot enforce global player abilities while positions conflict.',
      detail = format('players_with_conflicting_positions=%s', conflicting_positions);
  end if;
end
$audit$;

-- Existing duplicated profiles are repaired from the earliest recorded season.
-- For CPL this makes Season 2026 authoritative for its Season 2027 carry-over.
with canonical_profiles as (
  select distinct on (ability.player_id)
    ability.player_id,
    ability.position,
    ability.rating_tier,
    ability.shooting,
    ability.passing,
    ability.dribbling,
    ability.defending,
    ability.physical,
    ability.pace,
    ability.stamina,
    ability.shot_stopping,
    ability.reflexes,
    ability.positioning,
    ability.handling,
    ability.diving,
    ability.distribution,
    ability.communication,
    ability.overall_rating,
    ability.generated_by_admin_id,
    ability.generated_at,
    ability.is_hidden_from_manager
  from public.player_abilities ability
  join public.seasons season
    on season.id = ability.season_id
  order by
    ability.player_id,
    season.season_year asc nulls last,
    season.created_at asc,
    ability.created_at asc,
    ability.id asc
)
update public.player_abilities target
set
  position = source.position,
  rating_tier = source.rating_tier,
  shooting = source.shooting,
  passing = source.passing,
  dribbling = source.dribbling,
  defending = source.defending,
  physical = source.physical,
  pace = source.pace,
  stamina = source.stamina,
  shot_stopping = source.shot_stopping,
  reflexes = source.reflexes,
  positioning = source.positioning,
  handling = source.handling,
  diving = source.diving,
  distribution = source.distribution,
  communication = source.communication,
  overall_rating = source.overall_rating,
  generated_by_admin_id = source.generated_by_admin_id,
  generated_at = source.generated_at,
  is_hidden_from_manager = source.is_hidden_from_manager,
  updated_at = now()
from canonical_profiles source
where target.player_id = source.player_id
  and (
    target.position,
    target.rating_tier,
    target.shooting,
    target.passing,
    target.dribbling,
    target.defending,
    target.physical,
    target.pace,
    target.stamina,
    target.shot_stopping,
    target.reflexes,
    target.positioning,
    target.handling,
    target.diving,
    target.distribution,
    target.communication,
    target.overall_rating
  ) is distinct from (
    source.position,
    source.rating_tier,
    source.shooting,
    source.passing,
    source.dribbling,
    source.defending,
    source.physical,
    source.pace,
    source.stamina,
    source.shot_stopping,
    source.reflexes,
    source.positioning,
    source.handling,
    source.diving,
    source.distribution,
    source.communication,
    source.overall_rating
  );

create index if not exists player_abilities_player_id_idx
  on public.player_abilities(player_id);

create schema if not exists app_private;

-- New season registrations inherit the player's existing profile. Registration,
-- team and season identifiers remain specific to the new season.
create or replace function app_private.inherit_existing_player_ability_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  existing_profile public.player_abilities%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.player_id::text, 1729)
  );

  select ability.*
  into existing_profile
  from public.player_abilities ability
  join public.seasons season
    on season.id = ability.season_id
  where ability.player_id = new.player_id
  order by
    season.season_year asc nulls last,
    season.created_at asc,
    ability.created_at asc,
    ability.id asc
  limit 1;

  if found then
    new.position := existing_profile.position;
    new.rating_tier := existing_profile.rating_tier;
    new.shooting := existing_profile.shooting;
    new.passing := existing_profile.passing;
    new.dribbling := existing_profile.dribbling;
    new.defending := existing_profile.defending;
    new.physical := existing_profile.physical;
    new.pace := existing_profile.pace;
    new.stamina := existing_profile.stamina;
    new.shot_stopping := existing_profile.shot_stopping;
    new.reflexes := existing_profile.reflexes;
    new.positioning := existing_profile.positioning;
    new.handling := existing_profile.handling;
    new.diving := existing_profile.diving;
    new.distribution := existing_profile.distribution;
    new.communication := existing_profile.communication;
    new.overall_rating := existing_profile.overall_rating;
    new.generated_by_admin_id := existing_profile.generated_by_admin_id;
    new.generated_at := existing_profile.generated_at;
    new.is_hidden_from_manager := existing_profile.is_hidden_from_manager;
  end if;

  return new;
end
$function$;

-- Ability editing remains supported, but the edit is global to the player.
-- Sibling season rows are synchronized in the same transaction.
create or replace function app_private.sync_player_ability_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.player_id::text, 1729)
  );

  update public.player_abilities sibling
  set
    position = new.position,
    rating_tier = new.rating_tier,
    shooting = new.shooting,
    passing = new.passing,
    dribbling = new.dribbling,
    defending = new.defending,
    physical = new.physical,
    pace = new.pace,
    stamina = new.stamina,
    shot_stopping = new.shot_stopping,
    reflexes = new.reflexes,
    positioning = new.positioning,
    handling = new.handling,
    diving = new.diving,
    distribution = new.distribution,
    communication = new.communication,
    overall_rating = new.overall_rating,
    generated_by_admin_id = new.generated_by_admin_id,
    generated_at = new.generated_at,
    is_hidden_from_manager = new.is_hidden_from_manager,
    updated_at = now()
  where sibling.player_id = new.player_id
    and sibling.id <> new.id
    and (
      sibling.position,
      sibling.rating_tier,
      sibling.shooting,
      sibling.passing,
      sibling.dribbling,
      sibling.defending,
      sibling.physical,
      sibling.pace,
      sibling.stamina,
      sibling.shot_stopping,
      sibling.reflexes,
      sibling.positioning,
      sibling.handling,
      sibling.diving,
      sibling.distribution,
      sibling.communication,
      sibling.overall_rating,
      sibling.generated_by_admin_id,
      sibling.generated_at,
      sibling.is_hidden_from_manager
    ) is distinct from (
      new.position,
      new.rating_tier,
      new.shooting,
      new.passing,
      new.dribbling,
      new.defending,
      new.physical,
      new.pace,
      new.stamina,
      new.shot_stopping,
      new.reflexes,
      new.positioning,
      new.handling,
      new.diving,
      new.distribution,
      new.communication,
      new.overall_rating,
      new.generated_by_admin_id,
      new.generated_at,
      new.is_hidden_from_manager
    );

  return new;
end
$function$;

revoke all on function app_private.inherit_existing_player_ability_profile()
from public, anon, authenticated;

revoke all on function app_private.sync_player_ability_profile()
from public, anon, authenticated;

drop trigger if exists inherit_existing_player_ability_profile
on public.player_abilities;

create trigger inherit_existing_player_ability_profile
before insert
on public.player_abilities
for each row
execute function app_private.inherit_existing_player_ability_profile();

drop trigger if exists sync_player_ability_profile
on public.player_abilities;

create trigger sync_player_ability_profile
after update of
  position,
  rating_tier,
  shooting,
  passing,
  dribbling,
  defending,
  physical,
  pace,
  stamina,
  shot_stopping,
  reflexes,
  positioning,
  handling,
  diving,
  distribution,
  communication,
  overall_rating,
  generated_by_admin_id,
  generated_at,
  is_hidden_from_manager
on public.player_abilities
for each row
execute function app_private.sync_player_ability_profile();

do $verify$
declare
  conflicting_profiles integer;
begin
  select count(*)
  into conflicting_profiles
  from (
    select ability.player_id
    from public.player_abilities ability
    group by ability.player_id
    having count(distinct (
      ability.position,
      ability.rating_tier,
      ability.overall_rating,
      ability.shooting,
      ability.passing,
      ability.dribbling,
      ability.defending,
      ability.physical,
      ability.pace,
      ability.stamina,
      ability.shot_stopping,
      ability.reflexes,
      ability.positioning,
      ability.handling,
      ability.diving,
      ability.distribution,
      ability.communication
    )) > 1
  ) conflicts;

  if conflicting_profiles > 0 then
    raise exception using
      message = 'Player ability profile synchronization failed.',
      detail = format('players_with_conflicting_profiles=%s', conflicting_profiles);
  end if;
end
$verify$;

commit;

notify pgrst, 'reload schema';
