/**
 * Core Web Vitals vocabulary shared by the server (PageSpeed parsing, alerts,
 * PDF reports) and the UI. Thresholds follow web.dev and Lighthouse's own scoring.
 */

export type Strategy = "mobile" | "desktop";
export type Trigger = "manual" | "scheduled" | "deploy";
export type Rating = "good" | "needs-improvement" | "poor";

export type LabMetric = "lcp" | "cls" | "tbt" | "fcp" | "si" | "ttfb";
export type FieldMetric = "lcp" | "cls" | "inp" | "fcp" | "ttfb";
export type Metric = LabMetric | FieldMetric;

export interface FieldValue {
  /** 75th percentile across real Chrome users over the last 28 days. */
  p75: number;
  rating: Rating;
}

export interface FieldData {
  /** "url" when Chrome has enough traffic for this exact page, otherwise the whole origin. */
  scope: "url" | "origin";
  /** Passes Core Web Vitals when LCP, INP and CLS are all good. */
  overall: Rating | null;
  metrics: Partial<Record<FieldMetric, FieldValue>>;
}

export interface Opportunity {
  id: string;
  title: string;
  /** Estimated time saved, in ms (0 when Lighthouse doesn't estimate one). */
  savingsMs: number;
  displayValue?: string;
}

interface MetricInfo {
  label: string;
  short: string;
  /** [good upper bound, poor lower bound]: value <= good is good, value > poor is poor. */
  thresholds: [number, number];
  unit: "ms" | "unitless";
  description: string;
}

export const METRICS: Record<Metric, MetricInfo> = {
  lcp: {
    label: "Largest Contentful Paint",
    short: "LCP",
    thresholds: [2500, 4000],
    unit: "ms",
    description: "When the main content (hero image or headline) finishes rendering.",
  },
  inp: {
    label: "Interaction to Next Paint",
    short: "INP",
    thresholds: [200, 500],
    unit: "ms",
    description: "How quickly the page responds to taps, clicks and key presses. Real users only.",
  },
  cls: {
    label: "Cumulative Layout Shift",
    short: "CLS",
    thresholds: [0.1, 0.25],
    unit: "unitless",
    description: "How much the layout jumps around while loading.",
  },
  fcp: {
    label: "First Contentful Paint",
    short: "FCP",
    thresholds: [1800, 3000],
    unit: "ms",
    description: "When the first text or image appears.",
  },
  ttfb: {
    label: "Time to First Byte",
    short: "TTFB",
    thresholds: [800, 1800],
    unit: "ms",
    description: "How long the server takes to start responding.",
  },
  tbt: {
    label: "Total Blocking Time",
    short: "TBT",
    thresholds: [200, 600],
    unit: "ms",
    description: "Time the main thread was too busy to respond. The lab stand-in for INP.",
  },
  si: {
    label: "Speed Index",
    short: "SI",
    thresholds: [3400, 5800],
    unit: "ms",
    description: "How quickly the visible page fills in.",
  },
};

export const LAB_METRICS: readonly LabMetric[] = ["lcp", "tbt", "cls", "fcp", "si", "ttfb"];
export const CORE_FIELD_METRICS: readonly FieldMetric[] = ["lcp", "inp", "cls"];

export function rateMetric(metric: Metric, value: number): Rating {
  const [good, poor] = METRICS[metric].thresholds;
  if (value <= good) return "good";
  if (value > poor) return "poor";
  return "needs-improvement";
}

/** Lighthouse colours: 90–100 good, 50–89 needs improvement, 0–49 poor. */
export function rateScore(score: number): Rating {
  if (score >= 90) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}

export const RATING_LABEL: Record<Rating, string> = {
  good: "Good",
  "needs-improvement": "Needs work",
  poor: "Poor",
};

export function formatMetric(metric: Metric, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (METRICS[metric].unit === "unitless") return value < 0.01 && value > 0 ? "<0.01" : value.toFixed(2);
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`;
}

/** Signed change for a metric where lower is better, e.g. "+0.4 s" or "−120 ms". */
export function formatDelta(metric: Metric, delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${formatMetric(metric, Math.abs(delta))}`;
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
