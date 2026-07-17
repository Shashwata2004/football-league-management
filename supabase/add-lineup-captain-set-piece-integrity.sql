begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.lineups in share row exclusive mode;
lock table public.lineup_players in share row exclusive mode;
lock table public.lineup_set_piece_takers in share row exclusive mode;
lock table public.player_season_registrations in share row exclusive mode;

do $audit$
declare
  invalid_captain_scope integer;
  invalid_published_captains integer;
  invalid_lineup_members integer;
  invalid_set_piece_members integer;
  invalid_set_piece_scope integer;
begin
  select count(*)
  into invalid_captain_scope
  from public.lineups lineup
  join public.player_season_registrations captain
    on captain.id = lineup.captain_id
  where captain.team_registration_id is distinct from lineup.team_registration_id
    or captain.season_id is distinct from lineup.season_id;

  select count(*)
  into invalid_published_captains
  from public.lineups lineup
  where lineup.status in ('PENDING', 'CONFIRMED')
    and (
      lineup.captain_id is null
      or (
        select count(*)
        from public.lineup_players lineup_player
        where lineup_player.lineup_id = lineup.id
          and lineup_player.player_registration_id = lineup.captain_id
          and lineup_player.is_starter
          and lineup_player.is_captain
      ) <> 1
    );

  select count(*)
  into invalid_lineup_members
  from public.lineup_players lineup_player
  join public.lineups lineup
    on lineup.id = lineup_player.lineup_id
  join public.player_season_registrations player_registration
    on player_registration.id = lineup_player.player_registration_id
  where player_registration.team_registration_id is distinct from lineup.team_registration_id
    or player_registration.season_id is distinct from lineup.season_id;

  select count(*)
  into invalid_set_piece_members
  from public.lineup_set_piece_takers taker
  left join public.lineup_players lineup_player
    on lineup_player.lineup_id = taker.lineup_id
   and lineup_player.player_registration_id = taker.player_registration_id
  where lineup_player.id is null;

  select count(*)
  into invalid_set_piece_scope
  from public.lineup_set_piece_takers taker
  join public.lineups lineup
    on lineup.id = taker.lineup_id
  join public.player_season_registrations player_registration
    on player_registration.id = taker.player_registration_id
  where player_registration.team_registration_id is distinct from lineup.team_registration_id
    or player_registration.season_id is distinct from lineup.season_id;

  if invalid_captain_scope > 0
    or invalid_published_captains > 0
    or invalid_lineup_members > 0
    or invalid_set_piece_members > 0
    or invalid_set_piece_scope > 0 then
    raise exception using
      message = 'Cannot enforce lineup captain and set-piece integrity because existing data is invalid.',
      detail = format(
        'invalid_captain_scope=%s, invalid_published_captains=%s, invalid_lineup_members=%s, invalid_set_piece_members=%s, invalid_set_piece_scope=%s',
        invalid_captain_scope,
        invalid_published_captains,
        invalid_lineup_members,
        invalid_set_piece_members,
        invalid_set_piece_scope
      );
  end if;
end
$audit$;

create index if not exists lineups_captain_id_idx
  on public.lineups(captain_id)
  where captain_id is not null;

create index if not exists lineup_set_piece_takers_player_lineup_idx
  on public.lineup_set_piece_takers(player_registration_id, lineup_id);

create schema if not exists app_private;

create or replace function app_private.enforce_lineup_captain_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  captain_team_id uuid;
  captain_season_id uuid;
begin
  if new.captain_id is null then
    return new;
  end if;

  select
    player_registration.team_registration_id,
    player_registration.season_id
  into
    captain_team_id,
    captain_season_id
  from public.player_season_registrations player_registration
  where player_registration.id = new.captain_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup captain registration does not exist.';
  end if;

  if captain_team_id is distinct from new.team_registration_id
    or captain_season_id is distinct from new.season_id then
    raise exception using
      errcode = '23514',
      message = 'Lineup captain must belong to the lineup team and season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.enforce_lineup_player_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  lineup_team_id uuid;
  lineup_season_id uuid;
  player_team_id uuid;
  player_season_id uuid;
begin
  select lineup.team_registration_id, lineup.season_id
  into lineup_team_id, lineup_season_id
  from public.lineups lineup
  where lineup.id = new.lineup_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup does not exist.';
  end if;

  select
    player_registration.team_registration_id,
    player_registration.season_id
  into
    player_team_id,
    player_season_id
  from public.player_season_registrations player_registration
  where player_registration.id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup player registration does not exist.';
  end if;

  if player_team_id is distinct from lineup_team_id
    or player_season_id is distinct from lineup_season_id then
    raise exception using
      errcode = '23514',
      message = 'Lineup player must belong to the lineup team and season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.enforce_set_piece_taker_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  lineup_team_id uuid;
  lineup_season_id uuid;
  player_team_id uuid;
  player_season_id uuid;
