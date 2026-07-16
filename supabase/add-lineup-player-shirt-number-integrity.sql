begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.player_season_registrations in share row exclusive mode;
lock table public.lineup_players in share row exclusive mode;

do $audit$
begin
  if exists (
    select 1
    from public.lineup_players lineup_player
    join public.player_season_registrations player_registration
      on player_registration.id = lineup_player.player_registration_id
    where player_registration.shirt_number is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Cannot enforce lineup shirt numbers while a selected player registration has no shirt number.';
  end if;
end
$audit$;

update public.lineup_players lineup_player
set shirt_number = player_registration.shirt_number
from public.player_season_registrations player_registration
where player_registration.id = lineup_player.player_registration_id
  and lineup_player.shirt_number is distinct from player_registration.shirt_number;

alter table public.lineup_players
  alter column shirt_number set not null;

alter table public.lineup_players
  drop constraint if exists lineup_players_shirt_number_range_check;

alter table public.lineup_players
  add constraint lineup_players_shirt_number_range_check
  check (shirt_number between 1 and 99);

create or replace function app_private.set_lineup_player_shirt_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  registration_shirt_number integer;
begin
  select player_registration.shirt_number
  into registration_shirt_number
  from public.player_season_registrations player_registration
  where player_registration.id = new.player_registration_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Lineup player registration does not exist.';
  end if;

  if registration_shirt_number is null then
    raise exception using
      errcode = '23514',
      message = 'A lineup player must have a registered shirt number.';
  end if;

  new.shirt_number := registration_shirt_number;
  return new;
end
$function$;

revoke all
on function app_private.set_lineup_player_shirt_number()
from public, anon, authenticated;

drop trigger if exists set_lineup_player_shirt_number
on public.lineup_players;

create trigger set_lineup_player_shirt_number
before insert or update of player_registration_id, shirt_number
on public.lineup_players
for each row
execute function app_private.set_lineup_player_shirt_number();

commit;
