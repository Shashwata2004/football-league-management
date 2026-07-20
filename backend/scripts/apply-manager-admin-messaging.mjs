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
  resolve(process.cwd(), "../supabase/add-manager-admin-messaging.sql"),
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
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'manager_messages'
      and column_name in ('sender_role', 'parent_message_id')
  `);
  const present = new Set(rows.map((row) => row.column_name));
  if (!present.has("sender_role") || !present.has("parent_message_id")) {
    throw new Error(
      "manager_messages missing sender_role or parent_message_id after migration",
    );
  }
  console.log(
    "Manager/admin messaging columns added and verified (sender_role, parent_message_id).",
  );
} finally {
  await client.end().catch(() => undefined);
}
