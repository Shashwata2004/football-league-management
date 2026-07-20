begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace view public.season_standings_report
with (security_invoker = true)
as
with base_standings as (
  select
    standing.*,
    standing.won + standing.drawn + standing.lost as played,
    standing.goals_for - standing.goals_against as goal_difference,
    standing.won * 3 + standing.drawn as points
  from public.standings standing
),
scoped_standings as (
  select
    standing.*,
    group_team.group_id,
    season_group.name as group_name
  from base_standings standing
  left join public.season_group_teams group_team
    on group_team.team_registration_id = standing.team_registration_id
  left join public.season_groups season_group
    on season_group.id = group_team.group_id
),
head_to_head as (
  select
    standing.id as standing_id,
    coalesce(
      sum(
        case
          when fixture.home_team_registration_id = standing.team_registration_id
            and fixture.home_score > fixture.away_score then 3
          when fixture.away_team_registration_id = standing.team_registration_id
            and fixture.away_score > fixture.home_score then 3
          when fixture.home_score = fixture.away_score then 1
          else 0
        end
      ),
      0
    )::integer as points
  from scoped_standings standing
  left join scoped_standings opponent
    on opponent.season_id = standing.season_id
   and opponent.team_registration_id <> standing.team_registration_id
   and opponent.points = standing.points
   and opponent.goal_difference = standing.goal_difference
   and opponent.goals_for = standing.goals_for
   and opponent.group_id is not distinct from standing.group_id
  left join public.fixtures fixture
    on fixture.season_id = standing.season_id
   and fixture.result_confirmed = true
   and fixture.stage in ('LEAGUE', 'GROUP')
   and (
     (
       fixture.home_team_registration_id = standing.team_registration_id
       and fixture.away_team_registration_id = opponent.team_registration_id
     )
     or (
       fixture.away_team_registration_id = standing.team_registration_id
       and fixture.home_team_registration_id = opponent.team_registration_id
     )
   )
  group by standing.id
)
select
  standing.id as standing_id,
  standing.season_id,
  season.league_id,
  league.name as league_name,
  season.name as season_name,
  season.season_year,
  standing.group_id,
  standing.group_name,
  standing.team_registration_id,
  team.id as team_id,
  team.name as team_name,
  team.short_name as team_short_name,
  team.logo_url as team_logo_url,
  standing.played,
  standing.won,
  standing.drawn,
  standing.lost,
  standing.goals_for,
  standing.goals_against,
  standing.goal_difference,
  standing.points,
  standing.fair_play_score,
  standing.admin_draw_rank,
  row_number() over (
    partition by standing.season_id, standing.group_id
    order by
      standing.points desc,
      standing.goal_difference desc,
      standing.goals_for desc,
      head_to_head.points desc,
      standing.fair_play_score desc,
      standing.admin_draw_rank nulls last,
      standing.team_registration_id
  )::integer as position,
  standing.updated_at,
  head_to_head.points as head_to_head_points
from scoped_standings standing
join head_to_head
  on head_to_head.standing_id = standing.id
join public.seasons season
  on season.id = standing.season_id
join public.leagues league
  on league.id = season.league_id
join public.team_registrations team_registration
  on team_registration.id = standing.team_registration_id
 and team_registration.season_id = standing.season_id
join public.teams team
  on team.id = team_registration.team_id;

