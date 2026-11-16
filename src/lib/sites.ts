import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db, dbReady, schema } from "@/db";
import type { CheckRow, DeployRow, SiteRow } from "@/db/schema";
import type { Rating, Strategy } from "./vitals";

const DAY = 24 * 60 * 60 * 1000;

export interface SiteSummary {
  id: string;
  name: string;
  url: string;
  isPublic: boolean;
  mobile: number | null;
  desktop: number | null;
  /** Mobile score 7 days before the latest run, for the "▲ 4 this week" hint. */
  weekAgo: number | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  /** Real-user Core Web Vitals verdict from the newest run that had field data. */
  cwv: Rating | null;
  /** Last 30 days of mobile scores, oldest first. */
  trend: { t: number; score: number }[];
}

/** Cached per request: the sidebar and the overview share one query. */
export const listSites = cache(async (userId: string): Promise<SiteSummary[]> => {
  await dbReady();
  const rows = await db.select().from(schema.sites).where(eq(schema.sites.userId, userId)).orderBy(asc(schema.sites.createdAt));
  if (!rows.length) return [];

  const since = new Date(Date.now() - 30 * DAY);
  const checks = await db
    .select({
      siteId: schema.checks.siteId,
      strategy: schema.checks.strategy,
      score: schema.checks.score,
      error: schema.checks.error,
      field: schema.checks.field,
      createdAt: schema.checks.createdAt,
    })
    .from(schema.checks)
    .where(and(inArray(schema.checks.siteId, rows.map((r) => r.id)), gte(schema.checks.createdAt, since)))
    .orderBy(asc(schema.checks.createdAt));

  return rows.map((site) => {
    const mine = checks.filter((c) => c.siteId === site.id);
    const latestOk = (s: Strategy) => mine.findLast((c) => c.strategy === s && c.score != null)?.score ?? null;
    const trend = mine
      .filter((c) => c.strategy === "mobile" && c.score != null)
      .map((c) => ({ t: c.createdAt.getTime(), score: c.score as number }));
    const last = mine.at(-1);
    const lastT = trend.at(-1)?.t;
    const weekAgo = lastT ? (trend.findLast((p) => p.t <= lastT - 6.5 * DAY)?.score ?? null) : null;
    return {
      id: site.id,
      name: site.name,
      url: site.url,
      isPublic: site.isPublic,
      mobile: latestOk("mobile"),
      desktop: latestOk("desktop"),
      weekAgo,
      lastCheckedAt: last?.createdAt ?? null,
      lastError: last && last.score == null ? last.error : null,
      cwv: mine.findLast((c) => c.strategy === "mobile" && c.field?.overall)?.field?.overall ?? null,
      trend,
    };
  });
});

export async function getOwnedSite(userId: string, id: string): Promise<SiteRow | null> {
  await dbReady();
  const [row] = await db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, id), eq(schema.sites.userId, userId)));
  return row ?? null;
}

export async function getPublicSite(id: string): Promise<SiteRow | null> {
  await dbReady();
  const [row] = await db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, id), eq(schema.sites.isPublic, true)));
  return row ?? null;
}

export const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type Range = keyof typeof RANGES;
export const parseRange = (value: unknown): Range => (typeof value === "string" && value in RANGES ? (value as Range) : "30d");

export interface SiteReport {
  checks: CheckRow[];
  deploys: DeployRow[];
  /** Newest successful run per strategy, with field data and fixes. Ignores the range. */
  latest: Record<Strategy, CheckRow | null>;
  /** Newest run of any kind, to surface a failure. */
  lastRun: CheckRow | null;
}

export async function getSiteReport(siteId: string, range: Range): Promise<SiteReport> {
  await dbReady();
  const since = new Date(Date.now() - RANGES[range] * DAY);
  // Also load a few runs before the window, so a deploy near its start still has a "before".
  const loadFrom = new Date(since.getTime() - 7 * DAY);
  const [checks, deploys, latestRuns] = await Promise.all([
    db
      .select()
      .from(schema.checks)
      .where(and(eq(schema.checks.siteId, siteId), gte(schema.checks.createdAt, loadFrom)))
      .orderBy(asc(schema.checks.createdAt)),
    db
      .select()
      .from(schema.deploys)
      .where(and(eq(schema.deploys.siteId, siteId), gte(schema.deploys.createdAt, since)))
      .orderBy(desc(schema.deploys.createdAt)),
    db.select().from(schema.checks).where(eq(schema.checks.siteId, siteId)).orderBy(desc(schema.checks.createdAt)).limit(12),
  ]);
  const latestOk = (s: Strategy) => latestRuns.find((c) => c.strategy === s && c.score != null) ?? null;
  return {
    checks,
    deploys,
    latest: { mobile: latestOk("mobile"), desktop: latestOk("desktop") },
    lastRun: latestRuns[0] ?? null,
  };
}

export { DAY };
