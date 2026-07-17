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
  resolve(process.cwd(), "../supabase/fix-lineup-validation-security-definer.sql"),
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
    select prosecdef
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'app_private'
      and pg_proc.proname = 'validate_lineup_after_change'
  `);
  if (rows.length !== 1 || rows[0].prosecdef !== true) {
    throw new Error("validate_lineup_after_change is not SECURITY DEFINER");
  }
  console.log("Lineup validation trigger hardened to SECURITY DEFINER and verified.");
} finally {
  await client.end().catch(() => undefined);
}