create or replace view public.team_season_statistics_report
with (security_invoker = true)
as
with match_totals as (
  select
    team_stat.team_registration_id,
    fixture.season_id,
    count(*)::integer as matches_with_statistics,
    coalesce(sum(team_stat.expected_goals), 0::numeric) as total_expected_goals,
    round(coalesce(avg(team_stat.expected_goals), 0::numeric), 2) as average_expected_goals,
    round(coalesce(avg(team_stat.possession), 0::numeric), 2) as average_possession,
    coalesce(sum(team_stat.shots), 0)::integer as total_shots,
    coalesce(sum(team_stat.shots_on_target), 0)::integer as total_shots_on_target,
    coalesce(sum(team_stat.shots_off_target), 0)::integer as total_shots_off_target,
    coalesce(sum(team_stat.big_chances), 0)::integer as total_big_chances,
    coalesce(sum(team_stat.big_chances_missed), 0)::integer as total_big_chances_missed,
    coalesce(sum(team_stat.passes), 0)::integer as total_passes,
    coalesce(sum(team_stat.accurate_passes), 0)::integer as total_accurate_passes,
    coalesce(sum(team_stat.fouls), 0)::integer as total_fouls,
    coalesce(sum(team_stat.yellow_cards), 0)::integer as total_yellow_cards,
    coalesce(sum(team_stat.red_cards), 0)::integer as total_red_cards,
    coalesce(sum(team_stat.corners), 0)::integer as total_corners,
    coalesce(sum(team_stat.offsides), 0)::integer as total_offsides,
    coalesce(sum(team_stat.hit_woodwork), 0)::integer as total_hit_woodwork,
    coalesce(sum(team_stat.tackles), 0)::integer as total_tackles,
    coalesce(sum(team_stat.interceptions), 0)::integer as total_interceptions,
    coalesce(sum(team_stat.blocks), 0)::integer as total_blocks,
    coalesce(sum(team_stat.clearances), 0)::integer as total_clearances,
    coalesce(sum(team_stat.keeper_saves), 0)::integer as total_keeper_saves,
    round(coalesce(avg(team_stat.rating), 0::numeric), 2) as average_team_rating
  from public.team_match_stats team_stat
  join public.fixtures fixture
    on fixture.id = team_stat.fixture_id
  group by team_stat.team_registration_id, fixture.season_id
)
select
  team_registration.season_id,
  season.league_id,
  league.name as league_name,
  season.name as season_name,
  season.season_year,
  team_registration.id as team_registration_id,
  team.id as team_id,
  team.name as team_name,
  team.short_name as team_short_name,
  team.logo_url as team_logo_url,
  coalesce(match_totals.matches_with_statistics, 0) as matches_with_statistics,
  coalesce(match_totals.total_expected_goals, 0::numeric) as total_expected_goals,
  coalesce(match_totals.average_expected_goals, 0::numeric) as average_expected_goals,
  coalesce(match_totals.average_possession, 0::numeric) as average_possession,
  coalesce(match_totals.total_shots, 0) as total_shots,
  coalesce(match_totals.total_shots_on_target, 0) as total_shots_on_target,
  coalesce(match_totals.total_shots_off_target, 0) as total_shots_off_target,
  coalesce(match_totals.total_big_chances, 0) as total_big_chances,
  coalesce(match_totals.total_big_chances_missed, 0) as total_big_chances_missed,
  coalesce(match_totals.total_passes, 0) as total_passes,
  coalesce(match_totals.total_accurate_passes, 0) as total_accurate_passes,
  coalesce(match_totals.total_fouls, 0) as total_fouls,
  coalesce(match_totals.total_yellow_cards, 0) as total_yellow_cards,
  coalesce(match_totals.total_red_cards, 0) as total_red_cards,
  coalesce(match_totals.total_corners, 0) as total_corners,
  coalesce(match_totals.total_offsides, 0) as total_offsides,
  coalesce(match_totals.total_hit_woodwork, 0) as total_hit_woodwork,
  coalesce(match_totals.total_tackles, 0) as total_tackles,
  coalesce(match_totals.total_interceptions, 0) as total_interceptions,
  coalesce(match_totals.total_blocks, 0) as total_blocks,
  coalesce(match_totals.total_clearances, 0) as total_clearances,
  coalesce(match_totals.total_keeper_saves, 0) as total_keeper_saves,
  coalesce(match_totals.average_team_rating, 0::numeric) as average_team_rating,
  coalesce(standing.won + standing.drawn + standing.lost, 0) as played,
  coalesce(standing.won, 0) as won,
  coalesce(standing.drawn, 0) as drawn,
  coalesce(standing.lost, 0) as lost,
  coalesce(standing.goals_for, 0) as goals_for,
  coalesce(standing.goals_against, 0) as goals_against,
  coalesce(standing.goals_for - standing.goals_against, 0) as goal_difference,
  coalesce(standing.won * 3 + standing.drawn, 0) as points
