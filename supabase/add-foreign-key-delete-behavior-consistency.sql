begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.lineups in share row exclusive mode;

do $audit$
declare
  orphaned_managers integer;
begin
  select count(*)
  into orphaned_managers
  from public.lineups lineup
  left join public.profiles profile
    on profile.id = lineup.manager_id
  where profile.id is null;

  if orphaned_managers > 0 then
    raise exception using
      message = 'Cannot correct lineup manager delete behavior because existing data is invalid.',
      detail = format('orphaned_managers=%s', orphaned_managers);
  end if;
end
$audit$;

-- manager_id is mandatory, so ON DELETE SET NULL can never complete. Restrict
-- profile deletion while a lineup still provides an audit trail for that
-- manager. Team-registration deletion continues to cascade through the
-- separate lineup team/season/manager composite foreign key.
alter table public.lineups
  drop constraint if exists lineups_manager_id_fkey;

alter table public.lineups
  add constraint lineups_manager_id_fkey
  foreign key (manager_id)
  references public.profiles(id)
  on delete restrict
  not valid;

alter table public.lineups
  validate constraint lineups_manager_id_fkey;

commit;

notify pgrst, 'reload schema';
