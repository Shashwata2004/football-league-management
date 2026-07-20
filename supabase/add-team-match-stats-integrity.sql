begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.fixtures in share row exclusive mode;
lock table public.team_match_stats in share row exclusive mode;

do $audit$
declare
  invalid_participants integer;
  invalid_fixture_pairs integer;
  invalid_stat_totals integer;
begin
  select count(*)
  into invalid_participants
  from public.team_match_stats team_stat
  join public.fixtures fixture
    on fixture.id = team_stat.fixture_id
  where team_stat.team_registration_id is distinct from fixture.home_team_registration_id
    and team_stat.team_registration_id is distinct from fixture.away_team_registration_id;

  select count(*)
  into invalid_fixture_pairs
  from (
    select fixture_id
    from public.team_match_stats
    group by fixture_id
    having count(*) <> 2
      or sum(possession) <> 100
  ) invalid_pair;

  select count(*)
  into invalid_stat_totals
  from public.team_match_stats
  where shots_off_target <> shots - shots_on_target
    or hit_woodwork > shots_off_target
    or big_chances > shots
    or big_chances_missed > big_chances
    or accurate_passes > passes;

  if invalid_participants > 0
    or invalid_fixture_pairs > 0
    or invalid_stat_totals > 0 then
    raise exception using
      message = 'Cannot enforce team match statistics integrity because existing data is invalid.',
      detail = format(
        'invalid_participants=%s, invalid_fixture_pairs=%s, invalid_stat_totals=%s',
        invalid_participants,
        invalid_fixture_pairs,
        invalid_stat_totals
      );
  end if;
end
$audit$;

alter table public.team_match_stats
  drop constraint if exists team_match_stats_shot_consistency_check;

alter table public.team_match_stats
  add constraint team_match_stats_shot_consistency_check
  check (
    shots_off_target = shots - shots_on_target
    and hit_woodwork <= shots_off_target
  )
  not valid;

create index if not exists idx_team_match_stats_team_registration
  on public.team_match_stats(team_registration_id, fixture_id);

create or replace function app_private.enforce_team_match_stats_participant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fixture_home_team_id uuid;
  fixture_away_team_id uuid;
begin
  select
    home_team_registration_id,
    away_team_registration_id
  into
    fixture_home_team_id,
    fixture_away_team_id
  from public.fixtures
  where id = new.fixture_id;

  if not found then
    raise exception using
      errcode = '23503',
      constraint = 'team_match_stats_fixture_id_fkey',
      message = 'The referenced fixture does not exist.';
  end if;

  if new.team_registration_id is distinct from fixture_home_team_id
    and new.team_registration_id is distinct from fixture_away_team_id then
    raise exception using
      errcode = '23514',
      constraint = 'team_match_stats_fixture_participant_check',
      message = 'Team match statistics must belong to the fixture home or away team.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_team_match_stats_participant()
from public, anon, authenticated;

create or replace function app_private.enforce_fixture_team_match_stats_participants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.team_match_stats team_stat
    where team_stat.fixture_id = new.id
      and team_stat.team_registration_id is distinct from new.home_team_registration_id
      and team_stat.team_registration_id is distinct from new.away_team_registration_id
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'fixtures_team_match_stats_participant_check',
      message = 'Fixture participants cannot exclude a team that already has match statistics.';
  end if;

  return new;
end;
$$;

revoke all
on function app_private.enforce_fixture_team_match_stats_participants()
from public, anon, authenticated;

create or replace function app_private.validate_team_match_stats_pair()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_fixture_id uuid;
  affected_fixture_ids uuid[];
  stat_count integer;
  possession_total integer;
begin
  if tg_op = 'DELETE' then
    affected_fixture_ids := array[old.fixture_id];
  elsif tg_op = 'UPDATE' then
    affected_fixture_ids := array[new.fixture_id, old.fixture_id];
  else
    affected_fixture_ids := array[new.fixture_id];
  end if;

  for target_fixture_id in
    select distinct fixture_id
    from unnest(affected_fixture_ids) affected_fixture(fixture_id)
    where fixture_id is not null
  loop
    if not exists (
      select 1
      from public.fixtures
      where id = target_fixture_id
    ) then
      continue;
    end if;

    select count(*), coalesce(sum(possession), 0)
    into stat_count, possession_total
    from public.team_match_stats
    where fixture_id = target_fixture_id;

    if stat_count not in (0, 2) then
      raise exception using
        errcode = '23514',
        constraint = 'team_match_stats_complete_fixture_pair_check',
        message = 'A fixture must have either no team statistics or one row for each participant.';
    end if;

    if stat_count = 2 and possession_total <> 100 then
      raise exception using
        errcode = '23514',
        constraint = 'team_match_stats_possession_total_check',
        message = 'Home and away possession must total 100.';
    end if;
  end loop;

  return null;
end;
$$;

revoke all
on function app_private.validate_team_match_stats_pair()
from public, anon, authenticated;

drop trigger if exists enforce_team_match_stats_participant
on public.team_match_stats;

create trigger enforce_team_match_stats_participant
  before insert or update of fixture_id, team_registration_id
  on public.team_match_stats
  for each row
  execute function app_private.enforce_team_match_stats_participant();

drop trigger if exists enforce_fixture_team_match_stats_participants
on public.fixtures;

create trigger enforce_fixture_team_match_stats_participants
  before update of home_team_registration_id, away_team_registration_id
  on public.fixtures
  for each row
  execute function app_private.enforce_fixture_team_match_stats_participants();

drop trigger if exists validate_team_match_stats_pair
on public.team_match_stats;

create constraint trigger validate_team_match_stats_pair
  after insert or update or delete
  on public.team_match_stats
  deferrable initially deferred
  for each row
  execute function app_private.validate_team_match_stats_pair();

alter table public.team_match_stats
  validate constraint team_match_stats_shot_consistency_check;

commit;

notify pgrst, 'reload schema';
