import "server-only";
import { parsePsi, type ParsedCheck, type PsiResponse } from "./psi-parse";
import { sampleDiagnostics } from "./sample-diagnostics";
import type { Strategy } from "./vitals";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export class PsiError extends Error {}

/**
 * Runs Lighthouse on Google's servers through the free PageSpeed Insights API.
 * The response also carries Chrome UX Report field data, so one call gives lab
 * and real-user numbers. A run takes 10–40 seconds.
 *
 * PSI_API_KEY is optional but strongly recommended: keyless calls share a tiny
 * global quota and are often refused with 429. Keys are free (no billing).
 */
export async function runPageSpeed(url: string, strategy: Strategy): Promise<ParsedCheck> {
  if (process.env.PSI_MOCK) return mockCheck(url, strategy);

  const params = new URLSearchParams({ url, strategy, category: "performance" });
  if (process.env.PSI_API_KEY) params.set("key", process.env.PSI_API_KEY);

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(55_000), cache: "no-store" });
  } catch (error) {
    throw new PsiError(
      error instanceof Error && error.name === "TimeoutError"
        ? "PageSpeed Insights took too long to answer. Try again in a minute."
        : "Couldn't reach PageSpeed Insights.",
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (response.status === 429) {
      throw new PsiError(
        process.env.PSI_API_KEY
          ? "PageSpeed Insights quota reached for today."
          : "PageSpeed Insights is rate-limiting keyless requests. Add a free PSI_API_KEY to run checks.",
      );
    }
    // PSI explains unreachable pages (DNS errors, 4xx/5xx) in the message.
    const message = body?.error?.message?.replace(/^Lighthouse returned error: /, "");
    throw new PsiError(message ? `Lighthouse couldn't load the page: ${message}` : `PageSpeed Insights responded ${response.status}.`);
  }

  return parsePsi((await response.json()) as PsiResponse);
}

/** Deterministic fake for end-to-end tests (PSI_MOCK=1): never calls Google. */
function mockCheck(url: string, strategy: Strategy): ParsedCheck {
  let h = 0;
  for (const c of url) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const base = strategy === "mobile" ? 62 : 88;
  const score = Math.min(100, base + (h % 10));
  const slow = (100 - score) / 40;
  return {
    score,
    lab: {
      lcp: 1400 + slow * 2600,
      cls: 0.02 + slow * 0.08,
      tbt: 60 + slow * 420,
      fcp: 900 + slow * 1200,
      si: 1800 + slow * 2800,
      ttfb: 180 + slow * 300,
    },
    field: null,
    opportunities: [
      { id: "render-blocking-resources", title: "Eliminate render-blocking resources", savingsMs: 640 },
      { id: "uses-optimized-images", title: "Efficiently encode images", savingsMs: 380, displayValue: "Est. savings of 220 KiB" },
    ],
    error: null,
    diagnostics: sampleDiagnostics(new URL(url).origin),
  };
}
