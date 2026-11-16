import { median, type LabMetric } from "./vitals";

export interface CheckPoint {
  createdAt: Date;
  score: number | null;
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  fcp: number | null;
  si: number | null;
  ttfb: number | null;
}

export type Verdict = "slower" | "faster" | "unchanged" | "pending";

export interface DeployComparison {
  before: { runs: number; score: number | null } & Record<LabMetric, number | null>;
  after: { runs: number; score: number | null } & Record<LabMetric, number | null>;
  verdict: Verdict;
}

const METRIC_KEYS: LabMetric[] = ["lcp", "cls", "tbt", "fcp", "si", "ttfb"];

/** Score movement (in points) that counts as a real change rather than run-to-run noise. */
export const NOISE_POINTS = 5;

function summarize(points: CheckPoint[]) {
  const pick = (get: (p: CheckPoint) => number | null) => median(points.map(get).filter((v): v is number => v != null));
  const out = { runs: points.length, score: pick((p) => p.score) } as DeployComparison["before"];
  for (const k of METRIC_KEYS) out[k] = pick((p) => p[k]);
  return out;
}

/**
 * Lighthouse scores swing a few points between identical runs, so a single
 * before/after pair proves nothing. Compare the median of the last `window`
 * successful runs before a deploy with the first `window` runs after it.
 */
export function compareAroundDeploy(checks: readonly CheckPoint[], deployAt: Date, window = 3): DeployComparison {
  const ok = checks.filter((c) => c.score != null).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const t = deployAt.getTime();
  const beforeRuns = ok.filter((c) => c.createdAt.getTime() < t).slice(-window);
  const afterRuns = ok.filter((c) => c.createdAt.getTime() >= t).slice(0, window);

  const before = summarize(beforeRuns);
  const after = summarize(afterRuns);

  let verdict: Verdict = "pending";
  if (before.score != null && after.score != null) {
    const delta = after.score - before.score;
    verdict = delta <= -NOISE_POINTS ? "slower" : delta >= NOISE_POINTS ? "faster" : "unchanged";
  }
  return { before, after, verdict };
}

/**
 * A run counts as a regression when its score falls `drop` or more points
 * below the median of the previous runs (at least 3, so one odd run can't
 * become the baseline). Returns the baseline, or null when there's no alert.
 */
export function detectRegression(latest: number, previous: readonly number[], drop: number): number | null {
  if (drop <= 0 || previous.length < 3) return null;
  const baseline = median(previous.slice(-7));
  if (baseline == null) return null;
  return baseline - latest >= drop ? baseline : null;
}
