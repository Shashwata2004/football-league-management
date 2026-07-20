begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.lineup_players in share row exclusive mode;

do $audit$
begin
  if exists (
    select 1
    from public.lineup_players
    where (is_starter and slot_key is null)
       or (not is_starter and slot_key is not null)
  ) then
    raise exception using
      errcode = '23514',
      message = 'Cannot enforce lineup slot roles because existing starter or substitute slots are invalid.';
  end if;
end
$audit$;

alter table public.lineup_players
  drop constraint if exists lineup_players_role_consistency;

alter table public.lineup_players
  drop column if exists is_substitute;

alter table public.lineup_players
  drop constraint if exists lineup_players_slot_role_consistency;

alter table public.lineup_players
  add constraint lineup_players_slot_role_consistency
  check (
    (is_starter and slot_key is not null)
    or (not is_starter and slot_key is null)
  );

commit;
