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
  readFileSync(resolve(process.cwd(), "../supabase/update-season-flow.sql"), "utf8"),
  readFileSync(resolve(process.cwd(), "../supabase/admin-dashboard-flow.sql"), "utf8"),
  readFileSync(resolve(process.cwd(), "../supabase/team-player-dashboard-flow.sql"), "utf8"),
  readFileSync(resolve(process.cwd(), "../supabase/advanced-simulation-flow.sql"), "utf8"),
  readFileSync(resolve(process.cwd(), "../supabase/manager-squad-flow.sql"), "utf8")
].join("\n\n");
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
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
        (table_name = 'teams' and column_name = 'logo_url')
        or
        (table_name = 'players' and column_name = 'avatar_url')
        or
        (table_name = 'team_registrations' and column_name in ('removed_by', 'removed_at', 'removal_reason'))
        or
        (table_name = 'seasons' and column_name in (
          'phase', 'total_teams', 'season_year', 'registration_start_date', 'registration_deadline',
          'min_players_per_team', 'max_players_per_team', 'lineup_size', 'substitute_limit',
          'lineup_submission_deadline_hours', 'teams_per_group', 'best_third_place_teams', 'total_knockout_teams'
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
          'starts', 'minutes_played', 'shots', 'shots_on_target', 'chances_created',
          'total_passes', 'accurate_passes', 'dribbles_attempted', 'successful_dribbles',
          'dispossessed', 'tackles', 'interceptions', 'best_match_rating',
          'lowest_match_rating', 'player_of_match_count'
        ))
        or
        (table_name = 'player_abilities' and column_name in (
          'rating_tier', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
          'pace', 'stamina', 'shot_stopping', 'reflexes', 'positioning', 'handling',
          'diving', 'distribution', 'communication', 'overall_rating'
        ))
        or
        (table_name = 'lineup_players' and column_name in ('football_position', 'shirt_number', 'is_captain'))
        or
        (table_name = 'fixtures' and column_name in (
          'simulation_seed', 'simulated_at', 'extra_time_played', 'penalty_winner_team_registration_id',
          'penalties_home', 'penalties_away'
        ))
        or
        (table_name = 'team_match_stats' and column_name = 'offsides')
        or
        (table_name = 'player_match_stats' and column_name in (
          'position_played', 'shots_on_target', 'chances_created', 'big_chances_missed',
          'dispossessed', 'interceptions', 'clearances', 'blocks', 'fouls_committed',
          'goals_conceded', 'accurate_long_balls', 'diving_saves', 'saves_inside_box'
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
        'knockout_brackets',
        'knockout_matches',
        'player_abilities',
        'match_substitutions'
      )
    order by table_name;
  `);
  console.log("Database season/admin-dashboard flow migration applied.");
  console.table(columns);
  console.table(tables);
} finally {
  await client.end().catch(() => undefined);
}
