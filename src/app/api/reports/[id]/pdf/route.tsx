import { renderToBuffer } from "@react-pdf/renderer";
import { and, desc, eq } from "drizzle-orm";
import { db, dbReady, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { compareAroundDeploy } from "@/lib/compare";
import { ReportPdf, type PdfReportInput } from "@/lib/pdf/report-pdf";
import { site as app } from "@/lib/site";
import { getSiteReport } from "@/lib/sites";
import type { Strategy } from "@/lib/vitals";

export const maxDuration = 30;

/** GET /api/reports/:id/pdf?strategy=mobile|desktop: the site report as a downloadable PDF. */
export async function GET(request: Request, { params }: RouteContext<"/api/reports/[id]/pdf">) {
  const { id } = await params;
  const strategy: Strategy = new URL(request.url).searchParams.get("strategy") === "desktop" ? "desktop" : "mobile";

  await dbReady();
  const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, id));
  if (!site) return new Response("Not found", { status: 404 });
  if (!site.isPublic) {
    const session = await getSession();
    if (session?.user.id !== site.userId) return new Response("Not found", { status: 404 });
  }

  const report = await getSiteReport(id, "30d");
  const since = Date.now() - 30 * 86_400_000;
  const runs = report.checks.filter((c) => c.strategy === strategy);
  const latest = report.latest[strategy];

  const details = await db
    .select({ data: schema.checkDetails.data, createdAt: schema.checkDetails.createdAt })
    .from(schema.checkDetails)
    .where(and(eq(schema.checkDetails.siteId, id), eq(schema.checkDetails.strategy, strategy)))
    .orderBy(desc(schema.checkDetails.createdAt))
    .limit(8);
  const [newest, ...older] = details;
  const lastDeploy = report.deploys.find((d) => newest && d.createdAt <= newest.createdAt);
  const before = lastDeploy ? older.find((r) => r.createdAt < lastDeploy.createdAt) : undefined;
  const base = before ?? older[0];

  const points = runs.map((r) => ({ ...r, createdAt: r.createdAt }));
  const input: PdfReportInput = {
    site: { name: site.name, url: site.url },
    strategy,
    generatedAt: new Date(),
    scores: { mobile: report.latest.mobile?.score ?? null, desktop: report.latest.desktop?.score ?? null },
    lab: latest ? { lcp: latest.lcp, tbt: latest.tbt, cls: latest.cls, fcp: latest.fcp, si: latest.si, ttfb: latest.ttfb } : {},
    field: report.latest.mobile?.field ?? null,
    trend: runs.filter((r) => r.score != null && r.createdAt.getTime() >= since).map((r) => ({ t: r.createdAt.getTime(), score: r.score as number })),
    deploys: report.deploys.map((d) => {
      const c = compareAroundDeploy(points, d.createdAt);
      return { t: d.createdAt.getTime(), ref: d.ref, message: d.message, before: c.before.score, after: c.after.score };
    }),
    diag: newest?.data ?? null,
    baseline: base ? { t: base.createdAt.getTime(), label: before && lastDeploy ? `since deploy ${lastDeploy.ref}` : "since the previous run", diag: base.data } : null,
    reportUrl: site.isPublic ? `${app.url}/r/${site.id}` : undefined,
  };

  const pdf = await renderToBuffer(<ReportPdf input={input} />);
  const slug = site.name.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vitalswatch-${slug}-${strategy}-${date}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
