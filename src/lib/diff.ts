import type { Diagnostics, Issue } from "./diagnostics";

export interface DiagDiff {
  newIssues: Issue[];
  resolvedIssues: Issue[];
  newThirdParties: Diagnostics["thirdParties"];
  goneThirdParties: Diagnostics["thirdParties"];
  /** Files that weren't in the earlier run, heaviest first. */
  newFiles: { url: string; bytes: number; ms: number }[];
  bytesDelta: number;
  requestsDelta: number;
}

/** Strip cache-busting query strings, so app.js?v=1 and app.js?v=2 count as the same file. */
const key = (url: string) => url.replace(/[?#].*$/, "");

function files(d: Diagnostics) {
  const map = new Map<string, { url: string; bytes: number; ms: number }>();
  const add = (url: string | undefined, bytes = 0, ms = 0) => {
    if (!url || url.startsWith("data:")) return;
    const k = key(url);
    const prev = map.get(k);
    map.set(k, { url, bytes: Math.max(prev?.bytes ?? 0, bytes), ms: Math.max(prev?.ms ?? 0, ms) });
  };
  for (const issue of d.issues) for (const i of issue.items) add(i.url, i.totalBytes, i.ms);
  for (const t of d.thirdParties) for (const u of t.urls) add(u);
  return map;
}

/**
 * What changed between two runs: issues that appeared or went away, third
 * parties added or removed, and new files. Used for "since the last deploy".
 */
export function diffDiagnostics(before: Diagnostics, after: Diagnostics): DiagDiff {
  const beforeIssues = new Set(before.issues.map((i) => i.id));
  const afterIssues = new Set(after.issues.map((i) => i.id));
  const beforeTp = new Set(before.thirdParties.map((t) => t.entity));
  const afterTp = new Set(after.thirdParties.map((t) => t.entity));
  const beforeFiles = files(before);

  return {
    newIssues: after.issues.filter((i) => !beforeIssues.has(i.id)),
    resolvedIssues: before.issues.filter((i) => !afterIssues.has(i.id)),
    newThirdParties: after.thirdParties.filter((t) => !beforeTp.has(t.entity)),
    goneThirdParties: before.thirdParties.filter((t) => !afterTp.has(t.entity)),
    newFiles: [...files(after).entries()]
      .filter(([k]) => !beforeFiles.has(k))
      .map(([, v]) => v)
      .sort((a, b) => b.bytes + b.ms * 100 - (a.bytes + a.ms * 100))
      .slice(0, 6),
    bytesDelta: after.totals.bytes - before.totals.bytes,
    requestsDelta: after.totals.requests - before.totals.requests,
  };
}

export const isEmptyDiff = (d: DiagDiff) =>
  !d.newIssues.length && !d.resolvedIssues.length && !d.newThirdParties.length && !d.goneThirdParties.length && !d.newFiles.length && Math.abs(d.bytesDelta) < 20_000;
