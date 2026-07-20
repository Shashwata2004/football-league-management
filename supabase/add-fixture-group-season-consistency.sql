begin;

lock table public.season_groups in share row exclusive mode;
lock table public.fixtures in share row exclusive mode;

do $audit$
declare
  orphan_groups integer;
  season_mismatches integer;
begin
  select count(*)
  into orphan_groups
  from public.fixtures fixture
  left join public.season_groups season_group
    on season_group.id = fixture.group_id
  where fixture.group_id is not null
    and season_group.id is null;

  select count(*)
  into season_mismatches
  from public.fixtures fixture
  join public.season_groups season_group
    on season_group.id = fixture.group_id
  where fixture.season_id is distinct from season_group.season_id;

  if orphan_groups > 0 or season_mismatches > 0 then
    raise exception using
      message = 'Cannot enforce fixture group season consistency because existing data is invalid.',
      detail = format(
        'orphan_groups=%s, fixture_group_season_mismatches=%s',
        orphan_groups,
        season_mismatches
      );
  end if;
end
$audit$;

do $parent_key$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.season_groups'::regclass
      and conname = 'season_groups_id_season_id_key'
  ) then
    alter table public.season_groups
      add constraint season_groups_id_season_id_key
      unique (id, season_id);
  end if;
end
$parent_key$;

do $replace_foreign_key$
declare
  current_definition text;
begin
  select pg_get_constraintdef(oid)
  into current_definition
  from pg_constraint
  where conrelid = 'public.fixtures'::regclass
    and conname = 'fixtures_group_id_fkey';

  if current_definition is not null
    and (
      position('FOREIGN KEY (group_id, season_id)' in current_definition) = 0
      or position(
        'REFERENCES season_groups(id, season_id)'
        in current_definition
      ) = 0
      or position('ON DELETE SET NULL (group_id)' in current_definition) = 0
    ) then
    alter table public.fixtures
      drop constraint fixtures_group_id_fkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fixtures'::regclass
      and conname = 'fixtures_group_id_fkey'
  ) then
    alter table public.fixtures
      add constraint fixtures_group_id_fkey
      foreign key (group_id, season_id)
      references public.season_groups(id, season_id)
      on delete set null (group_id)
      not valid;
  end if;
end
$replace_foreign_key$;

alter table public.fixtures
  validate constraint fixtures_group_id_fkey;

commit;

notify pgrst, 'reload schema';
