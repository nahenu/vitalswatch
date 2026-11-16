"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CircleX, GitCommitHorizontal, Minus, Monitor, Smartphone, Users } from "lucide-react";
import { compareAroundDeploy, type CheckPoint, type Verdict } from "@/lib/compare";
import { formatDateTime, formatDay, timeAgo } from "@/lib/format";
import {
  CORE_FIELD_METRICS,
  LAB_METRICS,
  METRICS,

  formatDelta,
  formatMetric,
  median,
  rateMetric,
  rateScore,
  type FieldData,
  type FieldMetric,
  type LabMetric,
  type Opportunity,
  type Strategy,
} from "@/lib/vitals";
import { RATING_BG, RatingLabel, ScoreChip, ScoreRing } from "@/components/ui/rating";
import { cn } from "@/lib/utils";
import type { Diagnostics } from "@/lib/diagnostics";
import { DiagnosticsSection } from "./diagnostics";
import { RecordDeployButton } from "./record-deploy";
import { TrendChart, type ChartMetric } from "./trend-chart";

export interface ReportCheck {
  id: number;
  t: number;
  strategy: Strategy;
  trigger: "manual" | "scheduled" | "deploy";
  score: number | null;
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  fcp: number | null;
  si: number | null;
  ttfb: number | null;
  error: string | null;
}

export interface ReportLatest {
  t: number;
  score: number;
  field: FieldData | null;
  opportunities: Opportunity[];
}

export interface ReportDetails {
  checkId: number;
  t: number;
  diag: Diagnostics;
  baseline: { t: number; label: string; diag: Diagnostics } | null;
}

export interface ReportData {
  checks: ReportCheck[];
  deploys: { id: number; t: number; ref: string; message: string | null }[];
  latest: Record<Strategy, ReportLatest | null>;
  details: Record<Strategy, ReportDetails | null>;
  from: number;
  to: number;
}

