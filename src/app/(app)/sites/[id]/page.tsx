import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CircleAlert, Globe } from "lucide-react";
import { ReportSkeleton } from "@/components/report/report-skeleton";
import { ReportView } from "@/components/report/report-view";
import { RunCheckButton } from "@/components/report/run-check-button";
import { DownloadPdfButton, ShareButton } from "@/components/report/share-buttons";
import { SiteSettings } from "@/components/report/site-settings";
import { requireUser } from "@/lib/auth";
import { loadReport } from "@/lib/report-data";
import { site as app } from "@/lib/site";
import { getOwnedSite, parseRange } from "@/lib/sites";

export const metadata: Metadata = { title: "Site report" };
// A manual run waits on two PageSpeed calls in parallel (up to ~55 s each).
export const maxDuration = 90;

export default function SitePage({ params, searchParams }: PageProps<"/sites/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
      <Suspense fallback={<ReportSkeleton />}>
        <Report params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Report({ params, searchParams }: Pick<PageProps<"/sites/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/sites/${id}`);
  const row = await getOwnedSite(user.id, id);
  if (!row) notFound();

  const range = parseRange(query.range);
  const data = await loadReport(id, range);
  const empty = !data.checks.length;

  return (
    <>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Overview
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{row.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <a href={row.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              {row.url.replace(/^https?:\/\//, "")} <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
            {row.isPublic && (
              <Link href={`/r/${row.id}`} className="inline-flex items-center gap-1 text-subtle hover:text-foreground">
                <Globe className="size-3.5" aria-hidden /> Public report
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton siteId={row.id} isPublic={row.isPublic} appUrl={app.url} />
          {!empty && <DownloadPdfButton siteId={row.id} />}
          <SiteSettings site={{ id: row.id, name: row.name, isPublic: row.isPublic, alertDrop: row.alertDrop, deployToken: row.deployToken }} appUrl={app.url} mobileScore={data.latest.mobile?.score ?? null} />
          <RunCheckButton siteId={row.id} autoStart={empty && query.first === "1"} />
        </div>
      </div>

      {data.lastError && (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-lg border border-poor/30 bg-poor/10 px-4 py-3 text-sm text-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-poor" aria-hidden />
          <span>
            <span className="font-medium">The last run failed.</span> <span className="text-muted-foreground">{data.lastError}</span>
          </span>
        </p>
      )}

      <div className="mt-7">
        {empty ? (
          <div className="panel grid place-items-center px-6 py-20 text-center">
            <p className="text-lg font-medium text-foreground">No runs yet</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              The first check tests the page on mobile and desktop on Google&apos;s servers. It takes about half a minute. After that it runs every day by itself.
            </p>
          </div>
        ) : (
          <ReportView data={data} range={range} basePath={`/sites/${id}`} siteUrl={row.url} siteId={row.id} canEdit />
        )}
      </div>
    </>
  );
}
