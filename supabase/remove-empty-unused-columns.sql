-- Remove legacy columns only when they contain no user data.
-- Safe to run repeatedly from the Supabase SQL Editor.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teams'
      and column_name = 'city'
  ) then
    if exists (select 1 from public.teams where city is not null) then
      raise notice 'Keeping public.teams.city because populated values exist.';
    else
      alter table public.teams drop column city;
      raise notice 'Dropped empty, unused column public.teams.city.';
    end if;
  end if;
end
$$;
