begin;

lock table public.fixtures in share row exclusive mode;

do $audit$
declare
  invalid_winners integer;
  invalid_penalty_winners integer;
begin
  select count(*)
  into invalid_winners
  from public.fixtures
  where winner_team_registration_id is not null
    and (
      home_team_registration_id is null
      or winner_team_registration_id <> home_team_registration_id
    )
    and (
      away_team_registration_id is null
      or winner_team_registration_id <> away_team_registration_id
    );

  select count(*)
  into invalid_penalty_winners
  from public.fixtures
  where penalty_winner_team_registration_id is not null
    and (
      home_team_registration_id is null
      or penalty_winner_team_registration_id <> home_team_registration_id
    )
    and (
      away_team_registration_id is null
      or penalty_winner_team_registration_id <> away_team_registration_id
    );

  if invalid_winners > 0 or invalid_penalty_winners > 0 then
    raise exception using
      message = 'Cannot enforce fixture winner integrity because existing data is invalid.',
      detail = format(
        'invalid_winners=%s, invalid_penalty_winners=%s',
        invalid_winners,
        invalid_penalty_winners
      );
  end if;
end
$audit$;

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fixtures'::regclass
      and conname = 'fixtures_winner_is_participant_check'
  ) then
    alter table public.fixtures
      add constraint fixtures_winner_is_participant_check
      check (
        winner_team_registration_id is null
        or (
          home_team_registration_id is not null
          and winner_team_registration_id = home_team_registration_id
        )
        or (
          away_team_registration_id is not null
          and winner_team_registration_id = away_team_registration_id
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fixtures'::regclass
      and conname = 'fixtures_penalty_winner_is_participant_check'
  ) then
    alter table public.fixtures
      add constraint fixtures_penalty_winner_is_participant_check
      check (
        penalty_winner_team_registration_id is null
        or (
          home_team_registration_id is not null
          and penalty_winner_team_registration_id = home_team_registration_id
        )
        or (
          away_team_registration_id is not null
          and penalty_winner_team_registration_id = away_team_registration_id
        )
      )
      not valid;
  end if;
end
$constraints$;

alter table public.fixtures
  validate constraint fixtures_winner_is_participant_check;

alter table public.fixtures
  validate constraint fixtures_penalty_winner_is_participant_check;

commit;

notify pgrst, 'reload schema';
