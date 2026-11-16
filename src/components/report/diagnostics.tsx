"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, CircleCheck, CircleX, Copy, ExternalLink, FileCode2, GitCompareArrows, ImageIcon, Move, Puzzle } from "lucide-react";
import type { Diagnostics, DomNode, Issue, IssueItem } from "@/lib/diagnostics";
import { diffDiagnostics, isEmptyDiff } from "@/lib/diff";
import { LCP_PHASES, fixFor, type CodeSample } from "@/lib/fixes";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DownloadPdfButton } from "./share-buttons";

export const formatBytes = (b: number | undefined) =>
  b == null ? "—" : b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`;
const formatMs = (ms: number | undefined) => (ms == null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

function shortUrl(url: string, siteOrigin: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 46 ? `…${u.pathname.slice(-44)}` : u.pathname;
    return u.origin === siteOrigin ? path : `${u.hostname}${path === "/" ? "" : path}`;
  } catch {
    return url;
  }
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
    >
      {done ? <Check className="size-3.5 text-good" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ sample }: { sample: CodeSample }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-screen">
      <div className="flex items-center justify-between border-b border-border px-3 py-1">
        <span className="text-[11px] text-subtle">
          {sample.label} <span className="text-subtle">· {sample.lang}</span>
        </span>
        <CopyButton text={sample.code} />
      </div>
      <pre className="whitespace-pre-wrap px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{sample.code}</pre>
    </div>
  );
}

function NodeSnippet({ node }: { node: DomNode }) {
  return (
    <div className="space-y-1.5">
      {node.snippet && (
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-screen px-3 py-2 font-mono text-[11px] leading-relaxed text-brand/90 [overflow-wrap:anywhere]">{node.snippet}</pre>
      )}
      {node.selector && <p className="font-mono text-[10.5px] text-subtle [overflow-wrap:anywhere]">{node.selector}</p>}
    </div>
  );
}

/* ── Filmstrip ─────────────────────────────────────────── */

function Filmstrip({ frames }: { frames: Diagnostics["filmstrip"] }) {
  if (!frames.length) return null;
  return (
    <div className="border-b border-border px-5 py-5 sm:px-6">
      <p className="text-xs font-medium text-muted-foreground">How the page loaded</p>
      <ol className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {frames.map((f) => (
          <li key={f.img} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.img} alt={`Page at ${formatMs(f.ms)}`} loading="lazy" className="h-36 w-auto rounded-md border border-border bg-white object-contain" />
            <p className="mt-1.5 text-center text-[11px] tabular-nums text-subtle">{formatMs(f.ms)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── LCP ───────────────────────────────────────────────── */

const PHASE_COLORS = ["bg-[#7c8cff]", "bg-brand", "bg-[#b38cff]", "bg-[#ff9a62]"];

function LcpCard({ d }: { d: Diagnostics }) {
  const lcp = d.lcp;
  if (!lcp) return null;
  const total = lcp.phases.reduce((s, p) => s + p.ms, 0) || 1;
  const worst = [...lcp.phases].sort((a, b) => b.ms - a.ms)[0];
  const rect = lcp.element?.rect;
  const screen = d.screen;
  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="lcp-h">
      <h3 id="lcp-h" className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ImageIcon className="size-4 text-brand" aria-hidden /> Largest Contentful Paint element
      </h3>
      <p className="mt-1 text-xs text-subtle">The biggest thing on the first screen. Its paint time is the LCP.</p>

      <div className="mt-4 grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
        {d.finalScreenshot && screen ? (
          <div className="relative w-36 self-start overflow-hidden rounded-md border border-border bg-white" style={{ aspectRatio: `${screen.width} / ${screen.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.finalScreenshot} alt="Final screen, LCP element outlined" className="absolute inset-0 size-full object-cover object-top" />
            {rect && (
              <span
                className="absolute rounded-[2px] border-2 border-brand bg-brand/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{
                  top: `${(rect.top / screen.height) * 100}%`,
                  left: `${(rect.left / screen.width) * 100}%`,
                  width: `${(rect.width / screen.width) * 100}%`,
                  height: `${(rect.height / screen.height) * 100}%`,
                }}
              />
            )}
          </div>
        ) : null}

        <div className={cn("min-w-0 space-y-4", !(d.finalScreenshot && screen) && "sm:col-span-2")}>
          {lcp.element && <NodeSnippet node={lcp.element} />}

          {lcp.phases.length > 0 && (
            <div>
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {lcp.phases.map((p, i) => (
                  <span key={p.key} className={cn("h-full", PHASE_COLORS[i % 4])} style={{ width: `${Math.max(2, (p.ms / total) * 100)}%` }} />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {lcp.phases.map((p, i) => (
                  <li key={p.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className={cn("size-2 rounded-sm", PHASE_COLORS[i % 4])} aria-hidden />
                      {LCP_PHASES[p.key]?.short ?? p.label}
                    </span>
                    <span className="tabular-nums text-foreground">{formatMs(p.ms)}</span>
                  </li>
                ))}
              </ul>
              {worst && LCP_PHASES[worst.key] && (
                <p className="mt-3 rounded-md bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Biggest part: {LCP_PHASES[worst.key].short.toLowerCase()} ({Math.round((worst.ms / total) * 100)}%).</span>{" "}
                  {LCP_PHASES[worst.key].advice}
                </p>
              )}
            </div>
          )}

          {lcp.checks.length > 0 && (
            <ul className="space-y-1 text-xs">
              {lcp.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-muted-foreground">
                  {c.ok ? <CircleCheck className="mt-px size-3.5 shrink-0 text-good" aria-hidden /> : <CircleX className="mt-px size-3.5 shrink-0 text-poor" aria-hidden />}
                  {c.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ShiftsCard({ d }: { d: Diagnostics }) {
  if (!d.layoutShifts.length) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="cls-h">
      <h3 id="cls-h" className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Move className="size-4 text-brand" aria-hidden /> Elements that moved (CLS)
      </h3>
      <ul className="mt-4 space-y-4">
        {d.layoutShifts.map((s, i) => (
          <li key={i}>
            <p className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{s.causes.length ? s.causes.join(" · ") : "Shifted while loading"}</span>
              <span className="tabular-nums text-foreground">{s.score < 0.001 ? "<0.001" : s.score.toFixed(3)}</span>
            </p>
            <NodeSnippet node={s.node} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── What changed ──────────────────────────────────────── */

function ChangesCard({ d, baseline, siteOrigin }: { d: Diagnostics; baseline: { t: number; label: string; diag: Diagnostics } | null; siteOrigin: string }) {
  if (!baseline) {
    return (
      <section className="rounded-xl border border-dashed border-border-strong p-5 text-sm text-muted-foreground">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GitCompareArrows className="size-4 text-brand" aria-hidden /> What changed
        </h3>
        <p className="mt-2 text-xs">After the next run, this shows new and removed scripts, issues and page weight, run to run and around each deploy.</p>
      </section>
    );
  }
  const diff = diffDiagnostics(baseline.diag, d);
  const quiet = isEmptyDiff(diff);
  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="diff-h">
      <h3 id="diff-h" className="flex items-center gap-2 text-sm font-medium text-foreground">
        <GitCompareArrows className="size-4 text-brand" aria-hidden /> What changed {baseline.label}
      </h3>
      <p className="mt-1 text-xs text-subtle">Compared with the run on {formatDateTime(baseline.t)}.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <p className="text-subtle">Page weight</p>
          <p className={cn("mt-1 font-medium tabular-nums", diff.bytesDelta > 20_000 ? "text-poor" : diff.bytesDelta < -20_000 ? "text-good" : "text-foreground")}>
            {diff.bytesDelta > 0 ? "+" : diff.bytesDelta < 0 ? "−" : "±"}
            {formatBytes(Math.abs(diff.bytesDelta))}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <p className="text-subtle">Requests</p>
          <p className={cn("mt-1 font-medium tabular-nums", diff.requestsDelta > 3 ? "text-poor" : diff.requestsDelta < -3 ? "text-good" : "text-foreground")}>
            {diff.requestsDelta > 0 ? "+" : diff.requestsDelta < 0 ? "−" : "±"}
            {Math.abs(diff.requestsDelta)}
          </p>
        </div>
      </div>

      {quiet ? (
        <p className="mt-4 text-xs text-muted-foreground">No new scripts, issues or third parties. Score movement is likely run-to-run noise.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-xs">
          {diff.newThirdParties.map((t) => (
            <li key={`tp+${t.entity}`} className="flex items-start gap-2">
              <ArrowUpRight className="mt-px size-3.5 shrink-0 text-poor" aria-hidden />
              <span className="text-foreground">
                New third party <span className="font-medium">{t.entity}</span>
                <span className="text-muted-foreground"> · {formatBytes(t.bytes)}, {formatMs(t.mainThreadMs)} on the main thread</span>
              </span>
            </li>
          ))}
          {diff.newIssues.map((i) => (
            <li key={`i+${i.id}`} className="flex items-start gap-2">
              <ArrowUpRight className="mt-px size-3.5 shrink-0 text-poor" aria-hidden />
              <span className="text-foreground">
                New issue: {i.title}
                {i.displayValue && <span className="text-muted-foreground"> · {i.displayValue}</span>}
              </span>
            </li>
          ))}
          {diff.newFiles.slice(0, 4).map((f) => (
            <li key={`f+${f.url}`} className="flex items-start gap-2">
              <FileCode2 className="mt-px size-3.5 shrink-0 text-warn" aria-hidden />
              <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
                New file <span className="text-foreground">{shortUrl(f.url, siteOrigin)}</span>
                {(f.bytes > 0 || f.ms > 0) && ` · ${[f.bytes ? formatBytes(f.bytes) : "", f.ms ? formatMs(f.ms) : ""].filter(Boolean).join(", ")}`}
              </span>
            </li>
          ))}
          {diff.resolvedIssues.map((i) => (
            <li key={`i-${i.id}`} className="flex items-start gap-2">
              <ArrowDownRight className="mt-px size-3.5 shrink-0 text-good" aria-hidden />
              <span className="text-foreground">Fixed: {i.title}</span>
            </li>
          ))}
          {diff.goneThirdParties.map((t) => (
            <li key={`tp-${t.entity}`} className="flex items-start gap-2">
              <ArrowDownRight className="mt-px size-3.5 shrink-0 text-good" aria-hidden />
              <span className="text-foreground">Removed third party {t.entity}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Issues ────────────────────────────────────────────── */

function ItemsTable({ items, siteOrigin }: { items: IssueItem[]; siteOrigin: string }) {
  const hasBytes = items.some((i) => i.totalBytes != null);
  const hasWaste = items.some((i) => i.wastedBytes != null);
  const hasMs = items.some((i) => i.ms != null);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[30rem] text-xs">
        <thead>
          <tr className="text-left text-subtle">
            <th scope="col" className="px-3 py-2 font-medium">File or element</th>
            {hasBytes && <th scope="col" className="px-3 py-2 text-right font-medium">Size</th>}
            {hasWaste && <th scope="col" className="px-3 py-2 text-right font-medium">Can save</th>}
            {hasMs && <th scope="col" className="px-3 py-2 text-right font-medium">Time</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((it, i) => (
            <tr key={i} className="align-top">
              <td className="px-3 py-2">
                {it.url ? (
                  <a href={it.url} target="_blank" rel="noreferrer" className="text-foreground hover:text-brand [overflow-wrap:anywhere]" title={it.url}>
                    {shortUrl(it.url, siteOrigin)}
                  </a>
                ) : it.label ? (
                  <span className="text-foreground">{it.label}</span>
                ) : null}
                {it.node && !it.url && <NodeSnippet node={it.node} />}
                {it.note && <p className="mt-0.5 text-subtle">{it.note}</p>}
              </td>
              {hasBytes && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBytes(it.totalBytes)}</td>}
              {hasWaste && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-warn">{it.wastedBytes ? formatBytes(it.wastedBytes) : "—"}</td>}
              {hasMs && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">{formatMs(it.ms)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssueRow({ issue, index, siteUrl, d }: { issue: Issue; index: number; siteUrl: string; d: Diagnostics }) {
  const fix = fixFor(issue, siteUrl, d.lcp);
  const siteOrigin = new URL(siteUrl).origin;
  const saving = issue.savingsMs > 0 ? `−${formatMs(issue.savingsMs)}` : issue.savingsBytes > 0 ? `−${formatBytes(issue.savingsBytes)}` : issue.displayValue;
  return (
    <details className="group border-b border-border last:border-b-0" open={index === 0}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 outline-none hover:bg-white/[0.02] focus-visible:bg-white/[0.03] sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-raised text-[11px] font-medium text-muted-foreground">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{issue.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {issue.metrics.slice(0, 3).map((m) => (
              <span key={m} className="rounded border border-border px-1.5 py-px text-[10px] font-medium text-subtle">
                {m}
              </span>
            ))}
            {issue.items.length > 0 && <span className="text-[11px] text-subtle">{issue.items.length} {issue.items.length === 1 ? "item" : "items"}</span>}
          </span>
        </span>
        {saving && <span className="shrink-0 text-xs font-medium tabular-nums text-warn">{saving}</span>}
        <ChevronDown className="size-4 shrink-0 text-subtle transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="space-y-4 px-5 pb-6 sm:px-6 sm:pl-[3.75rem]">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-subtle">Why it matters</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{fix.why}</p>
        </div>
        {issue.items.length > 0 && <ItemsTable items={issue.items} siteOrigin={siteOrigin} />}
        {fix.steps.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-subtle">How to fix it</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-sm text-muted-foreground marker:text-subtle">
              {fix.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        )}
        {fix.code.map((c) => (
          <CodeBlock key={c.label} sample={c} />
        ))}
        {issue.learnMore && (
          <a href={issue.learnMore} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-subtle hover:text-foreground">
            Google&apos;s guide <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </details>
  );
}

/* ── Third parties & weight ────────────────────────────── */

function ThirdParties({ d }: { d: Diagnostics }) {
  if (!d.thirdParties.length) return null;
  return (
    <section className="rounded-xl border border-border bg-surface" aria-labelledby="tp-h">
      <h3 id="tp-h" className="flex items-center gap-2 border-b border-border px-5 py-4 text-sm font-medium text-foreground">
        <Puzzle className="size-4 text-brand" aria-hidden /> Third-party code
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-subtle">
            <th scope="col" className="px-5 py-2 font-medium">Company</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Download</th>
            <th scope="col" className="px-5 py-2 text-right font-medium">Main thread</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {d.thirdParties.map((t) => (
            <tr key={t.entity}>
              <td className="px-5 py-2 text-foreground">{t.entity}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBytes(t.bytes)}</td>
              <td className={cn("px-5 py-2 text-right tabular-nums", t.mainThreadMs >= 250 ? "text-poor" : "text-muted-foreground")}>{formatMs(t.mainThreadMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Weight({ d }: { d: Diagnostics }) {
  if (!d.resources.length) return null;
  const max = Math.max(...d.resources.map((r) => r.bytes), 1);
  const mtMax = Math.max(...d.mainThread.map((m) => m.ms), 1);
  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="weight-h">
      <h3 id="weight-h" className="text-sm font-medium text-foreground">
        Page weight <span className="font-normal text-subtle">· {formatBytes(d.totals.bytes)}, {d.totals.requests} requests</span>
      </h3>
      <ul className="mt-4 space-y-2.5">
        {[...d.resources].sort((a, b) => b.bytes - a.bytes).slice(0, 6).map((r) => (
          <li key={r.type} className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <span className="block h-full rounded-full bg-brand/70" style={{ width: `${(r.bytes / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-foreground">{formatBytes(r.bytes)}</span>
          </li>
        ))}
      </ul>
      {d.mainThread.length > 0 && (
        <>
          <h4 className="mt-6 text-xs font-medium text-muted-foreground">Main-thread time</h4>
          <ul className="mt-3 space-y-2.5">
            {d.mainThread.slice(0, 5).map((m) => (
              <li key={m.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-xs">
                <span className="truncate text-muted-foreground">{m.label}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <span className="block h-full rounded-full bg-[#b38cff]/70" style={{ width: `${(m.ms / mtMax) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-foreground">{formatMs(m.ms)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ── Section ───────────────────────────────────────────── */

export function DiagnosticsSection({
  details,
  siteUrl,
  strategy,
  siteId,
}: {
  siteId: string;
  details: { checkId: number; t: number; diag: Diagnostics; baseline: { t: number; label: string; diag: Diagnostics } | null } | null;
  siteUrl: string;
  strategy: string;
}) {
  if (!details) {
    return (
      <section className="panel px-6 py-10 text-center text-sm text-muted-foreground">
        Detailed diagnostics (elements, files and code fixes) appear after the next {strategy} run.
      </section>
    );
  }
  const d = details.diag;
  const siteOrigin = new URL(siteUrl).origin;
  return (
    <section className="panel overflow-hidden" aria-labelledby="diag-h">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 id="diag-h" className="text-sm font-medium text-foreground">
            Why it&apos;s slow <span className="text-subtle">· {strategy}</span>
          </h2>
          <p className="mt-0.5 text-xs text-subtle">
            From the run on {formatDateTime(details.t)}
            {d.lighthouseVersion ? ` · Lighthouse ${d.lighthouseVersion}` : ""}. Every issue lists the exact files and a fix you can paste.
          </p>
        </div>
        <DownloadPdfButton siteId={siteId} strategy={strategy} compact />
      </div>

      <Filmstrip frames={d.filmstrip} />

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <LcpCard d={d} />
          <ShiftsCard d={d} />
        </div>
        <div className="space-y-4">
          <ChangesCard d={d} baseline={details.baseline} siteOrigin={siteOrigin} />
          <ThirdParties d={d} />
        </div>
      </div>

      <div className="border-t border-border">
        <h3 className="px-5 pb-1 pt-5 text-sm font-medium text-foreground sm:px-6">
          Issues to fix <span className="font-normal text-subtle">· {d.issues.length}, biggest impact first</span>
        </h3>
        {d.issues.length ? (
          <div>
            {d.issues.map((issue, i) => (
              <IssueRow key={issue.id} issue={issue} index={i} siteUrl={siteUrl} d={d} />
            ))}
          </div>
        ) : (
          <p className="px-5 pb-6 pt-2 text-sm text-muted-foreground sm:px-6">Lighthouse found nothing significant to fix on this run.</p>
        )}
      </div>

      <div className="border-t border-border p-4 sm:p-5">
        <Weight d={d} />
      </div>
    </section>
  );
}
