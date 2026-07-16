import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env") });

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("SUPABASE_DB_URL is missing in backend/.env");
  process.exit(1);
}

const sql = [
  readFileSync(
    resolve(process.cwd(), "../supabase/update-season-flow.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/admin-dashboard-flow.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(
      process.cwd(),
      "../supabase/add-group-assignment-season-consistency.sql",
    ),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/team-player-dashboard-flow.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/advanced-simulation-flow.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/manager-squad-flow.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(
      process.cwd(),
      "../supabase/add-player-registration-season-consistency.sql",
    ),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/fixture-generation-flow.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(
      process.cwd(),
      "../supabase/add-fixture-team-season-consistency.sql",
    ),
    "utf8",
  ),
  readFileSync(
    resolve(
      process.cwd(),
      "../supabase/add-fixture-winner-integrity-constraints.sql",
    ),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/manager-lineup-builder-flow.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/add-lineup-season-consistency.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(
      process.cwd(),
      "../supabase/add-lineup-player-integrity-constraints.sql",
    ),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/matchday-team-stats-flow.sql"),
    "utf8",
  ),
  readFileSync(
    resolve(process.cwd(), "../supabase/remove-empty-unused-columns.sql"),
    "utf8",
  ),
].join("\n\n");
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  const { rows: columns } = await client.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'leagues' and column_name in ('short_name', 'logo_url', 'organizer_name'))
        or
        (table_name = 'teams' and column_name in (
          'logo_url', 'home_jersey_url', 'away_jersey_url', 'gk_home_jersey_url', 'gk_away_jersey_url'
        ))
        or
        (table_name = 'players' and column_name = 'avatar_url')
        or
        (table_name = 'team_registrations' and column_name in ('removed_by', 'removed_at', 'removal_reason'))
        or
        (table_name = 'seasons' and column_name in (
          'phase', 'total_teams', 'season_year', 'registration_start_date', 'registration_deadline',
          'min_players_per_team', 'max_players_per_team', 'lineup_size', 'substitute_limit',
          'lineup_submission_deadline_hours', 'teams_per_group', 'best_third_place_teams', 'total_knockout_teams',
          'round_format', 'fixture_status'
        ))
        or
        (table_name = 'player_season_registrations' and column_name in (
          'ability_rating', 'preferred_foot', 'player_status', 'removed_by', 'removed_at',
          'removal_reason', 'suspended_by', 'suspended_at', 'suspension_reason',
          'player_code', 'football_position', 'position_category', 'identity_mode',
          'is_generated', 'created_by_manager_id', 'submitted_at', 'updated_at'
        ))
        or
        (table_name = 'manager_messages' and column_name in ('player_registration_id', 'fixture_id'))
        or
        (table_name = 'player_season_stats' and column_name in (
          'starts', 'minutes_played', 'shots', 'shots_on_target', 'chances_created', 'big_chances_created',
          'total_passes', 'accurate_passes', 'dribbles_attempted', 'successful_dribbles',
          'dribbled_past', 'dispossessed', 'tackles', 'interceptions', 'best_match_rating',
          'lowest_match_rating', 'player_of_match_count'
        ))
        or
        (table_name = 'player_abilities' and column_name in (
          'rating_tier', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
          'pace', 'stamina', 'shot_stopping', 'reflexes', 'positioning', 'handling',
          'diving', 'distribution', 'communication', 'overall_rating'
        ))
        or
        (table_name = 'lineups' and column_name in (
          'season_id', 'manager_id', 'playing_style', 'captain_id', 'submitted_at',
          'confirmed_at', 'blocked_reason', 'updated_at'
        ))
        or
        (table_name = 'lineup_players' and column_name in (
          'football_position', 'shirt_number', 'is_captain', 'slot_key',
          'display_role', 'player_natural_position', 'is_substitute', 'display_order'
        ))
        or
        (table_name = 'fixtures' and column_name in (
          'league_id', 'group_id', 'matchday_number', 'home_source', 'away_source',
          'result_confirmed', 'winner_team_registration_id', 'updated_at',
          'simulation_seed', 'simulated_at', 'extra_time_played', 'penalty_winner_team_registration_id',
          'penalties_home', 'penalties_away'
        ))
        or
        (table_name = 'team_match_stats' and column_name in ('offsides', 'rating'))
        or
        (table_name = 'team_match_stats' and column_name in (
          'expected_goals', 'shots_off_target', 'hit_woodwork', 'tackles', 'interceptions', 'blocks', 'clearances', 'keeper_saves'
        ))
        or
        (table_name = 'seasons' and column_name in ('active_matchday_number', 'active_matchday_started_at'))
        or
        (table_name = 'player_match_stats' and column_name in (
          'position_played', 'shots_on_target', 'chances_created', 'big_chances_created', 'big_chances_missed',
          'dispossessed', 'interceptions', 'clearances', 'blocks', 'fouls_committed',
          'goals_conceded', 'accurate_long_balls', 'diving_saves', 'saves_inside_box', 'dribbled_past',
          'clean_sheet', 'penalty_scored', 'penalty_missed', 'penalty_saved_for_gk'
        ))
      )
    order by table_name, column_name;
  `);
  const { rows: tables } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'manager_messages',
        'season_groups',
        'season_group_teams',
        'player_abilities',
        'match_injuries',
        'match_substitutions',
        'manager_team_preferences',
        'player_suspensions'
      )
    order by table_name;
  `);
  console.log("Database season/admin-dashboard flow migration applied.");
  console.table(columns);
  console.table(tables);
} finally {
  await client.end().catch(() => undefined);
}
