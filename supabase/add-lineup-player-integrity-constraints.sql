begin;

lock table public.lineup_players in share row exclusive mode;

do $audit$
declare
  contradictory_roles integer;
  bench_captains integer;
  multiple_captains integer;
  duplicate_starter_slots integer;
begin
  select count(*)
  into contradictory_roles
  from public.lineup_players
  where is_substitute = is_starter;

  select count(*)
  into bench_captains
  from public.lineup_players
  where is_captain and not is_starter;

  select count(*)
  into multiple_captains
  from (
    select lineup_id
    from public.lineup_players
    where is_captain
    group by lineup_id
    having count(*) > 1
  ) invalid_lineups;

  select count(*)
  into duplicate_starter_slots
  from (
    select lineup_id, slot_key
    from public.lineup_players
    where is_starter and slot_key is not null
    group by lineup_id, slot_key
    having count(*) > 1
  ) invalid_slots;

  if contradictory_roles > 0
    or bench_captains > 0
    or multiple_captains > 0
    or duplicate_starter_slots > 0 then
    raise exception using
      message = 'Cannot add lineup-player integrity rules because existing data is invalid.',
      detail = format(
        'contradictory_roles=%s, bench_captains=%s, multiple_captains=%s, duplicate_starter_slots=%s',
        contradictory_roles,
        bench_captains,
        multiple_captains,
        duplicate_starter_slots
      );
  end if;
end
$audit$;

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.lineup_players'::regclass
      and conname = 'lineup_players_role_consistency'
  ) then
    alter table public.lineup_players
      add constraint lineup_players_role_consistency
      check (is_substitute = (not is_starter)) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.lineup_players'::regclass
      and conname = 'lineup_players_captain_must_start'
  ) then
    alter table public.lineup_players
      add constraint lineup_players_captain_must_start
      check (not is_captain or is_starter) not valid;
  end if;
end
$constraints$;

alter table public.lineup_players
  validate constraint lineup_players_role_consistency;

alter table public.lineup_players
  validate constraint lineup_players_captain_must_start;

create unique index if not exists lineup_players_one_captain_per_lineup_uidx
  on public.lineup_players(lineup_id)
  where is_captain;

create unique index if not exists lineup_players_unique_starter_slot_uidx
  on public.lineup_players(lineup_id, slot_key)
  where is_starter and slot_key is not null;

commit;
