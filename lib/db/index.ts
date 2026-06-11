import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Cached on globalThis so dev-server hot reloads reuse the pool instead of
// leaking connections.
const globalForDb = globalThis as unknown as {
  reviewsDb?: NodePgDatabase<typeof schema>;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): NodePgDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  globalForDb.reviewsDb ??= drizzle(
    new Pool({ connectionString, max: 5 }),
    { schema },
  );

  return globalForDb.reviewsDb;
}
