import { asc, max } from "drizzle-orm";
import { db, dbReady, schema } from "@/db";
import type { SiteRow } from "@/db/schema";
import { runChecks } from "@/lib/checks";

export const maxDuration = 300;

const CONCURRENCY = 3;
/** Skip sites tested recently (a manual or deploy run already counts for today). */
const FRESH_MS = 12 * 60 * 60 * 1000;
/** Stop starting new sites with enough time left for the last batch to finish. */
const BUDGET_MS = 230_000;

/**
 * Daily scheduled run (vercel.json → crons). Vercel sends
 * "Authorization: Bearer $CRON_SECRET" with every cron request.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await dbReady();
  const started = Date.now();

  // Sites that have waited longest go first, so a time-out never starves the same ones.
  const lastRun = await db
    .select({ siteId: schema.checks.siteId, at: max(schema.checks.createdAt) })
    .from(schema.checks)
    .groupBy(schema.checks.siteId);
  const lastBySite = new Map(lastRun.map((r) => [r.siteId, r.at ? new Date(r.at).getTime() : 0]));
  const due = (await db.select().from(schema.sites).orderBy(asc(schema.sites.createdAt)))
    .map((site) => ({ site, last: lastBySite.get(site.id) ?? 0 }))
    .filter(({ last }) => started - last > FRESH_MS)
    .sort((a, b) => a.last - b.last)
    .map(({ site }) => site);

  const queue: SiteRow[] = [...due];
  let checked = 0;
  let failed = 0;
  async function worker() {
    for (let site = queue.shift(); site; site = queue.shift()) {
      if (Date.now() - started > BUDGET_MS) return;
      const outcomes = await runChecks(site, "scheduled");
      checked++;
      if (outcomes.some((o) => o.error)) failed++;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return Response.json({ due: due.length, checked, failed, skipped: queue.length, ms: Date.now() - started });
}
