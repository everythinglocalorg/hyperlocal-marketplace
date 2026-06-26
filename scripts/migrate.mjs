// Apply a .sql file to the database using DATABASE_URL from .env.local.
// Usage: node scripts/migrate.mjs supabase/SOME_FILE.sql
import { readFileSync } from "node:fs";
import { Client } from "pg";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}

async function main() {
  loadEnv();
  const file = process.argv[2];
  if (!file) { console.error("Usage: node scripts/migrate.mjs <file.sql>"); process.exit(1); }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set in .env.local"); process.exit(1); }

  const sql = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Applying ${file} …`);
  await client.query(sql);
  await client.end();
  console.log("✓ Migration applied successfully.");
}

main().catch((e) => { console.error("✗ Migration failed:", e.message); process.exit(1); });
