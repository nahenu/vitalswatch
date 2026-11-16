import { parseDiagnostics, type Diagnostics } from "./diagnostics";
import type { FieldData, FieldMetric, FieldValue, LabMetric, Opportunity, Rating } from "./vitals";
import { rateMetric } from "./vitals";

/** The parts of a PageSpeed Insights v5 response we read. Everything is optional: never trust its shape. */
interface PsiAudit {
  id?: string;
  title?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  numericValue?: number;
  displayValue?: string;
  details?: { type?: string; overallSavingsMs?: number };
  metricSavings?: Partial<Record<"LCP" | "FCP" | "TBT" | "CLS" | "INP", number>>;
}

interface CruxMetric {
  percentile?: number;
  category?: string;
}

interface CruxExperience {
  metrics?: Record<string, CruxMetric>;
  overall_category?: string;
  origin_fallback?: boolean;
}

export interface PsiResponse {
  lighthouseResult?: {
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, PsiAudit>;
    runtimeError?: { code?: string; message?: string };
  };
  loadingExperience?: CruxExperience;
  originLoadingExperience?: CruxExperience;
}

export interface ParsedCheck {
  score: number | null;
  lab: Record<LabMetric, number | null>;
  field: FieldData | null;
  opportunities: Opportunity[];
  error: string | null;
  diagnostics: Diagnostics | null;
}

const LAB_AUDITS: Record<LabMetric, string> = {
  lcp: "largest-contentful-paint",
  cls: "cumulative-layout-shift",
  tbt: "total-blocking-time",
  fcp: "first-contentful-paint",
  si: "speed-index",
  ttfb: "server-response-time",
};

const CRUX_KEYS: Record<FieldMetric, string> = {
  lcp: "LARGEST_CONTENTFUL_PAINT_MS",
  cls: "CUMULATIVE_LAYOUT_SHIFT_SCORE",
  inp: "INTERACTION_TO_NEXT_PAINT",
  fcp: "FIRST_CONTENTFUL_PAINT_MS",
  ttfb: "EXPERIMENTAL_TIME_TO_FIRST_BYTE",
};

const CRUX_RATING: Record<string, Rating> = { FAST: "good", AVERAGE: "needs-improvement", SLOW: "poor" };

/** Audits that are metrics, not fixes, so never listed as opportunities. */
const METRIC_AUDIT_IDS = new Set([...Object.values(LAB_AUDITS), "interactive", "max-potential-fid"]);

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function parseField(experience: CruxExperience | undefined, scope: FieldData["scope"]): FieldData | null {
  const raw = experience?.metrics;
  if (!raw) return null;
  const metrics: FieldData["metrics"] = {};
  for (const [metric, key] of Object.entries(CRUX_KEYS) as [FieldMetric, string][]) {
    const m = raw[key];
    if (!m || !finite(m.percentile)) continue;
    // CrUX reports CLS multiplied by 100 (5 means 0.05).
    const p75 = metric === "cls" ? m.percentile / 100 : m.percentile;
    const value: FieldValue = { p75, rating: (m.category && CRUX_RATING[m.category]) || rateMetric(metric, p75) };
    metrics[metric] = value;
  }
  if (!Object.keys(metrics).length) return null;
  const overall = experience.overall_category ? (CRUX_RATING[experience.overall_category] ?? null) : null;
  return { scope, overall, metrics };
}

function savingsOf(audit: PsiAudit): number {
  if (finite(audit.details?.overallSavingsMs) && audit.details.overallSavingsMs > 0) return audit.details.overallSavingsMs;
  const s = audit.metricSavings;
  if (!s) return 0;
  return Math.max(0, s.LCP ?? 0, s.FCP ?? 0, s.TBT ?? 0, s.INP ?? 0);
}

function parseOpportunities(audits: Record<string, PsiAudit>): Opportunity[] {
  const out: Opportunity[] = [];
  for (const [id, audit] of Object.entries(audits)) {
    if (METRIC_AUDIT_IDS.has(id) || !audit.title) continue;
    if (!finite(audit.score) || audit.score >= 0.9) continue;
    if (audit.scoreDisplayMode && !["metricSavings", "numeric", "binary"].includes(audit.scoreDisplayMode)) continue;
    const savingsMs = Math.round(savingsOf(audit));
    const layoutFix = (audit.metricSavings?.CLS ?? 0) > 0;
    if (savingsMs <= 0 && !layoutFix) continue;
    out.push({ id, title: audit.title, savingsMs, ...(audit.displayValue ? { displayValue: audit.displayValue } : {}) });
  }
  return out.sort((a, b) => b.savingsMs - a.savingsMs).slice(0, 6);
}

export function parsePsi(json: PsiResponse): ParsedCheck {
  const lh = json.lighthouseResult;
  const audits = lh?.audits ?? {};

  const lab = {} as Record<LabMetric, number | null>;
  for (const [metric, auditId] of Object.entries(LAB_AUDITS) as [LabMetric, string][]) {
    const v = audits[auditId]?.numericValue;
    lab[metric] = finite(v) ? v : null;
  }

  const rawScore = lh?.categories?.performance?.score;
  const score = finite(rawScore) ? Math.round(rawScore * 100) : null;

  const page = json.loadingExperience;
  const field =
    page?.metrics && !page.origin_fallback
      ? parseField(page, "url")
      : parseField(json.originLoadingExperience ?? (page?.origin_fallback ? page : undefined), "origin");

  const runtime = lh?.runtimeError;
  const error = score == null ? runtime?.message || "Lighthouse couldn't measure this page." : null;

  return { score, lab, field, opportunities: parseOpportunities(audits), error, diagnostics: score == null ? null : parseDiagnostics(json) };
}
