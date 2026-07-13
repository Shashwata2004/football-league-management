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
  resolve(process.cwd(), "../supabase/lineup-set-piece-takers.sql"),
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
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'lineup_set_piece_takers'
  `);
  if (rows.length !== 1) {
    throw new Error("lineup_set_piece_takers was not created");
  }
  console.log("Lineup set-piece taker schema applied and verified.");
} finally {
  await client.end().catch(() => undefined);
}
