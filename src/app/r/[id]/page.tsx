import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DownloadPdfButton } from "@/components/report/share-buttons";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { ReportSkeleton } from "@/components/report/report-skeleton";
import { ReportView } from "@/components/report/report-view";
import { loadReport } from "@/lib/report-data";
import { getPublicSite, parseRange } from "@/lib/sites";

export const metadata: Metadata = { title: "Speed report" };

/** Read-only report the owner chose to share. */
export default function PublicReportPage({ params, searchParams }: PageProps<"/r/[id]">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Logo />
          <Link href="/sign-up" className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-white">
            Watch your site
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-10">
        <Suspense fallback={<ReportSkeleton />}>
          <Report params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Report({ params, searchParams }: Pick<PageProps<"/r/[id]">, "params" | "searchParams">) {
  // Live data on every visit: never prerender a report.
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const row = await getPublicSite(id);
  if (!row) notFound();
  const range = parseRange(query.range);
  const data = await loadReport(id, range);

  return (
    <>
      <p className="eyebrow">Public speed report</p>
      <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{row.name}</h1>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
        <a href={row.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          {row.url.replace(/^https?:\/\//, "")} <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
        <DownloadPdfButton siteId={row.id} />
      </div>
      <div className="mt-7">
        <ReportView data={data} range={range} basePath={`/r/${id}`} siteUrl={row.url} siteId={row.id} />
      </div>
    </>
  );
}
