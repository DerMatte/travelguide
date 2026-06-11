#!/usr/bin/env tsx
/**
 * Boot a disposable local Postgres for development — no Docker or system
 * install needed (binaries ship with the `embedded-postgres` dev dependency).
 *
 * Data persists in .dev-postgres/ between runs (gitignored).
 *
 * Usage:
 *   pnpm db:dev          # starts Postgres on port 54329 and stays running
 *
 * Then in another terminal:
 *   DATABASE_URL=postgres://dev:dev@127.0.0.1:54329/honestairport pnpm db:migrate
 *   ...and put the same DATABASE_URL in .env.local for `pnpm dev`.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = 54329;
const DATA_DIR = path.join(process.cwd(), ".dev-postgres");
const DATABASE = "honestairport";

async function main() {
  const initialized = existsSync(path.join(DATA_DIR, "PG_VERSION"));

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "dev",
    password: "dev",
    port: PORT,
    persistent: true,
  });

  if (!initialized) {
    await pg.initialise();
  }

  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [DATABASE],
  );
  if (rowCount === 0) {
    await pg.createDatabase(DATABASE);
  }
  await client.end();

  console.log(`\nDev Postgres running.\n`);
  console.log(`  DATABASE_URL=postgres://dev:dev@127.0.0.1:${PORT}/${DATABASE}\n`);
  console.log(`Press Ctrl+C to stop.`);

  const shutdown = async () => {
    console.log("\nStopping dev Postgres…");
    await pg.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
