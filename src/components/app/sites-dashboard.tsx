import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, CircleAlert, CircleCheck, CircleX, Minus } from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { SiteSummary } from "@/lib/sites";
import { median, rateScore } from "@/lib/vitals";
import { RATING_BG, RATING_STROKE } from "@/components/ui/rating";
import { cn } from "@/lib/utils";
import { AddSiteDialog } from "./add-site-dialog";

function Sparkline({ points, id }: { points: SiteSummary["trend"]; id: string }) {
  if (points.length < 2) return <div className="h-9 rounded border border-dashed border-border" aria-hidden />;
  const W = 240;
  const H = 36;
  const t0 = points[0].t;
  const t1 = points.at(-1)!.t;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * (W - 4) + 2;
  // Fixed 0–100 scale, so a flat line really is flat and rows compare at a glance.
  const y = (s: number) => H - 3 - (s / 100) * (H - 6);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.score).toFixed(1)}`).join("");
  const last = points.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`sf-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity={0.25} />
          <stop offset="1" stopColor="var(--brand)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1={0} x2={W} y1={y(90)} y2={y(90)} stroke="var(--good)" strokeOpacity={0.35} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <path d={`${d}L${x(last.t)},${H}L${x(t0)},${H}Z`} fill={`url(#sf-${id})`} />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(last.t)} cy={y(last.score)} r={2.5} fill={RATING_STROKE[rateScore(last.score)]} />
    </svg>
  );
}

function ScoreCell({ score, label }: { score: number | null; label: string }) {
  const rating = score == null ? null : rateScore(score);
  return (
    <div>
      <p className="text-[11px] text-subtle lg:hidden">{label}</p>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">{score ?? "—"}</p>
      <div className="mt-1.5 h-[3px] w-16 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        {rating && <div className={cn("h-full rounded-full", RATING_BG[rating])} style={{ width: `${score}%` }} />}
      </div>
    </div>
  );
}

function Change({ now, then }: { now: number | null; then: number | null }) {
  if (now == null || then == null) return <span className="text-subtle">—</span>;
  const diff = now - then;
  if (Math.abs(diff) < 5)
    return (
      <span className="inline-flex items-center gap-1 text-subtle">
        <Minus className="size-3" aria-hidden /> steady
      </span>
    );
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", diff > 0 ? "text-good" : "text-poor")}>
      <Icon className="size-3.5" aria-hidden />
      {diff > 0 ? "+" : "−"}
      {Math.abs(diff)} this week
    </span>
  );
}

