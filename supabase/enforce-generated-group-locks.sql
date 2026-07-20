begin;

lock table public.season_groups in share row exclusive mode;
lock table public.season_group_teams in share row exclusive mode;
lock table public.fixtures in share row exclusive mode;

create or replace function app_private.lock_group_after_fixture_generation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.stage = 'GROUP' and new.group_id is not null then
    update public.season_groups
    set
      locked = true,
      updated_at = now()
    where id = new.group_id
      and locked = false;
  end if;

  return new;
end
$function$;

create or replace function app_private.protect_locked_group_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if (
    tg_op = 'INSERT'
    and exists (
      select 1
      from public.season_groups season_group
      where season_group.id = new.group_id
        and season_group.locked
    )
  ) or (
    tg_op = 'DELETE'
    and exists (
      select 1
      from public.season_groups season_group
      where season_group.id = old.group_id
        and season_group.locked
    )
  ) or (
    tg_op = 'UPDATE'
    and exists (
      select 1
      from public.season_groups season_group
      where season_group.id in (old.group_id, new.group_id)
        and season_group.locked
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Group assignments are locked because group fixtures have already been generated.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

create or replace function app_private.protect_locked_season_group()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if old.locked then
      raise exception using
        errcode = '23514',
        message = 'A group cannot be changed or unlocked after group fixtures are generated.';
    end if;
    return old;
  end if;

  if old.locked and (
    new.locked = false
    or new.season_id is distinct from old.season_id
    or new.name is distinct from old.name
  ) then
    raise exception using
      errcode = '23514',
      message = 'A group cannot be changed or unlocked after group fixtures are generated.';
  end if;

  return new;
end
$function$;

revoke all
on function app_private.lock_group_after_fixture_generation()
from public, anon, authenticated;

revoke all
on function app_private.protect_locked_group_assignment()
from public, anon, authenticated;

revoke all
on function app_private.protect_locked_season_group()
from public, anon, authenticated;

drop trigger if exists lock_group_after_fixture_generation
on public.fixtures;

create trigger lock_group_after_fixture_generation
after insert or update of stage, group_id
on public.fixtures
for each row
execute function app_private.lock_group_after_fixture_generation();

drop trigger if exists protect_locked_group_assignment
on public.season_group_teams;

create trigger protect_locked_group_assignment
before insert or update or delete
on public.season_group_teams
for each row
execute function app_private.protect_locked_group_assignment();

drop trigger if exists protect_locked_season_group
on public.season_groups;

create trigger protect_locked_season_group
before update of season_id, name, locked or delete
on public.season_groups
for each row
execute function app_private.protect_locked_season_group();

update public.season_groups season_group
set
  locked = true,
  updated_at = now()
where locked = false
  and exists (
    select 1
    from public.fixtures fixture
    where fixture.group_id = season_group.id
      and fixture.stage = 'GROUP'
  );

commit;

notify pgrst, 'reload schema';
