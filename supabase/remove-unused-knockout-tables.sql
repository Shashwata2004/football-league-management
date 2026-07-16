-- Atomic cleanup for legacy knockout tables superseded by staged fixtures.
-- The transaction refuses to drop either table if any row exists.

begin;

do $$
begin
  if to_regclass('public.knockout_matches') is not null then
    lock table public.knockout_matches in access exclusive mode;

    if exists (select 1 from public.knockout_matches limit 1) then
      raise exception 'Refusing to drop public.knockout_matches because it contains data';
    end if;
  end if;

  if to_regclass('public.knockout_brackets') is not null then
    lock table public.knockout_brackets in access exclusive mode;

    if exists (select 1 from public.knockout_brackets limit 1) then
      raise exception 'Refusing to drop public.knockout_brackets because it contains data';
    end if;
  end if;

  drop table if exists public.knockout_matches restrict;
  drop table if exists public.knockout_brackets restrict;
end;
$$;

commit;
