import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CheckRow } from "@/db/schema";
import type { ReportData, ReportDetails, ReportLatest } from "@/components/report/report-view";
import type { Diagnostics } from "./diagnostics";
import { DAY, RANGES, getSiteReport, type Range } from "./sites";
import type { Strategy } from "./vitals";

const toLatest = (row: CheckRow | null): ReportLatest | null =>
  row && row.score != null
    ? { t: row.createdAt.getTime(), score: row.score, field: row.field ?? null, opportunities: row.opportunities ?? [] }
    : null;

/** Screenshots are served by /api/shots (cacheable), not inlined into every page load. */
function withImageUrls(checkId: number, d: Diagnostics): Diagnostics {
  return {
    ...d,
    finalScreenshot: d.finalScreenshot ? `/api/shots/${checkId}/final` : undefined,
    filmstrip: d.filmstrip.map((f, i) => ({ ms: f.ms, img: `/api/shots/${checkId}/${i}` })),
  };
}

const stripImages = (d: Diagnostics): Diagnostics => ({ ...d, finalScreenshot: undefined, filmstrip: [] });

/**
 * Latest diagnostics for a device, plus the run to compare it with: the last
 * one before the most recent deploy if that deploy came after it, otherwise
 * the previous run.
 */
async function loadDetails(siteId: string, strategy: Strategy, deploys: { t: number; ref: string }[]): Promise<ReportDetails | null> {
  const rows = await db
    .select({ checkId: schema.checkDetails.checkId, createdAt: schema.checkDetails.createdAt, data: schema.checkDetails.data })
    .from(schema.checkDetails)
    .where(and(eq(schema.checkDetails.siteId, siteId), eq(schema.checkDetails.strategy, strategy)))
    .orderBy(desc(schema.checkDetails.createdAt))
    .limit(8);
  const [latest, ...older] = rows;
  if (!latest) return null;

  const t = latest.createdAt.getTime();
  const deploy = deploys.find((d) => d.t <= t);
  const beforeDeploy = deploy ? older.find((r) => r.createdAt.getTime() < deploy.t) : undefined;
  const base = beforeDeploy ?? older[0];
  return {
    checkId: latest.checkId,
    t,
    diag: withImageUrls(latest.checkId, latest.data),
    baseline: base
      ? {
          t: base.createdAt.getTime(),
          label: beforeDeploy && deploy ? `since deploy ${deploy.ref}` : "since the previous run",
          diag: stripImages(base.data),
        }
      : null,
  };
}

/** Plain, serialisable report for the client view. */
export async function loadReport(siteId: string, range: Range): Promise<ReportData & { lastError: string | null }> {
  const report = await getSiteReport(siteId, range);
  const to = Date.now();
  const deploys = report.deploys.map((d) => ({ id: d.id, t: d.createdAt.getTime(), ref: d.ref, message: d.message }));
  const [mobile, desktop] = await Promise.all([loadDetails(siteId, "mobile", deploys), loadDetails(siteId, "desktop", deploys)]);
  return {
    checks: report.checks.map((c) => ({
      id: c.id,
      t: c.createdAt.getTime(),
      strategy: c.strategy,
      trigger: c.trigger,
      score: c.score,
      lcp: c.lcp,
      cls: c.cls,
      tbt: c.tbt,
      fcp: c.fcp,
      si: c.si,
      ttfb: c.ttfb,
      error: c.error,
    })),
    deploys,
    latest: { mobile: toLatest(report.latest.mobile), desktop: toLatest(report.latest.desktop) },
    details: { mobile, desktop },
    from: to - RANGES[range] * DAY,
    to,
    lastError: report.lastRun && report.lastRun.score == null ? report.lastRun.error : null,
  };
}
