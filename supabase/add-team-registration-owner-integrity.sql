begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.teams in share row exclusive mode;
lock table public.team_registrations in share row exclusive mode;

do $audit$
declare
  ownership_mismatches integer;
begin
  select count(*)
  into ownership_mismatches
  from public.team_registrations team_registration
  join public.teams team
    on team.id = team_registration.team_id
  where team_registration.manager_id is distinct from team.manager_id;

  if ownership_mismatches > 0 then
    raise exception using
      message = 'Cannot enforce team registration owner integrity because existing data is invalid.',
      detail = format('ownership_mismatches=%s', ownership_mismatches);
  end if;
end
$audit$;

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.teams'::regclass
      and conname = 'teams_id_manager_id_key'
  ) then
    alter table public.teams
      add constraint teams_id_manager_id_key
      unique (id, manager_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_registrations'::regclass
      and conname = 'team_registrations_team_manager_fkey'
  ) then
    alter table public.team_registrations
      add constraint team_registrations_team_manager_fkey
      foreign key (team_id, manager_id)
      references public.teams(id, manager_id)
      on delete cascade
      not valid;
  end if;
end
$constraints$;

alter table public.team_registrations
  validate constraint team_registrations_team_manager_fkey;

-- Retain one unambiguous PostgREST relationship between registrations and
-- teams. The composite key replaces this single-column relationship while
-- preserving cascading team deletion.
alter table public.team_registrations
  drop constraint if exists team_registrations_team_id_fkey;

create index if not exists team_registrations_team_manager_idx
  on public.team_registrations(team_id, manager_id);

create index if not exists team_registrations_manager_created_idx
  on public.team_registrations(manager_id, created_at desc);

commit;

notify pgrst, 'reload schema';
