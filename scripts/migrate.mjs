// Applies ./drizzle migrations to the production database (Neon) over HTTP,
// the same driver the app uses. Local dev doesn't need this: PGlite migrates itself.
//
//   npm run db:migrate                  (reads DATABASE_URL from .env.production.local)
//   DATABASE_URL=... npm run db:migrate (or pass it in the environment)
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

nextEnv.loadEnvConfig(process.cwd(), false);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env.production.local or pass it in the environment.");
  process.exit(1);
}

const host = new URL(url).host;
console.log(`Migrating ${host} ...`);
await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
