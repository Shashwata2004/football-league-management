begin;

lock table public.season_groups in share row exclusive mode;
lock table public.team_registrations in share row exclusive mode;
lock table public.season_group_teams in share row exclusive mode;

do $audit$
declare
  season_mismatches integer;
begin
  select count(*)
  into season_mismatches
  from public.season_group_teams membership
  join public.season_groups season_group
    on season_group.id = membership.group_id
  join public.team_registrations team_registration
    on team_registration.id = membership.team_registration_id
  where season_group.season_id is distinct from team_registration.season_id;

  if season_mismatches > 0 then
    raise exception using
      message = 'Cannot enforce group assignment season consistency because existing data is invalid.',
      detail = format('group_team_season_mismatches=%s', season_mismatches);
  end if;
end
$audit$;

create or replace function app_private.enforce_season_group_team_consistency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  group_season_id uuid;
  team_season_id uuid;
begin
  select season_id
  into group_season_id
  from public.season_groups
  where id = new.group_id;

  select season_id
  into team_season_id
  from public.team_registrations
  where id = new.team_registration_id;

  if group_season_id is not null
    and team_season_id is not null
    and group_season_id is distinct from team_season_id then
    raise exception using
      errcode = '23514',
      constraint = 'season_group_teams_same_season_check',
      message = 'A team registration can only be assigned to a group from the same season.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_season_group_team_consistency()
from public, anon, authenticated;

do $trigger$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.season_group_teams'::regclass
      and tgname = 'enforce_season_group_team_consistency'
      and not tgisinternal
  ) then
    create trigger enforce_season_group_team_consistency
      before insert or update of group_id, team_registration_id
      on public.season_group_teams
      for each row
      execute function app_private.enforce_season_group_team_consistency();
  end if;
end
$trigger$;

commit;