const RANGES = ["7d", "30d", "90d"] as const;

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value && "bg-raised text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ReportView({
  data,
  range,
  basePath,
  siteUrl,
  siteId,
  canEdit = false,
}: {
  data: ReportData;
  range: string;
  basePath: string;
  siteUrl: string;
  siteId: string;
  /** Owner view: shows actions such as Record a deploy. */
  canEdit?: boolean;
}) {
  const [strategy, setStrategy] = useState<Strategy>("mobile");
  const [metric, setMetric] = useState<ChartMetric>("score");

  const runs = useMemo(() => data.checks.filter((c) => c.strategy === strategy), [data.checks, strategy]);
  const inRange = useMemo(() => runs.filter((c) => c.t >= data.from), [runs, data.from]);
  const points = useMemo(
    () =>
      inRange.flatMap((c) => {
        const value = metric === "score" ? c.score : c[metric];
        return value == null ? [] : [{ t: c.t, value, trigger: c.trigger }];
      }),
    [inRange, metric],
  );

  const ok = inRange.filter((c) => c.score != null);
  const latestRun = ok.at(-1);
  const startRuns = ok.slice(0, 3);

  // A new site has a day of history, not 90: start the axis at its first run so
  // one dot isn't pinned to the right edge of an empty three-month chart.
  const firstRun = runs[0]?.t;
  const newSite = firstRun != null && firstRun > data.from;
  const chartFrom = newSite ? Math.min(firstRun - 6 * 3_600_000, data.to - 2 * 86_400_000) : data.from;
  // Ranges only work on history the site actually has; `data.checks` also holds a week before the range.
  const allRuns = data.checks;
  const youngSite = !allRuns.length || allRuns[0].t > data.to - 7 * 86_400_000;

  const field = data.latest.mobile?.field ?? null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="panel p-5 sm:p-6" aria-labelledby="scores-h">
          <h2 id="scores-h" className="eyebrow">Lighthouse score</h2>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {(["mobile", "desktop"] as const).map((s) => {
              const l = data.latest[s];
              const Icon = s === "mobile" ? Smartphone : Monitor;
              return (
                <div key={s} className="flex flex-col items-center gap-3 text-center">
                  <ScoreRing score={l?.score ?? null} size={104} label={`${s} score`} />
                  <div>
                    <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
                      <Icon className="size-3.5 text-muted-foreground" aria-hidden /> {s === "mobile" ? "Mobile" : "Desktop"}
                    </p>
                    {l ? <RatingLabel rating={rateScore(l.score)} className="mt-1 flex justify-center" /> : <p className="mt-1 text-xs text-subtle">No runs yet</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Lab test.</span> Google loads the page once on a simulated mid-range phone and on a desktop, then
              scores it 0–100. Expect a few points of wobble between runs.
            </p>
            {data.latest.mobile && (
              <p className="text-subtle">
                Last tested {timeAgo(data.latest.mobile.t)} · {formatDateTime(data.latest.mobile.t)}
              </p>
            )}
          </div>
        </section>

        <FieldPanel field={field} />
      </div>

      {/* Trend */}
      <section className="panel" aria-labelledby="trend-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <h2 id="trend-h" className="text-sm font-medium text-foreground">
            {metric === "score" ? "Performance score" : METRICS[metric].label} <span className="text-subtle">· {strategy}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Device"
              value={strategy}
              onChange={setStrategy}
              options={[
                { value: "mobile", label: <><Smartphone className="size-3.5" aria-hidden /> Mobile</> },
                { value: "desktop", label: <><Monitor className="size-3.5" aria-hidden /> Desktop</> },
              ]}
            />
            {/* Ranges only mean something once there's more than a week of history. */}
            {!youngSite && (
            <nav aria-label="Time range" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`${basePath}?range=${r}`}
                  scroll={false}
                  aria-current={range === r ? "page" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground",
                    range === r && "bg-raised text-foreground",
                  )}
                >
                  {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
                </Link>
              ))}
            </nav>
            )}
          </div>
        </div>

        <div className="overflow-x-auto px-3 pt-3 sm:px-4 [scrollbar-width:thin]">
          <div className="flex min-w-max gap-1 pb-1" role="radiogroup" aria-label="Metric">
            {(["score", ...LAB_METRICS] as ChartMetric[]).map((m) => {
              const run = latestRun;
              const value = run ? (m === "score" ? run.score : run[m]) : null;
              const start = ok.length < 2 ? null : median(startRuns.map((c) => (m === "score" ? c.score : c[m])).filter((v): v is number => v != null));
              const rating = value == null ? null : m === "score" ? rateScore(value) : rateMetric(m, value);
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={metric === m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    "min-w-[7.5rem] rounded-lg border border-transparent px-3 py-2.5 text-left outline-none transition-colors hover:bg-raised/60 focus-visible:ring-2 focus-visible:ring-ring",
                    metric === m && "border-border bg-raised",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {rating && <span className={cn("size-1.5 rounded-full", RATING_BG[rating])} aria-hidden />}
                    {m === "score" ? "Score" : METRICS[m].short}
                  </span>
                  <span className="mt-1 block text-lg font-semibold tabular-nums tracking-tight text-foreground">
                    {value == null ? "—" : m === "score" ? value : formatMetric(m, value)}
                  </span>
                  <Delta metric={m} now={value} then={start} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-2 pb-3 pt-2 sm:px-4">
          {points.length >= 2 ? (
            <TrendChart points={points} deploys={data.deploys.filter((d) => d.t >= chartFrom).map((d) => ({ t: d.t, ref: d.ref, message: d.message }))} metric={metric} from={chartFrom} to={data.to} />
          ) : (
            <div className="grid h-[260px] place-items-center px-6 text-center">
              <div className="max-w-sm">
                <svg viewBox="0 0 160 40" className="mx-auto h-8 w-32" aria-hidden>
                  <path d="M0 22h50l6-12 9 24 7-30 8 26 5-8h75" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
                </svg>
                <p className="mt-4 font-medium text-foreground">{points.length ? "The trend starts with the next run" : "No successful runs yet"}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {points.length
                    ? `One run so far (${metric === "score" ? points[0].value : formatMetric(metric, points[0].value)}). VitalsWatch tests this page every day at 02:30 UTC, so the line appears tomorrow. Run a check now to add a point sooner.`
                    : "Once a run succeeds, its result shows up here and a new point is added every day."}
                </p>
              </div>
            </div>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-xs text-subtle sm:px-6">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand" aria-hidden /> {metric === "score" ? "Score" : METRICS[metric].short} ({strategy})</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rotate-45 rounded-[1px] bg-foreground" aria-hidden /> Deploy</span>
          <span>
            {newSite ? `Watching since ${formatDay(firstRun)}. ` : ""}Lab data from Lighthouse: one run a day, plus one after every deploy.
          </span>
        </p>
      </section>

      <DiagnosticsSection details={data.details[strategy]} siteUrl={siteUrl} strategy={strategy} siteId={siteId} />

      <DeployImpact deploys={data.deploys} runs={runs} strategy={strategy} siteId={siteId} canEdit={canEdit} />

      <History runs={inRange} deploys={data.deploys} />
    </div>
  );
}

function Delta({ metric, now, then }: { metric: ChartMetric; now: number | null | undefined; then: number | null }) {
  if (now == null || then == null) return <span className="mt-0.5 block text-[11px] text-subtle">&nbsp;</span>;
  const diff = now - then;
  // Higher score is better; for every timing, lower is better.
  const better = metric === "score" ? diff > 0 : diff < 0;
  const noise = metric === "score" ? Math.abs(diff) < 2 : metric === "cls" ? Math.abs(diff) < 0.01 : Math.abs(diff) < 50;
  const text = metric === "score" ? `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(Math.round(diff))}` : formatDelta(metric, diff);
  const Icon = noise ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("mt-0.5 inline-flex items-center gap-0.5 text-[11px] tabular-nums", noise ? "text-subtle" : better ? "text-good" : "text-poor")}>
      <Icon className="size-3" aria-hidden />
      {noise ? "steady" : text}
      <span className="sr-only">{noise ? "" : better ? " (better)" : " (worse)"} since the start of the range</span>
    </span>
  );
}

/** p75 marker on a three-zone bar: where real users sit relative to the thresholds. */
function ThresholdBar({ metric, value }: { metric: FieldMetric; value: number }) {
  const [good, poor] = METRICS[metric].thresholds;
  const max = poor * 1.5;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="relative mt-3 h-1.5" aria-hidden>
      <div className="absolute inset-0 flex gap-[2px] overflow-hidden rounded-full">
        <span className="h-full bg-good/70" style={{ width: pct(good) }} />
        <span className="h-full bg-warn/70" style={{ width: `calc(${pct(poor)} - ${pct(good)})` }} />
        <span className="h-full flex-1 bg-poor/70" />
      </div>
      <span className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card" style={{ left: pct(value) }} />
    </div>
  );
}

/** Plain-language reason for the pass/fail badge: which metric misses, by how much, and what the data is. */
function FieldVerdict({ field }: { field: FieldData }) {
  const target = (m: FieldMetric) => `${METRICS[m].short} ≤ ${formatMetric(m, METRICS[m].thresholds[0])}`;
  const misses = CORE_FIELD_METRICS.flatMap((m) => {
    const v = field.metrics[m];
    return v && v.rating !== "good" ? [{ m, v }] : [];
  });
  const fails = field.overall != null && field.overall !== "good";
  return (
    <div className={cn("mt-6 rounded-lg border px-4 py-3 text-xs leading-relaxed", fails ? "border-poor/25 bg-poor/[0.06]" : "border-border bg-surface")}>
      {fails ? (
        <p className="text-foreground">
          <span className="font-medium">Why it fails: </span>
          {misses.length
            ? misses.map(({ m, v }, i) => (
                <span key={m}>
                  {i > 0 && (i === misses.length - 1 ? " and " : ", ")}
                  {METRICS[m].short} is <span className="font-medium tabular-nums">{formatMetric(m, v.p75)}</span> (needs {target(m).replace(`${METRICS[m].short} `, "")})
                </span>
              ))
            : "at least one of the three metrics is outside the good range"}
          . To pass, 75% of visits need all three in the green: {CORE_FIELD_METRICS.map(target).join(", ")}.
        </p>
      ) : field.overall === "good" ? (
        <p className="text-foreground">
          <span className="font-medium">Passes:</span> at least 75% of visits get a good LCP, INP and CLS.
        </p>
      ) : null}
      <p className="mt-1.5 text-muted-foreground">
        This is real-visitor data from Google&apos;s Chrome UX Report, the same numbers Google uses for search ranking. It moves slowly (a rolling
        28 days) and can differ from the lab score on the left, which is one simulated load.
      </p>
    </div>
  );
}

function FieldPanel({ field }: { field: FieldData | null }) {
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="field-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="field-h" className="eyebrow inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden /> Real users · Core Web Vitals
          </h2>
          <p className="mt-1.5 text-xs text-subtle">
            {field
              ? `75th percentile of Chrome users on phones, last 28 days${field.scope === "origin" ? " (whole site)" : " (this page)"}.`
              : "From the Chrome UX Report."}
          </p>
        </div>
        {field?.overall && (
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              field.overall === "good" ? "border-good/30 bg-good/10 text-good" : "border-poor/30 bg-poor/10 text-poor",
            )}
          >
            {field.overall === "good" ? "Passes" : "Fails"} Core Web Vitals
          </span>
        )}
      </div>

      {field ? (
        <>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {CORE_FIELD_METRICS.map((m) => {
            const v = field.metrics[m];
            return (
              <div key={m}>
                <p className="text-xs text-muted-foreground" title={METRICS[m].label}>
                  {METRICS[m].short} <span className="text-subtle">· {METRICS[m].label}</span>
                </p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{v ? formatMetric(m, v.p75) : "—"}</p>
                {v ? (
                  <>
                    <RatingLabel rating={v.rating} className="mt-1" />
                    <ThresholdBar metric={m} value={v.p75} />
                  </>
                ) : (
                  <p className="mt-1 text-xs text-subtle">Not enough data</p>
                )}
              </div>
            );
          })}
        </div>
        <FieldVerdict field={field} />
        </>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border-strong p-4 text-sm text-muted-foreground">
          Chrome doesn&apos;t have enough real-user traffic for this site yet, so only lab results (Lighthouse) are shown. Field data appears once the
          site gets regular visits from Chrome users.
        </div>
      )}
    </section>
  );
}

