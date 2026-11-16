import { eq, inArray } from "drizzle-orm";
import { db, dbReady, schema } from "@/db";
import { auth } from "@/lib/auth";
import { sampleDiagnostics } from "@/lib/sample-diagnostics";
import type { FieldData, Opportunity, Strategy } from "@/lib/vitals";

/**
 * Creates a demo account with three sites and 90 days of daily history,
 * including a regression a deploy caused and the deploy that fixed it.
 * Deterministic (seeded PRNG). Allowed in development, or in production with
 * "Authorization: Bearer $CRON_SECRET".
 */
const DEMO = { name: "Demo Account", email: "demo@vitalswatch.dev", password: "vitals-demo" };
const DAY = 24 * 60 * 60 * 1000;

function allowed(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Story {
  id: string;
  name: string;
  url: string;
  isPublic: boolean;
  /** Mobile score level from `daysAgo` onwards, oldest first. */
  levels: { daysAgo: number; score: number; tbtBoost?: number; deploy?: { ref: string; message: string } }[];
  extraDeploys?: { daysAgo: number; ref: string; message: string }[];
}

const STORIES: Story[] = [
  {
    id: "demo",
    name: "store.example.com",
    url: "https://store.example.com/",
    isPublic: true,
    levels: [
      { daysAgo: 90, score: 57 },
      { daysAgo: 61, score: 71, deploy: { ref: "a41c9e2", message: "Lazy-load below-the-fold product images" } },
      { daysAgo: 38, score: 52, tbtBoost: 520, deploy: { ref: "7be01d4", message: "Add live chat widget" } },
      { daysAgo: 34, score: 74, deploy: { ref: "c93f210", message: "Load chat widget on first interaction" } },
      { daysAgo: 13, score: 86, deploy: { ref: "1f8e7aa", message: "Preload hero image, font-display: swap" } },
    ],
    extraDeploys: [
      { daysAgo: 52, ref: "e02b6f1", message: "Copy changes on pricing page" },
      { daysAgo: 22, ref: "9d1a0c4", message: "Fix cart badge count" },
    ],
  },
  {
    id: "demoBlog01",
    name: "blog.example.com",
    url: "https://blog.example.com/",
    isPublic: false,
    levels: [
      { daysAgo: 90, score: 91 },
      { daysAgo: 27, score: 83, deploy: { ref: "4c7d2e9", message: "New comment embed" } },
    ],
  },
  {
    id: "demoDocs01",
    name: "docs.example.com",
    url: "https://docs.example.com/getting-started",
    isPublic: false,
    levels: [
      { daysAgo: 90, score: 44 },
      { daysAgo: 45, score: 63, deploy: { ref: "b88e013", message: "Split search bundle, defer analytics" } },
    ],
  },
];

const OPPORTUNITIES: Opportunity[] = [
  { id: "render-blocking-insight", title: "Render blocking requests", savingsMs: 480 },
  { id: "image-delivery-insight", title: "Improve image delivery", savingsMs: 310, displayValue: "Est. savings of 184 KiB" },
  { id: "unused-javascript", title: "Reduce unused JavaScript", savingsMs: 220, displayValue: "Est. savings of 96 KiB" },
  { id: "third-parties-insight", title: "Third parties", savingsMs: 0 },
];

function fieldFor(score: number): FieldData {
  const slow = (100 - score) / 50;
  const lcp = Math.round(1700 + slow * 2400);
  const inp = Math.round(120 + slow * 260);
  const cls = Math.round((0.03 + slow * 0.1) * 100) / 100;
  const rate = (v: number, g: number, p: number) => (v <= g ? "good" : v > p ? "poor" : "needs-improvement") as FieldData["overall"] & string;
  const metrics: FieldData["metrics"] = {
    lcp: { p75: lcp, rating: rate(lcp, 2500, 4000) },
    inp: { p75: inp, rating: rate(inp, 200, 500) },
    cls: { p75: cls, rating: rate(cls, 0.1, 0.25) },
    fcp: { p75: Math.round(1100 + slow * 1500), rating: rate(1100 + slow * 1500, 1800, 3000) },
    ttfb: { p75: Math.round(420 + slow * 600), rating: rate(420 + slow * 600, 800, 1800) },
  };
  const core = [metrics.lcp!.rating, metrics.inp!.rating, metrics.cls!.rating];
  const overall = core.includes("poor") ? "poor" : core.includes("needs-improvement") ? "needs-improvement" : "good";
  return { scope: "origin", overall, metrics };
}

export async function POST(request: Request) {
  if (!allowed(request)) return new Response("Not found", { status: 404 });
  await dbReady();
  const rand = prng(20261116);
  const noise = (amp: number) => (rand() - 0.5) * 2 * amp;

  let [demoUser] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, DEMO.email)).limit(1);
  if (!demoUser) {
    const created = await auth.api.signUpEmail({ body: DEMO });
    demoUser = { id: created.user.id };
  }

  await db.delete(schema.sites).where(inArray(schema.sites.id, STORIES.map((s) => s.id)));

  // Daily runs at 02:30 UTC (when the cron fires), so the history looks like the real thing.
  const today = new Date();
  today.setUTCHours(2, 30, 0, 0);
  const at = (daysAgo: number, minutes = 0) => new Date(today.getTime() - daysAgo * DAY + minutes * 60_000);

  const checkRows: (typeof schema.checks.$inferInsert)[] = [];
  const deployRows: (typeof schema.deploys.$inferInsert)[] = [];

  for (const story of STORIES) {
    await db.insert(schema.sites).values({
      id: story.id,
      userId: demoUser.id,
      name: story.name,
      url: story.url,
      isPublic: story.isPublic,
      deployToken: `vw_demo_${story.id}`,
    });

    for (const level of story.levels) {
      // Deploys land mid-afternoon, and the deploy hook runs a check right after.
      if (level.deploy) deployRows.push({ siteId: story.id, ...level.deploy, createdAt: at(level.daysAgo - 0.5) });
    }
    for (const d of story.extraDeploys ?? []) deployRows.push({ siteId: story.id, ref: d.ref, message: d.message, createdAt: at(d.daysAgo - 0.5) });

    for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
      const level = story.levels.findLast((l) => l.daysAgo > daysAgo) ?? story.levels[0];
      const runs: { when: Date; trigger: "scheduled" | "deploy" }[] = [{ when: at(daysAgo), trigger: "scheduled" }];
      const deployToday = story.levels.find((l) => l.deploy && l.daysAgo === daysAgo + 1);
      if (deployToday) runs.unshift({ when: at(daysAgo + 0.5, 3), trigger: "deploy" });
      // One in ~40 scheduled runs fails, as real ones occasionally do.
      const fails = daysAgo > 3 && rand() < 0.025;

      for (const run of runs) {
        // A deploy-triggered run measures the new level.
        const lvl = run.trigger === "deploy" && deployToday ? deployToday : level;
        for (const strategy of ["mobile", "desktop"] as Strategy[]) {
          if (fails && run.trigger === "scheduled") {
            checkRows.push({ siteId: story.id, strategy, trigger: run.trigger, error: "Lighthouse returned error: NO_FCP. The page did not paint any content.", createdAt: run.when });
            continue;
          }
          const base = strategy === "mobile" ? lvl.score : Math.min(99, lvl.score + 13);
          const score = Math.max(5, Math.min(100, Math.round(base + noise(3))));
          const slow = (100 - score) / 50;
          const tbtBoost = strategy === "mobile" ? (lvl.tbtBoost ?? 0) : (lvl.tbtBoost ?? 0) / 4;
          const latest = daysAgo === 0 && run.trigger === "scheduled";
          checkRows.push({
            siteId: story.id,
            strategy,
            trigger: run.trigger,
            score,
            lcp: Math.round((strategy === "mobile" ? 1500 : 700) + slow * (strategy === "mobile" ? 3600 : 1400) + noise(120)),
            cls: Math.max(0, Math.round((0.02 + slow * 0.09 + noise(0.01)) * 1000) / 1000),
            tbt: Math.max(0, Math.round(40 + slow * 380 + tbtBoost + noise(30))),
            fcp: Math.round((strategy === "mobile" ? 1000 : 400) + slow * 1500 + noise(80)),
            si: Math.round((strategy === "mobile" ? 1900 : 800) + slow * 3200 + noise(150)),
            ttfb: Math.round(260 + slow * 260 + noise(40)),
            field: latest ? fieldFor(strategy === "mobile" ? score : score - 10) : null,
            opportunities: latest || run.trigger === "deploy" ? OPPORTUNITIES.slice(0, score > 85 ? 2 : 4) : null,
            createdAt: run.when,
          });
        }
      }
    }
  }

  const inserted: { id: number; siteId: string; strategy: Strategy; score: number | null; createdAt: Date }[] = [];
  for (let i = 0; i < checkRows.length; i += 300) {
    inserted.push(
      ...(await db
        .insert(schema.checks)
        .values(checkRows.slice(i, i + 300))
        .returning({ id: schema.checks.id, siteId: schema.checks.siteId, strategy: schema.checks.strategy, score: schema.checks.score, createdAt: schema.checks.createdAt })),
    );
  }
  await db.insert(schema.deploys).values(deployRows);

  // Diagnostics: the newest run of every site, plus (for the store) the run just
  // before its last deploy, which still had the two issues that deploy fixed.
  const detailRows: (typeof schema.checkDetails.$inferInsert)[] = [];
  for (const story of STORIES) {
    const origin = new URL(story.url).origin;
    for (const strategy of ["mobile", "desktop"] as Strategy[]) {
      const runs = inserted.filter((c) => c.siteId === story.id && c.strategy === strategy && c.score != null).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const latest = runs.at(-1);
      if (latest) detailRows.push({ checkId: latest.id, siteId: story.id, strategy, data: sampleDiagnostics(origin), createdAt: latest.createdAt });

      const lastDeploy = story.levels.at(-1)?.deploy ? at(story.levels.at(-1)!.daysAgo - 0.5) : null;
      const before = lastDeploy ? runs.findLast((c) => c.createdAt < lastDeploy) : undefined;
      if (story.id === "demo" && before) {
        const d = sampleDiagnostics(origin);
        // Before 1f8e7aa the hero image was lazy-loaded and found late.
        d.lcp = { ...d.lcp!, phases: d.lcp!.phases.map((x) => (x.key === "resourceLoadDelay" ? { ...x, ms: 980 } : x)), checks: d.lcp!.checks.map((c) => ({ ...c, ok: c.label.includes("discoverable") })) };
        d.issues.push(
          {
            id: "lcp-discovery-insight",
            title: "LCP request discovery",
            description: "Optimize LCP by making the LCP image discoverable from the HTML immediately, and avoiding lazy-loading.",
            savingsMs: 380,
            savingsBytes: 0,
            metrics: ["LCP"],
            items: [{ url: `${origin}/images/hero-sofa.jpg`, totalBytes: 241_000 }],
            failedChecks: ["fetchpriority=high applied", "LCP resources shouldn’t use loading=lazy"],
          },
          {
            id: "font-display-insight",
            title: "Font display",
            description: "Consider setting font-display to swap or optional to ensure text is consistently visible.",
            displayValue: "Est savings of 120 ms",
            savingsMs: 120,
            savingsBytes: 0,
            metrics: ["FCP"],
            items: [{ url: "https://fonts.example-cdn.com/s/brand/v12/brand-regular.woff2", ms: 120 }],
          },
        );
        d.totals = { requests: d.totals.requests + 2, bytes: d.totals.bytes + 64_000 };
        detailRows.push({ checkId: before.id, siteId: story.id, strategy, data: d, createdAt: before.createdAt });
      }
    }
  }
  if (detailRows.length) await db.insert(schema.checkDetails).values(detailRows);

  return Response.json({ ok: true, login: { email: DEMO.email, password: DEMO.password }, sites: STORIES.length, checks: checkRows.length, deploys: deployRows.length, details: detailRows.length });
}
