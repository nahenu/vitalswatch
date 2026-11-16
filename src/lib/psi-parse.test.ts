import { describe, expect, it } from "vitest";
import { parsePsi, type PsiResponse } from "./psi-parse";

const response = (over: Partial<PsiResponse> = {}): PsiResponse => ({
  lighthouseResult: {
    categories: { performance: { score: 0.62 } },
    audits: {
      "largest-contentful-paint": { numericValue: 3210.4 },
      "cumulative-layout-shift": { numericValue: 0.004 },
      "total-blocking-time": { numericValue: 1480 },
      "first-contentful-paint": { numericValue: 1800 },
      "speed-index": { numericValue: 5300 },
      "server-response-time": { numericValue: 7 },
      "unused-javascript": {
        title: "Reduce unused JavaScript",
        score: 0.5,
        scoreDisplayMode: "metricSavings",
        metricSavings: { LCP: 300, FCP: 150 },
        displayValue: "Est savings of 676 KiB",
      },
      "font-display-insight": { title: "Font display", score: 1, scoreDisplayMode: "metricSavings", metricSavings: { FCP: 0 } },
    },
  },
  loadingExperience: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1100, category: "FAST" },
      INTERACTION_TO_NEXT_PAINT: { percentile: 286, category: "AVERAGE" },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, category: "FAST" },
    },
    overall_category: "AVERAGE",
  },
  ...over,
});

describe("parsePsi", () => {
  it("reads the score and lab metrics", () => {
    const r = parsePsi(response());
    expect(r.score).toBe(62);
    expect(r.lab).toMatchObject({ lcp: 3210.4, cls: 0.004, tbt: 1480, ttfb: 7 });
    expect(r.error).toBeNull();
  });

  it("reads page-level field data and converts CrUX CLS from x100", () => {
    const r = parsePsi(response());
    expect(r.field?.scope).toBe("url");
    expect(r.field?.overall).toBe("needs-improvement");
    expect(r.field?.metrics.cls).toEqual({ p75: 0.05, rating: "good" });
    expect(r.field?.metrics.inp).toEqual({ p75: 286, rating: "needs-improvement" });
  });

  it("falls back to origin data when the page has too little traffic", () => {
    const r = parsePsi(
      response({
        loadingExperience: { origin_fallback: true },
        originLoadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2600, category: "AVERAGE" } }, overall_category: "AVERAGE" },
      }),
    );
    expect(r.field?.scope).toBe("origin");
    expect(r.field?.metrics.lcp?.p75).toBe(2600);
  });

  it("lists only failing audits with real savings as opportunities", () => {
    const r = parsePsi(response());
    expect(r.opportunities.map((o) => o.id)).toEqual(["unused-javascript"]);
    expect(r.opportunities[0].savingsMs).toBe(300);
  });

  it("reports Lighthouse's own error when there is no score", () => {
    const r = parsePsi({ lighthouseResult: { categories: { performance: { score: null } }, runtimeError: { message: "NO_FCP" } } });
    expect(r.score).toBeNull();
    expect(r.error).toBe("NO_FCP");
    expect(r.diagnostics).toBeNull();
  });
});
