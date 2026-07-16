begin;

lock table public.fixtures in share mode;
lock table public.team_match_stats in share mode;

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

comment on view public.match_summary_report is
  'Secure read-only fixture summary with participant labels and team match statistics.';

revoke all on public.match_summary_report from public, anon, authenticated;
grant select on public.match_summary_report to service_role;

commit;

notify pgrst, 'reload schema';
