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

const sql = readFileSync(
  resolve(process.cwd(), "../supabase/runtime-schema-hotfix.sql"),
  "utf8",
);

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'seasons' and column_name in ('active_matchday_number', 'active_matchday_started_at'))
        or (table_name = 'team_match_stats' and column_name in ('blocks', 'expected_goals', 'shots_off_target', 'hit_woodwork', 'tackles', 'interceptions', 'clearances', 'keeper_saves'))
        or (table_name = 'player_match_stats' and column_name in ('dribbled_past', 'clean_sheet', 'penalty_scored', 'penalty_missed', 'penalty_saved_for_gk'))
      )
    order by table_name, column_name;
  `);
  console.log("Runtime schema hotfix applied.");
  console.table(rows);
} finally {
  await client.end().catch(() => undefined);
}
