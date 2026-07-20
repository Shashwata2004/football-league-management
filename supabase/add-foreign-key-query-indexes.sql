begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Foreign-key indexes prevent full child-table scans during joins and parent
-- updates/deletes. Compound suffixes also match the application's common
-- season, fixture, and chronological access patterns.
create index if not exists lineup_players_player_registration_idx
  on public.lineup_players(player_registration_id, lineup_id);

create index if not exists player_registrations_created_by_manager_idx
  on public.player_season_registrations(created_by_manager_id)
  where created_by_manager_id is not null;

create index if not exists player_registrations_player_idx
  on public.player_season_registrations(player_id);

create index if not exists player_registrations_removed_by_idx
  on public.player_season_registrations(removed_by)
  where removed_by is not null;

create index if not exists player_registrations_reviewed_by_idx
  on public.player_season_registrations(reviewed_by)
  where reviewed_by is not null;

create index if not exists player_registrations_suspended_by_idx
  on public.player_season_registrations(suspended_by)
  where suspended_by is not null;

create index if not exists player_abilities_generated_by_admin_idx
  on public.player_abilities(generated_by_admin_id)
  where generated_by_admin_id is not null;

create index if not exists player_abilities_team_season_idx
  on public.player_abilities(team_registration_id, season_id);

create index if not exists player_season_stats_player_season_idx
  on public.player_season_stats(player_registration_id, season_id);

create index if not exists match_substitutions_player_in_fixture_idx
  on public.match_substitutions(player_in_registration_id, fixture_id);

create index if not exists match_substitutions_player_out_fixture_idx
  on public.match_substitutions(player_out_registration_id, fixture_id);

create index if not exists match_substitutions_team_fixture_idx
  on public.match_substitutions(team_registration_id, fixture_id);

create index if not exists manager_messages_created_by_idx
  on public.manager_messages(created_by)
  where created_by is not null;

create index if not exists manager_messages_manager_created_idx
  on public.manager_messages(manager_id, created_at desc);

create index if not exists lineups_manager_created_idx
  on public.lineups(manager_id, created_at desc);

create index if not exists lineups_reviewed_by_idx
  on public.lineups(reviewed_by)
  where reviewed_by is not null;

create index if not exists lineups_season_created_idx
  on public.lineups(season_id, created_at desc);

create index if not exists fixtures_home_team_schedule_idx
  on public.fixtures(home_team_registration_id, season_id, kickoff_at)
  where home_team_registration_id is not null;

create index if not exists fixtures_away_team_schedule_idx
  on public.fixtures(away_team_registration_id, season_id, kickoff_at)
  where away_team_registration_id is not null;

create index if not exists fixtures_finalized_by_idx
  on public.fixtures(finalized_by)
  where finalized_by is not null;

create index if not exists fixtures_league_season_idx
  on public.fixtures(league_id, season_id)
  where league_id is not null;

create index if not exists fixtures_penalty_winner_idx
  on public.fixtures(penalty_winner_team_registration_id)
  where penalty_winner_team_registration_id is not null;

create index if not exists fixtures_winner_idx
  on public.fixtures(winner_team_registration_id)
  where winner_team_registration_id is not null;

create index if not exists manager_preferences_season_manager_idx
  on public.manager_team_preferences(season_id, manager_id);

create index if not exists standings_team_season_idx
  on public.standings(team_registration_id, season_id);

create index if not exists team_registrations_removed_by_idx
  on public.team_registrations(removed_by)
  where removed_by is not null;

create index if not exists team_registrations_reviewed_by_idx
  on public.team_registrations(reviewed_by)
  where reviewed_by is not null;

create index if not exists teams_manager_created_idx
  on public.teams(manager_id, created_at desc);

create index if not exists player_suspensions_season_status_idx
  on public.player_suspensions(season_id, status);

create index if not exists seasons_champion_team_idx
  on public.seasons(champion_team_registration_id, id)
  where champion_team_registration_id is not null;

commit;
