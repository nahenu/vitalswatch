import { describe, expect, it } from "vitest";
import { formatDelta, formatMetric, median, rateMetric, rateScore } from "./vitals";

describe("rateMetric", () => {
  it("uses the web.dev thresholds, inclusive at the good edge", () => {
    expect(rateMetric("lcp", 2500)).toBe("good");
    expect(rateMetric("lcp", 2501)).toBe("needs-improvement");
    expect(rateMetric("lcp", 4000)).toBe("needs-improvement");
    expect(rateMetric("lcp", 4001)).toBe("poor");
    expect(rateMetric("inp", 200)).toBe("good");
    expect(rateMetric("inp", 286)).toBe("needs-improvement");
    expect(rateMetric("cls", 0.1)).toBe("good");
    expect(rateMetric("cls", 0.26)).toBe("poor");
  });
});

describe("rateScore", () => {
  it("matches Lighthouse's colour bands", () => {
    expect(rateScore(90)).toBe("good");
    expect(rateScore(89)).toBe("needs-improvement");
    expect(rateScore(50)).toBe("needs-improvement");
    expect(rateScore(49)).toBe("poor");
  });
});

describe("formatMetric", () => {
  it("formats times in ms below a second and seconds above", () => {
    expect(formatMetric("lcp", 640)).toBe("640 ms");
    expect(formatMetric("lcp", 2540)).toBe("2.5 s");
    expect(formatMetric("lcp", 12_400)).toBe("12 s");
  });
  it("formats CLS as a unitless score", () => {
    expect(formatMetric("cls", 0.0456)).toBe("0.05");
    expect(formatMetric("cls", 0.004)).toBe("<0.01");
  });
  it("shows a dash for missing values", () => {
    expect(formatMetric("tbt", null)).toBe("—");
  });
});

describe("formatDelta", () => {
  it("signs the change with a real minus", () => {
    expect(formatDelta("lcp", 400)).toBe("+400 ms");
    expect(formatDelta("lcp", -1200)).toBe("−1.2 s");
  });
});

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
