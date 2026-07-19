begin;

lock table public.player_match_stats in share row exclusive mode;
lock table public.team_match_stats in share row exclusive mode;
lock table public.player_season_stats in share row exclusive mode;

-- Historical simulations could allocate every attempted pass as accurate to
-- one player. Bring only rows above the absolute 98% ceiling back to the
-- standard 95% ceiling. Existing legitimate rare performances at or below
-- 98% are preserved.
with corrected as (
  select
    id,
    greatest(0, floor(passes * 0.95)::integer) as accurate_passes
  from public.player_match_stats
  where passes > 0
    and accurate_passes * 100 > passes * 98
)
update public.player_match_stats as player_stat
set
  accurate_passes = corrected.accurate_passes,
  accurate_long_balls = case
    when player_stat.accurate_long_balls is null then null
    else least(player_stat.accurate_long_balls, corrected.accurate_passes)
  end
from corrected
where player_stat.id = corrected.id;

-- Keep stored team totals aligned with the corrected player rows.
with totals as (
  select
    player_stat.fixture_id,
    registration.team_registration_id,
    coalesce(sum(player_stat.accurate_passes), 0)::integer as accurate_passes
  from public.player_match_stats as player_stat
  join public.player_season_registrations as registration
    on registration.id = player_stat.player_registration_id
  group by player_stat.fixture_id, registration.team_registration_id
)
update public.team_match_stats as team_stat
set accurate_passes = totals.accurate_passes
from totals
where team_stat.fixture_id = totals.fixture_id
  and team_stat.team_registration_id = totals.team_registration_id;

-- The fan and leaderboard APIs use this stored season aggregate.
with totals as (
  select
    player_registration_id,
    coalesce(sum(accurate_passes), 0)::integer as accurate_passes
  from public.player_match_stats
  group by player_registration_id
)
update public.player_season_stats as season_stat
set
  accurate_passes = totals.accurate_passes,
  updated_at = now()
from totals
where season_stat.player_registration_id = totals.player_registration_id;

alter table public.player_match_stats
  drop constraint if exists player_match_stats_pass_accuracy_cap_check;

alter table public.player_match_stats
  add constraint player_match_stats_pass_accuracy_cap_check
  check (
    passes = 0
    or accurate_passes * 100 <= passes * 98
  ) not valid;

alter table public.player_match_stats
  validate constraint player_match_stats_pass_accuracy_cap_check;

commit;
