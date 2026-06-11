import { defineConfig } from "drizzle-kit";
import { loadLocalEnv } from "./scripts/load-env";

loadLocalEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Only `drizzle-kit migrate` needs a live connection; `generate` works
    // without one, so fall back to a placeholder instead of throwing on import.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
  },
  migrations: {
    // Managed Postgres (e.g. PlanetScale) often denies CREATE SCHEMA, so keep
    // the migrations journal in `public` instead of Drizzle's own schema.
    table: "__drizzle_migrations",
    schema: "public",
  },
});
