import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

/**
 * One database API, two backends:
 * - DATABASE_URL set (production, e.g. Neon): serverless Postgres over HTTP.
 * - Not set, or PGLITE_DIR set (local dev, tests): PGlite, a real Postgres compiled to WASM, stored in
 *   ./.data. No install, no account, and migrations run automatically.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

interface DbState {
  db: Database;
  ready: Promise<void>;
}

const globalForDb = globalThis as unknown as { __vitalsDb?: DbState };

function create(): DbState {
  // An explicit PGLITE_DIR (the end-to-end test server) always wins, so tests can
  // never write to the real database even when DATABASE_URL is in an env file.
  const url = process.env.PGLITE_DIR ? undefined : process.env.DATABASE_URL;
  if (url) {
    // Production migrations run as a deploy step (npm run db:migrate).
    return { db: drizzleNeon(neon(url), { schema }) as unknown as Database, ready: Promise.resolve() };
  }

  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const db = drizzlePglite(new PGlite(dataDir), { schema });
  const ready = migratePglite(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return { db: db as unknown as Database, ready };
}

/**
 * Created on first use, not at import, so `next build` never opens the
 * database. One instance is reused across hot reloads: two PGlite instances on
 * the same folder would corrupt it.
 */
function state(): DbState {
  return (globalForDb.__vitalsDb ??= create());
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    return Reflect.get(state().db, prop);
  },
});

/** Await before the first query in any entry point (route handler, server action, page). */
export function dbReady() {
  return state().ready;
}

export { schema };
