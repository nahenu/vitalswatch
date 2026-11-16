/**
 * The detailed half of a Lighthouse run: which element was the LCP, which
 * files and elements caused each problem, third parties, a filmstrip.
 * Parsed out of the ~700 KB PageSpeed response into a compact record, so
 * every run keeps the "why" next to its numbers.
 */

export interface DomNode {
  snippet?: string;
  selector?: string;
  label?: string;
  rect?: { top: number; left: number; width: number; height: number };
}

export interface IssueItem {
  url?: string;
  label?: string;
  node?: DomNode;
  totalBytes?: number;
  wastedBytes?: number;
  /** Time attributed to the item: wasted, blocking, execution or task duration. */
  ms?: number;
  /** Extra detail Lighthouse gives per row, e.g. "Using a modern image format…". */
  note?: string;
}

export interface Issue {
  id: string;
  title: string;
  /** Lighthouse's own explanation with markdown links removed. */
  description: string;
  learnMore?: string;
  displayValue?: string;
  /** Estimated saving on the metric it helps most. */
  savingsMs: number;
  savingsBytes: number;
  /** Which metrics it affects, e.g. ["LCP", "TBT"]. */
  metrics: string[];
  items: IssueItem[];
  /** For checklist-style insights: which checks failed. */
  failedChecks?: string[];
}

export interface LcpDetail {
  element?: DomNode;
  /** The image (or other resource) behind the LCP element, if any. */
  resourceUrl?: string;
  phases: { key: string; label: string; ms: number }[];
  checks: { label: string; ok: boolean }[];
}

export interface Diagnostics {
  lighthouseVersion?: string;
  screen?: { width: number; height: number };
  finalScreenshot?: string;
  filmstrip: { ms: number; img: string }[];
  lcp?: LcpDetail;
  layoutShifts: { node: DomNode; score: number; causes: string[] }[];
  issues: Issue[];
  thirdParties: { entity: string; bytes: number; mainThreadMs: number; urls: string[] }[];
  resources: { type: string; label: string; requests: number; bytes: number }[];
  totals: { requests: number; bytes: number };
  mainThread: { label: string; ms: number }[];
  longTasks: { url?: string; ms: number; startMs: number }[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** Audits that are measurements, not things to fix. */
const METRIC_AUDITS = new Set([
  "largest-contentful-paint",
  "first-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
  "interactive",
  "max-potential-fid",
  "server-response-time",
]);

export function stripLinks(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Snippets can embed whole base64 images; keep them short and readable. */
function cleanSnippet(s: string | undefined): string | undefined {
  if (!s) return s;
  const out = s.replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]{16,}…?/gi, "data:…");
  return out.length > 320 ? `${out.slice(0, 317)}…` : out;
}

function parseNode(v: unknown): DomNode | undefined {
  const n = obj(v);
  if (!n || n.type !== "node") return undefined;
  const r = obj(n.boundingRect);
  return {
    snippet: cleanSnippet(str(n.snippet)),
    selector: str(n.selector),
    label: str(n.nodeLabel),
    rect:
      r && num(r.top) != null
        ? { top: num(r.top)!, left: num(r.left) ?? 0, width: num(r.width) ?? 0, height: num(r.height) ?? 0 }
        : undefined,
  };
}

function parseItem(v: unknown): IssueItem | null {
  const it = obj(v);
  if (!it) return null;
  const node = parseNode(it.node);
  const sub = arr(obj(it.subItems)?.items).map(obj);
  const note = sub.map((s) => str(s?.reason) ?? str(s?.signal) ?? str(s?.cause)).filter(Boolean).slice(0, 3).join(" · ") || undefined;
  const out: IssueItem = {
    url: str(it.url),
    label: str(it.entity) ?? str(it.label) ?? str(it.groupLabel) ?? (obj(it.entity) ? str(obj(it.entity)!.text) : undefined),
    node,
    totalBytes: num(it.totalBytes) ?? num(it.transferSize),
    wastedBytes: num(it.wastedBytes),
    ms: num(it.wastedMs) ?? num(it.mainThreadTime) ?? num(it.total) ?? num(it.duration),
    note,
  };
  return out.url || out.label || out.node ? out : null;
}

/** Rows of a details block, looking inside "list" details for their tables. */
function detailRows(details: Json | undefined): unknown[] {
  if (!details) return [];
  if (details.type === "list") return arr(details.items).flatMap((x) => (obj(x)?.type === "table" ? arr(obj(x)!.items) : []));
  return arr(details.items);
}

function failedChecklist(details: Json | undefined): string[] {
  const lists = details?.type === "checklist" ? [details] : arr(details?.items).map(obj).filter((x) => x?.type === "checklist");
  return lists.flatMap((l) =>
    Object.values(obj(l!.items) ?? {})
      .map(obj)
      .filter((c) => c && c.value === false)
      .map((c) => str(c!.label) ?? ""),
  ).filter(Boolean);
}

function parseIssue(id: string, audit: Json): Issue | null {
  const score = num(audit.score);
  const mode = str(audit.scoreDisplayMode);
  if (METRIC_AUDITS.has(id) || score == null || score >= 0.9) return null;
  if (mode && !["metricSavings", "numeric", "binary"].includes(mode)) return null;

  const details = obj(audit.details);
  const savings = obj(audit.metricSavings) ?? {};
  const metrics = Object.entries(savings)
    .filter(([, v]) => (num(v) ?? 0) > 0)
    .map(([k]) => k);
  const savingsMs = Math.round(Math.max(num(details?.overallSavingsMs) ?? 0, ...["LCP", "FCP", "TBT", "INP"].map((k) => num(savings[k]) ?? 0)));
  const items = detailRows(details)
    .map(parseItem)
    .filter((x): x is IssueItem => !!x)
    .slice(0, 8);
  const savingsBytes = Math.round(num(details?.overallSavingsBytes) ?? num(obj(details?.debugData)?.wastedBytes) ?? items.reduce((s, i) => s + (i.wastedBytes ?? 0), 0));
  const description = str(audit.description) ?? "";

  return {
    id,
    title: str(audit.title) ?? id,
    description: stripLinks(description),
    learnMore: description.match(/\]\((https?:[^)]+)\)/)?.[1],
    displayValue: str(audit.displayValue),
    savingsMs,
    savingsBytes,
    metrics: metrics.length ? metrics : Object.keys(savings),
    items,
    failedChecks: failedChecklist(details),
  };
}

