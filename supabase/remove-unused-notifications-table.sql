-- Atomic cleanup for the unused legacy notifications table.
-- The transaction refuses to drop the table if any row exists.

begin;

do $$
begin
  if to_regclass('public.notifications') is null then
    return;
  end if;

  lock table public.notifications in access exclusive mode;

  if exists (select 1 from public.notifications limit 1) then
    raise exception 'Refusing to drop public.notifications because it contains data';
  end if;

  drop table public.notifications restrict;
end;
$$;

commit;