const VERDICT: Record<Verdict, { label: string; className: string; Icon: typeof ArrowUpRight }> = {
  slower: { label: "Slower", className: "text-poor", Icon: ArrowDownRight },
  faster: { label: "Faster", className: "text-good", Icon: ArrowUpRight },
  unchanged: { label: "No change", className: "text-muted-foreground", Icon: Minus },
  pending: { label: "Measuring", className: "text-subtle", Icon: Minus },
};

function DeployImpact({
  deploys,
  runs,
  strategy,
  siteId,
  canEdit,
}: {
  deploys: ReportData["deploys"];
  runs: ReportCheck[];
  strategy: Strategy;
  siteId: string;
  canEdit: boolean;
}) {
  const points: CheckPoint[] = useMemo(() => runs.map((r) => ({ ...r, createdAt: new Date(r.t) })), [runs]);
  return (
    <section className="panel" aria-labelledby="deploys-h">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 id="deploys-h" className="text-sm font-medium text-foreground">Deploys</h2>
          <p className="mt-0.5 max-w-xl text-xs text-subtle">
            Did a release make the page faster or slower? Each one compares the median of 3 runs before it with 3 runs after ({strategy}), so one noisy
            run can&apos;t fool you.
          </p>
        </div>
        {canEdit && <RecordDeployButton siteId={siteId} />}
      </div>
      {deploys.length ? (
        <ul className="divide-y divide-border">
          {deploys.slice(0, 8).map((d) => {
            const c = compareAroundDeploy(points, new Date(d.t));
            const v = VERDICT[c.verdict];
            const diff = c.before.score != null && c.after.score != null ? Math.round(c.after.score - c.before.score) : null;
            return (
              <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 sm:px-6">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <GitCommitHorizontal className="size-4 shrink-0 text-subtle" aria-hidden />
                    <span className="font-mono text-xs text-muted-foreground">{d.ref}</span>
                    <span className="truncate">{d.message ?? "Deploy"}</span>
                  </p>
                  <p className="mt-0.5 pl-6 text-xs text-subtle">
                    {formatDay(d.t)} · LCP {formatMetric("lcp", c.before.lcp)} → {formatMetric("lcp", c.after.lcp)} · TBT {formatMetric("tbt", c.before.tbt)} →{" "}
                    {formatMetric("tbt", c.after.tbt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-2 text-sm tabular-nums text-foreground">
                    <ScoreChip score={c.before.score == null ? null : Math.round(c.before.score)} />
                    <span className="text-subtle" aria-label="to">→</span>
                    <ScoreChip score={c.after.score == null ? null : Math.round(c.after.score)} />
                  </p>
                  <p className={cn("mt-0.5 inline-flex items-center gap-1 text-xs font-medium", v.className)}>
                    <v.Icon className="size-3.5" aria-hidden /> {v.label}
                    {diff != null && c.verdict !== "pending" && c.verdict !== "unchanged" && ` ${diff > 0 ? "+" : "−"}${Math.abs(diff)}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">
          {canEdit
            ? "No deploys yet. When you release a change, click Record a deploy (or connect GitHub in Settings → Deploys) to see whether it helped or hurt."
            : "No deploys recorded in this range."}
        </p>
      )}
    </section>
  );
}

/** One-line reason for a failed run; the full message stays in the row's tooltip. */
function shortError(error: string | null): string {
  if (!error) return "Unknown error";
  if (/rate-limit|quota/i.test(error)) return "Google rate limit (usually before an API key was added)";
  if (/took too long|timeout/i.test(error)) return "Google took too long to answer";
  if (/NO_FCP|did not paint/i.test(error)) return "The page didn't render anything in time";
  if (/couldn't load the page|DNS|ERR_/i.test(error)) return "Google couldn't load the page";
  return error.length > 90 ? `${error.slice(0, 87)}…` : error;
}

function History({ runs, deploys }: { runs: ReportCheck[]; deploys: ReportData["deploys"] }) {
  const [showAll, setShowAll] = useState(false);
  const rows = [...runs].reverse();
  const shown = showAll ? rows : rows.slice(0, 10);
  const deployRef = (t: number) => deploys.find((d) => t >= d.t && t - d.t < 30 * 60_000)?.ref;
  const cols: LabMetric[] = ["lcp", "tbt", "cls", "fcp", "ttfb"];
  return (
    <section className="panel" aria-labelledby="history-h">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 id="history-h" className="text-sm font-medium text-foreground">Run history</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-subtle">
              <th scope="col" className="px-5 py-2.5 font-medium sm:px-6">When</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Trigger</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Score</th>
              {cols.map((m) => (
                <th key={m} scope="col" className="px-3 py-2.5 text-right font-medium">
                  <abbr title={METRICS[m].label} className="no-underline">{METRICS[m].short}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((r) => (
              <tr key={r.id} className="text-muted-foreground">
                <td className="whitespace-nowrap px-5 py-2.5 sm:px-6">{formatDateTime(r.t)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {r.trigger === "deploy" ? (
                    <span>Deploy <span className="font-mono text-xs">{deployRef(r.t) ?? ""}</span></span>
                  ) : r.trigger === "manual" ? (
                    "By hand"
                  ) : (
                    "Daily"
                  )}
                </td>
                {r.score == null ? (
                  <td colSpan={cols.length + 1} className="px-3 py-2.5 text-xs" title={r.error ?? undefined}>
                    <span className="inline-flex items-center gap-1.5 font-medium text-poor">
                      <CircleX className="size-3.5" aria-hidden /> Didn&apos;t run
                    </span>
                    <span className="ml-2 text-subtle">{shortError(r.error)}</span>
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2.5"><ScoreChip score={r.score} /></td>
                    {cols.map((m) => (
                      <td key={m} className="px-3 py-2.5 text-right tabular-nums">{formatMetric(m, r[m])}</td>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <div className="border-t border-border px-5 py-3 sm:px-6">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {showAll ? "Show fewer" : `Show all ${rows.length} runs`}
          </button>
        </div>
      )}
    </section>
  );
}
