-- Restrict fixture stages to the values generated and understood by the app.
-- The transaction aborts without changing the schema if legacy data is invalid.

begin;

lock table public.fixtures in access exclusive mode;

do $$
declare
  invalid_stages text;
begin
  select string_agg(format('%s (%s rows)', stage, row_count), ', ' order by stage)
  into invalid_stages
  from (
    select stage, count(*) as row_count
    from public.fixtures
    where stage not in (
      'LEAGUE',
      'GROUP',
      'ROUND_OF_64',
      'ROUND_OF_32',
      'ROUND_OF_16',
      'QUARTER_FINAL',
      'SEMI_FINAL',
      'FINAL'
    )
    group by stage
  ) invalid;

  if invalid_stages is not null then
    raise exception 'Refusing to add fixtures_valid_stage; invalid stages: %', invalid_stages;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fixtures'::regclass
      and conname = 'fixtures_valid_stage'
  ) then
    alter table public.fixtures
      add constraint fixtures_valid_stage
      check (
        stage in (
          'LEAGUE',
          'GROUP',
          'ROUND_OF_64',
          'ROUND_OF_32',
          'ROUND_OF_16',
          'QUARTER_FINAL',
          'SEMI_FINAL',
          'FINAL'
        )
      ) not valid;
  end if;
end;
$$;

alter table public.fixtures
  validate constraint fixtures_valid_stage;

commit;