from public.team_registrations team_registration
join public.seasons season
  on season.id = team_registration.season_id
join public.leagues league
  on league.id = season.league_id
join public.teams team
  on team.id = team_registration.team_id
left join match_totals
  on match_totals.team_registration_id = team_registration.id
 and match_totals.season_id = team_registration.season_id
left join public.standings standing
  on standing.team_registration_id = team_registration.id
 and standing.season_id = team_registration.season_id;

drop view if exists public.match_summary_report;

create view public.match_summary_report
with (security_invoker = true)
as
select
  fixture.id as fixture_id,
  fixture.season_id,
  fixture.league_id,
  league.name as league_name,
  season.name as season_name,
  season.season_year,
  fixture.stage,
  fixture.round_no,
  fixture.matchday_number,
  fixture.group_name,
  fixture.kickoff_at,
  fixture.status,
  fixture.result_confirmed,
  fixture.home_team_registration_id,
  home_team.name as home_team_name,
  home_team.short_name as home_team_short_name,
  home_team.logo_url as home_team_logo_url,
  fixture.away_team_registration_id,
  away_team.name as away_team_name,
  away_team.short_name as away_team_short_name,
  away_team.logo_url as away_team_logo_url,
  fixture.home_score,
  fixture.away_score,
  fixture.extra_time_played,
  fixture.penalties_home,
  fixture.penalties_away,
  fixture.winner_team_registration_id,
  winner_team.name as winner_team_name,
  fixture.penalty_winner_team_registration_id,
  penalty_winner_team.name as penalty_winner_team_name,
  home_stat.expected_goals as home_expected_goals,
  away_stat.expected_goals as away_expected_goals,
  home_stat.possession as home_possession,
  away_stat.possession as away_possession,
  home_stat.shots as home_shots,
  away_stat.shots as away_shots,
  home_stat.shots_on_target as home_shots_on_target,
  away_stat.shots_on_target as away_shots_on_target,
  home_stat.rating as home_team_rating,
  away_stat.rating as away_team_rating,
  fixture.finalized_at,
  fixture.updated_at
from public.fixtures fixture
join public.seasons season
  on season.id = fixture.season_id
left join public.leagues league
  on league.id = fixture.league_id
left join public.team_registrations home_registration
  on home_registration.id = fixture.home_team_registration_id
left join public.teams home_team
  on home_team.id = home_registration.team_id
left join public.team_registrations away_registration
  on away_registration.id = fixture.away_team_registration_id
left join public.teams away_team
  on away_team.id = away_registration.team_id
left join public.team_registrations winner_registration
  on winner_registration.id = fixture.winner_team_registration_id
left join public.teams winner_team
  on winner_team.id = winner_registration.team_id
left join public.team_registrations penalty_winner_registration
  on penalty_winner_registration.id = fixture.penalty_winner_team_registration_id
left join public.teams penalty_winner_team
  on penalty_winner_team.id = penalty_winner_registration.team_id
left join public.team_match_stats home_stat
  on home_stat.fixture_id = fixture.id
 and home_stat.team_registration_id = fixture.home_team_registration_id
left join public.team_match_stats away_stat
  on away_stat.fixture_id = fixture.id
 and away_stat.team_registration_id = fixture.away_team_registration_id;

comment on view public.season_standings_report is
  'Canonical read-only standings model. Derived totals, tie-breaks, labels, and positions are calculated from normalized base relations.';
comment on view public.team_season_statistics_report is
  'Secure read-only team season aggregates, including summed expected goals.';
comment on view public.match_summary_report is
  'Secure read-only fixture summary with participant labels and team match statistics.';

revoke all on public.season_standings_report from public, anon, authenticated;
revoke all on public.team_season_statistics_report from public, anon, authenticated;
revoke all on public.match_summary_report from public, anon, authenticated;
revoke all on public.season_standings_report from service_role;
revoke all on public.team_season_statistics_report from service_role;
revoke all on public.match_summary_report from service_role;

grant select on public.season_standings_report to service_role;
grant select on public.team_season_statistics_report to service_role;
grant select on public.match_summary_report to service_role;

commit;

notify pgrst, 'reload schema';
