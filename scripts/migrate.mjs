import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const isVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
const isProductionDeployment = isVercel && process.env.VERCEL_ENV === "production";
const explicitlyEnabledLocally = !isVercel && process.env.RUN_DB_MIGRATIONS === "true";

if (!isProductionDeployment && !explicitlyEnabledLocally) {
  console.log("[db:migrate] Skipped. Migrations run automatically on Vercel Production deployments.");
  process.exit(0);
}

const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!connectionString) {
  console.error("[db:migrate] Missing POSTGRES_URL / POSTGRES_URL_NON_POOLING. Connect a Supabase database through Vercel Marketplace before deploying.");
  process.exit(1);
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(currentDir, "../supabase/migrations");
const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  console.log("[db:migrate] No migration files found.");
  process.exit(0);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 60000,
  application_name: "moota-webhook-lab-migrations",
});

try {
  await client.connect();
  // A transaction-level advisory lock also works with Supabase transaction-pooler URLs.
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock($1, $2)", [734921, 1]);

  await client.query(`
    create schema if not exists private;
    revoke all on schema private from public;
    create table if not exists private.schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
    revoke all on all tables in schema private from public;
  `);

  for (const filename of migrationFiles) {
    const fullPath = path.join(migrationsDir, filename);
    const sql = await readFile(fullPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "select checksum from private.schema_migrations where filename = $1",
      [filename],
    );

    if (existing.rowCount > 0) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Migration ${filename} was changed after it had already been applied. Add a new migration file instead.`);
      }
      console.log(`[db:migrate] Already applied: ${filename}`);
      continue;
    }

    console.log(`[db:migrate] Applying: ${filename}`);
    await client.query(sql);
    await client.query(
      "insert into private.schema_migrations (filename, checksum) values ($1, $2)",
      [filename, checksum],
    );
    console.log(`[db:migrate] Applied: ${filename}`);
  }

  await client.query("commit");
  console.log("[db:migrate] Database schema is up to date.");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error("[db:migrate] Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
