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
  resolve(process.cwd(), "../supabase/add-fan-favorite-teams.sql"),
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
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'user_favorite_teams'
  `);
  if (rows.length !== 1 || rows[0].relrowsecurity !== true) {
    throw new Error("user_favorite_teams table missing or RLS not enabled");
  }
  console.log("Fan favorite teams table created and verified (RLS enabled).");
} finally {
  await client.end().catch(() => undefined);
}
