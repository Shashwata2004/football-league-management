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
  resolve(process.cwd(), "../supabase/yellow-card-suspension-rule.sql"),
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
    select column_default, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'seasons'
      and column_name = 'yellow_card_suspension_threshold'
  `);
  if (rows.length !== 1 || rows[0].is_nullable !== "NO") {
    throw new Error("yellow_card_suspension_threshold was not applied correctly");
  }
  console.log("Yellow-card suspension rule applied and verified.");
} finally {
  await client.end().catch(() => undefined);
}
