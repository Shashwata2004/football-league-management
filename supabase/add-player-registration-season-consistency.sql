begin;

lock table public.team_registrations in share row exclusive mode;
lock table public.player_season_registrations in share row exclusive mode;

do $audit$
declare
  mismatched_registrations integer;
begin
  select count(*)
  into mismatched_registrations
  from public.player_season_registrations player_registration
  join public.team_registrations team_registration
    on team_registration.id = player_registration.team_registration_id
  where player_registration.season_id <> team_registration.season_id;

  if mismatched_registrations > 0 then
    raise exception using
      message = 'Cannot enforce player registration season consistency because existing data is invalid.',
      detail = format(
        'player_team_season_mismatches=%s',
        mismatched_registrations
      );
  end if;
end
$audit$;

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_registrations'::regclass
      and conname = 'team_registrations_id_season_id_key'
  ) then
    alter table public.team_registrations
      add constraint team_registrations_id_season_id_key
      unique (id, season_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.player_season_registrations'::regclass
      and conname = 'player_registrations_team_season_fkey'
  ) then
    alter table public.player_season_registrations
      add constraint player_registrations_team_season_fkey
      foreign key (team_registration_id, season_id)
      references public.team_registrations(id, season_id)
      on delete cascade
      not valid;
  end if;
end
$constraints$;

alter table public.player_season_registrations
  validate constraint player_registrations_team_season_fkey;

-- Keep one unambiguous relationship for PostgREST embeds. The composite
-- foreign key retains cascading deletes and also enforces season consistency.
alter table public.player_season_registrations
  drop constraint if exists player_season_registrations_team_registration_id_fkey;

commit;

notify pgrst, 'reload schema';