begin
  if not exists (
    select 1
    from public.lineup_players lineup_player
    where lineup_player.lineup_id = new.lineup_id
      and lineup_player.player_registration_id = new.player_registration_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Set-piece taker must belong to the submitted lineup.';
  end if;

  select lineup.team_registration_id, lineup.season_id
  into lineup_team_id, lineup_season_id
  from public.lineups lineup
  where lineup.id = new.lineup_id;

  select
    player_registration.team_registration_id,
    player_registration.season_id
  into
    player_team_id,
    player_season_id
  from public.player_season_registrations player_registration
  where player_registration.id = new.player_registration_id;

  if player_team_id is distinct from lineup_team_id
    or player_season_id is distinct from lineup_season_id then
    raise exception using
      errcode = '23514',
      message = 'Set-piece taker must belong to the lineup team and season.';
  end if;

  return new;
end
$function$;

create or replace function app_private.validate_published_lineup(
  target_lineup_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  lineup_record public.lineups%rowtype;
  matching_captains integer;
begin
  select *
  into lineup_record
  from public.lineups lineup
  where lineup.id = target_lineup_id;

  if not found or lineup_record.status not in ('PENDING', 'CONFIRMED') then
    return;
  end if;

  if lineup_record.captain_id is null then
    raise exception using
      errcode = '23514',
      message = 'A pending or confirmed lineup must have a captain.';
  end if;

  select count(*)
  into matching_captains
  from public.lineup_players lineup_player
  where lineup_player.lineup_id = lineup_record.id
    and lineup_player.player_registration_id = lineup_record.captain_id
    and lineup_player.is_starter
    and lineup_player.is_captain;

  if matching_captains <> 1 then
    raise exception using
      errcode = '23514',
      message = 'Published lineup captain must be exactly one marked starter in that lineup.';
  end if;

  if exists (
    select 1
    from public.lineup_players lineup_player
    join public.player_season_registrations player_registration
      on player_registration.id = lineup_player.player_registration_id
    where lineup_player.lineup_id = lineup_record.id
      and (
        player_registration.team_registration_id is distinct from lineup_record.team_registration_id
        or player_registration.season_id is distinct from lineup_record.season_id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Published lineup contains a player from another team or season.';
  end if;

  if exists (
    select 1
    from public.lineup_set_piece_takers taker
    left join public.lineup_players lineup_player
      on lineup_player.lineup_id = taker.lineup_id
     and lineup_player.player_registration_id = taker.player_registration_id
    where taker.lineup_id = lineup_record.id
      and lineup_player.id is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Published lineup has a set-piece taker outside its submitted squad.';
  end if;
end
$function$;

create or replace function app_private.validate_lineup_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_name = 'lineups' then
    perform app_private.validate_published_lineup(new.id);
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform app_private.validate_published_lineup(old.lineup_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform app_private.validate_published_lineup(new.lineup_id);
    return new;
  end if;

  return old;
end
$function$;

revoke all on function app_private.enforce_lineup_captain_scope() from public;
revoke all on function app_private.enforce_lineup_player_scope() from public;
revoke all on function app_private.enforce_set_piece_taker_scope() from public;
revoke all on function app_private.validate_published_lineup(uuid) from public;
revoke all on function app_private.validate_lineup_after_change() from public;

drop trigger if exists lineups_enforce_captain_scope
on public.lineups;

create trigger lineups_enforce_captain_scope
before insert or update of captain_id, team_registration_id, season_id
on public.lineups
for each row
execute function app_private.enforce_lineup_captain_scope();

drop trigger if exists lineup_players_enforce_scope
on public.lineup_players;

create trigger lineup_players_enforce_scope
before insert or update of lineup_id, player_registration_id
on public.lineup_players
for each row
execute function app_private.enforce_lineup_player_scope();

drop trigger if exists lineup_set_piece_takers_enforce_scope
on public.lineup_set_piece_takers;

create trigger lineup_set_piece_takers_enforce_scope
before insert or update of lineup_id, player_registration_id
on public.lineup_set_piece_takers
for each row
execute function app_private.enforce_set_piece_taker_scope();

drop trigger if exists lineups_validate_published_state
on public.lineups;

create trigger lineups_validate_published_state
after insert or update of status, captain_id, team_registration_id, season_id
on public.lineups
for each row
execute function app_private.validate_lineup_after_change();

drop trigger if exists lineup_players_validate_published_state
on public.lineup_players;

create trigger lineup_players_validate_published_state
after insert or update or delete
on public.lineup_players
for each row
execute function app_private.validate_lineup_after_change();

commit;
