begin;

lock table public.players in access exclusive mode;

do $$
declare
  hidden_attribute_rows_exist boolean;
  invalid_nationality_exists boolean;
begin
  if to_regclass('public.player_hidden_attributes') is not null then
    execute
      'lock table public.player_hidden_attributes in access exclusive mode';
    execute
      'select exists (select 1 from public.player_hidden_attributes)'
      into hidden_attribute_rows_exist;

    if hidden_attribute_rows_exist then
      raise exception using
        errcode = '23514',
        message = 'Cannot remove player_hidden_attributes because it contains data.';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name = 'nationality'
  ) then
    execute $query$
      select exists (
        select 1
        from public.players
        where nationality is null
           or lower(trim(nationality)) <> 'bangladesh'
      )
    $query$
    into invalid_nationality_exists;

    if invalid_nationality_exists then
      raise exception using
        errcode = '23514',
        message = 'Cannot remove players.nationality because a player is not explicitly Bangladeshi.';
    end if;
  end if;
end
$$;

drop table if exists public.player_hidden_attributes;

alter table public.players
  drop column if exists nationality;

commit;

notify pgrst, 'reload schema';