function pickEvenly<T>(xs: T[], n: number): T[] {
  if (xs.length <= n) return xs;
  return Array.from({ length: n }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (n - 1))]);
}

export function parseDiagnostics(json: unknown): Diagnostics {
  const lh = obj(obj(json)?.lighthouseResult) ?? {};
  const audits = obj(lh.audits) ?? {};
  const audit = (id: string) => obj(audits[id]);
  const details = (id: string) => obj(audit(id)?.details);

  // LCP: element + phase breakdown + discovery checklist.
  const breakdown = arr(details("lcp-breakdown-insight")?.items).map(obj);
  const discovery = arr(details("lcp-discovery-insight")?.items).map(obj);
  const element = [...breakdown, ...discovery].map(parseNode).find(Boolean);
  const phaseTable = breakdown.find((x) => x?.type === "table");
  const checklist = discovery.find((x) => x?.type === "checklist");
  const lcp: LcpDetail | undefined =
    element || phaseTable
      ? {
          element,
          resourceUrl: element?.snippet?.match(/\bsrc(?:set)?="([^"\s]+)/)?.[1],
          phases: arr(phaseTable?.items)
            .map(obj)
            .map((p) => ({ key: str(p?.subpart) ?? "", label: str(p?.label) ?? "", ms: Math.round(num(p?.duration) ?? 0) }))
            .filter((p) => p.label),
          checks: Object.values(obj(checklist?.items) ?? {})
            .map(obj)
            .map((c) => ({ label: str(c?.label) ?? "", ok: c?.value === true }))
            .filter((c) => c.label),
        }
      : undefined;

  // Layout shift culprits (skip the "Total" row).
  const layoutShifts = detailRows(details("cls-culprits-insight"))
    .map(obj)
    .flatMap((row) => {
      const node = parseNode(row?.node);
      const score = num(row?.score);
      if (!node || score == null) return [];
      const causes = arr(obj(row!.subItems)?.items)
        .map((s) => str(obj(s)?.cause))
        .filter((c): c is string => !!c);
      return [{ node, score, causes }];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const issues = Object.entries(audits)
    .map(([id, a]) => (obj(a) ? parseIssue(id, obj(a)!) : null))
    .filter((x): x is Issue => !!x)
    .sort((a, b) => b.savingsMs - a.savingsMs || b.savingsBytes - a.savingsBytes);

  const thirdParties = arr(details("third-parties-insight")?.items)
    .map(obj)
    .map((t) => ({
      entity: str(t?.entity) ?? str(obj(t?.entity)?.text) ?? "Unknown",
      bytes: Math.round(num(t?.transferSize) ?? 0),
      mainThreadMs: Math.round(num(t?.mainThreadTime) ?? 0),
      urls: arr(obj(t?.subItems)?.items)
        .map((s) => str(obj(s)?.url))
        .filter((u): u is string => !!u)
        .slice(0, 4),
    }))
    .sort((a, b) => b.mainThreadMs - a.mainThreadMs || b.bytes - a.bytes)
    .slice(0, 10);

  const summary = arr(details("resource-summary")?.items).map(obj);
  const total = summary.find((r) => r?.resourceType === "total");
  const resources = summary
    .filter((r) => r && r.resourceType !== "total" && (num(r.requestCount) ?? 0) > 0)
    .map((r) => ({ type: str(r!.resourceType) ?? "", label: str(r!.label) ?? "", requests: num(r!.requestCount) ?? 0, bytes: Math.round(num(r!.transferSize) ?? 0) }))
    .sort((a, b) => b.bytes - a.bytes);

  const thumbs = arr(details("screenshot-thumbnails")?.items)
    .map(obj)
    .map((f) => ({ ms: Math.round(num(f?.timing) ?? 0), img: str(f?.data) ?? "" }))
    .filter((f) => f.img.startsWith("data:image/"));

  const emulation = obj(obj(lh.configSettings)?.screenEmulation);
  const finalShot = str(details("final-screenshot")?.data);

  return {
    lighthouseVersion: str(lh.lighthouseVersion),
    screen: num(emulation?.width) ? { width: num(emulation!.width)!, height: num(emulation!.height) ?? 0 } : undefined,
    finalScreenshot: finalShot?.startsWith("data:image/") ? finalShot : undefined,
    filmstrip: pickEvenly(thumbs, 6),
    lcp,
    layoutShifts,
    issues,
    thirdParties,
    resources,
    totals: { requests: num(total?.requestCount) ?? 0, bytes: Math.round(num(total?.transferSize) ?? 0) },
    mainThread: arr(details("mainthread-work-breakdown")?.items)
      .map(obj)
      .map((g) => ({ label: str(g?.groupLabel) ?? "", ms: Math.round(num(g?.duration) ?? 0) }))
      .filter((g) => g.label)
      .sort((a, b) => b.ms - a.ms),
    longTasks: arr(details("long-tasks")?.items)
      .map(obj)
      .map((t) => ({ url: str(t?.url), ms: Math.round(num(t?.duration) ?? 0), startMs: Math.round(num(t?.startTime) ?? 0) }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 6),
  };
}
