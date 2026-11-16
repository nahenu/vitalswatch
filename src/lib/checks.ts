import "server-only";
import { and, desc, eq, isNotNull, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SiteRow } from "@/db/schema";
import { detectRegression } from "./compare";
import { regressionEmail, sendEmail } from "./email";
import { PsiError, runPageSpeed } from "./psi";
import { site as app } from "./site";
import type { Strategy, Trigger } from "./vitals";

const STRATEGIES: Strategy[] = ["mobile", "desktop"];
const ALERT_COOLDOWN_MS = 20 * 60 * 60 * 1000;

export interface RunOutcome {
  strategy: Strategy;
  score: number | null;
  error: string | null;
}

/**
 * Tests a site on mobile and desktop at once, stores both runs (failed runs
 * too, so the history shows gaps honestly), then checks for a regression.
 */
export async function runChecks(site: SiteRow, trigger: Trigger): Promise<RunOutcome[]> {
  const outcomes = await Promise.all(
    STRATEGIES.map(async (strategy): Promise<RunOutcome> => {
      try {
        const result = await runPageSpeed(site.url, strategy);
        const [row] = await db
          .insert(schema.checks)
          .values({
            siteId: site.id,
            strategy,
            trigger,
            score: result.score,
            ...result.lab,
            field: result.field,
            opportunities: result.opportunities,
            error: result.error,
          })
          .returning({ id: schema.checks.id });
        if (result.diagnostics) {
          await db.insert(schema.checkDetails).values({ checkId: row.id, siteId: site.id, strategy, data: result.diagnostics });
          await pruneDetails(site.id, strategy).catch((e) => console.error("[checks] prune", e));
        }
        return { strategy, score: result.score, error: result.error };
      } catch (error) {
        const message = error instanceof PsiError ? error.message : "Something went wrong while testing this page.";
        if (!(error instanceof PsiError)) console.error("[checks]", error);
        await db.insert(schema.checks).values({ siteId: site.id, strategy, trigger, error: message });
        return { strategy, score: null, error: message };
      }
    }),
  );

  const mobile = outcomes.find((o) => o.strategy === "mobile");
  if (mobile?.score != null) await maybeAlert(site, mobile.score).catch((e) => console.error("[alerts]", e));
  return outcomes;
}

/** Diagnostics are ~100x bigger than the numbers: keep only the latest runs' worth per site and device. */
const KEEP_DETAILS = 8;

async function pruneDetails(siteId: string, strategy: Strategy) {
  const keep = await db
    .select({ id: schema.checkDetails.checkId })
    .from(schema.checkDetails)
    .where(and(eq(schema.checkDetails.siteId, siteId), eq(schema.checkDetails.strategy, strategy)))
    .orderBy(desc(schema.checkDetails.createdAt))
    .limit(KEEP_DETAILS);
  if (keep.length < KEEP_DETAILS) return;
  await db
    .delete(schema.checkDetails)
    .where(
      and(
        eq(schema.checkDetails.siteId, siteId),
        eq(schema.checkDetails.strategy, strategy),
        notInArray(
          schema.checkDetails.checkId,
          keep.map((k) => k.id),
        ),
      ),
    );
}

async function maybeAlert(site: SiteRow, latest: number) {
  if (site.alertDrop <= 0) return;
  if (site.lastAlertAt && Date.now() - site.lastAlertAt.getTime() < ALERT_COOLDOWN_MS) return;

  // The newest row is the run we just stored; the baseline is the runs before it.
  const recent = await db
    .select({ score: schema.checks.score })
    .from(schema.checks)
    .where(and(eq(schema.checks.siteId, site.id), eq(schema.checks.strategy, "mobile"), isNotNull(schema.checks.score)))
    .orderBy(desc(schema.checks.createdAt))
    .limit(8);
  const previous = recent
    .slice(1)
    .map((r) => r.score as number)
    .reverse();

  const baseline = detectRegression(latest, previous, site.alertDrop);
  if (baseline == null) return;

  const [owner] = await db.select({ email: schema.user.email, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, site.userId));
  if (!owner) return;
  await sendEmail({
    to: owner.email,
    ...regressionEmail({ name: owner.name, siteName: site.name, siteUrl: site.url, baseline, latest, link: `${app.url}/sites/${site.id}` }),
  });
  await db.update(schema.sites).set({ lastAlertAt: new Date() }).where(eq(schema.sites.id, site.id));
}