function Cwv({ value }: { value: SiteSummary["cwv"] }) {
  if (!value) return <span className="text-xs text-subtle">No field data</span>;
  const pass = value === "good";
  const Icon = pass ? CircleCheck : CircleX;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className={cn("size-3.5", pass ? "text-good" : "text-poor")} aria-hidden />
      {pass ? "Passes" : "Fails"}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-[-0.03em] text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const COLS = "lg:grid-cols-[minmax(0,1.7fr)_6rem_6rem_minmax(0,1.5fr)_7.5rem_6.5rem_1rem]";

export function SitesDashboard({ sites }: { sites: SiteSummary[] }) {
  const scored = sites.filter((s) => s.mobile != null);
  const med = median(scored.map((s) => s.mobile as number));
  const withField = sites.filter((s) => s.cwv);
  const passing = withField.filter((s) => s.cwv === "good").length;
  const slower = sites.filter((s) => s.mobile != null && s.weekAgo != null && s.weekAgo - s.mobile >= 5).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-brand">Overview</p>
          <h1 className="text-lit mt-1.5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">How your pages are doing</h1>
        </div>
        {sites.length > 0 && <AddSiteDialog />}
      </div>

      {sites.length ? (
        <>
          <section aria-label="Summary" className="mt-8 grid grid-cols-2 divide-border overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-4 lg:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-border lg:[&>*:nth-child(n+3)]:border-t-0 [&>*:nth-child(2n)]:border-l [&>*:nth-child(2n)]:border-border">
            <Stat label="Pages watched" value={String(sites.length)} sub="Tested daily at 02:30 UTC" />
            <Stat label="Median mobile score" value={med == null ? "—" : String(Math.round(med))} sub={med == null ? "Waiting for a first run" : med >= 90 ? "Good" : med >= 50 ? "Needs work" : "Poor"} />
            <Stat label="Pass Core Web Vitals" value={withField.length ? `${passing}/${withField.length}` : "—"} sub="Real Chrome users, 28 days" />
            <Stat
              label="Slower this week"
              value={String(slower)}
              sub={slower ? <span className="text-poor">Mobile down 5+ points</span> : "Nothing slipped"}
            />
          </section>

          <section aria-label="Sites" className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <div className={cn("hidden gap-6 border-b border-border px-6 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-subtle lg:grid", COLS)}>
              <span>Page</span>
              <span>Mobile</span>
              <span>Desktop</span>
              <span>30 days · mobile</span>
              <span>Real users</span>
              <span className="text-right">Last run</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {sites.map((s) => {
                const failedOnly = s.mobile == null && s.lastError;
                const dot = failedOnly ? "bg-poor" : s.mobile == null ? "bg-subtle" : RATING_BG[rateScore(s.mobile)];
                return (
                  <li key={s.id}>
                    <Link
                      href={`/sites/${s.id}`}
                      className={cn("group grid grid-cols-2 items-center gap-x-6 gap-y-4 px-5 py-5 outline-none hover:bg-white/[0.02] focus-visible:bg-white/[0.03] sm:px-6 lg:gap-y-0", COLS)}
                    >
                      <div className="col-span-2 min-w-0 lg:col-span-1">
                        <p className="flex items-center gap-2.5 font-medium text-foreground">
                          <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
                          <span className="truncate">{s.name}</span>
                        </p>
                        <p className="mt-0.5 truncate pl-[18px] text-xs text-subtle">{s.url.replace(/^https?:\/\//, "")}</p>
                        {s.lastError && (
                          <p className="mt-2 flex items-start gap-1.5 pl-[18px] text-xs text-poor">
                            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                            <span className="line-clamp-2">{s.lastError}</span>
                          </p>
                        )}
                      </div>
                      <ScoreCell score={s.mobile} label="Mobile" />
                      <ScoreCell score={s.desktop} label="Desktop" />
                      <div className="col-span-2 lg:col-span-1">
                        <Sparkline points={s.trend} id={s.id} />
                        <p className="mt-1 text-xs">
                          <Change now={s.mobile} then={s.weekAgo} />
                        </p>
                      </div>
                      <Cwv value={s.cwv} />
                      <span className="text-right text-xs text-subtle">{s.lastCheckedAt ? timeAgo(s.lastCheckedAt) : "Not yet"}</span>
                      <ChevronRight className="hidden size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground lg:block" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-24 text-center">
          <svg viewBox="0 0 160 40" className="h-10 w-40" aria-hidden>
            <path d="M0 22h50l6-12 9 24 7-30 8 26 5-8h75" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(45,212,230,0.6))" }} />
          </svg>
          <h2 className="mt-6 text-xl font-semibold text-foreground">Nothing on the monitor yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Add a page to get its Lighthouse score, Core Web Vitals and a daily trend. No script to install.</p>
          <div className="mt-6">
            <AddSiteDialog variant="hero" />
          </div>
        </div>
      )}
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" className="animate-pulse">
      <span className="sr-only">Loading sites…</span>
      <div className="h-4 w-20 rounded bg-muted" />
      <div className="mt-3 h-9 w-80 rounded bg-muted" />
      <div className="mt-8 h-28 rounded-2xl bg-card" />
      <div className="mt-6 h-64 rounded-2xl bg-card" />
    </div>
  );
}
