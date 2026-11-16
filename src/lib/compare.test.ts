import { describe, expect, it } from "vitest";
import { compareAroundDeploy, detectRegression, type CheckPoint } from "./compare";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1);
const run = (day: number, score: number | null, lcp = 2000): CheckPoint => ({
  createdAt: new Date(T0 + day * DAY),
  score,
  lcp,
  cls: 0.05,
  tbt: 200,
  fcp: 1000,
  si: 2000,
  ttfb: 300,
});

describe("compareAroundDeploy", () => {
  const deployAt = new Date(T0 + 5.5 * DAY);

  it("compares 3-run medians on each side, ignoring older runs and failures", () => {
    const runs = [run(0, 20), run(1, 70), run(2, null), run(3, 72), run(4, 71), run(5, 69), run(6, 50, 3500), run(7, 52, 3600), run(8, 48, 3400), run(9, 90)];
    const c = compareAroundDeploy(runs, deployAt);
    expect(c.before.score).toBe(71);
    expect(c.after.score).toBe(50);
    expect(c.after.lcp).toBe(3500);
    expect(c.verdict).toBe("slower");
  });

  it("treats small moves as noise", () => {
    const c = compareAroundDeploy([run(4, 70), run(5, 72), run(6, 73), run(7, 74)], deployAt);
    expect(c.verdict).toBe("unchanged");
  });

  it("calls it faster when the score clearly rises", () => {
    expect(compareAroundDeploy([run(5, 60), run(6, 75)], deployAt).verdict).toBe("faster");
  });

  it("is pending until there are runs after the deploy", () => {
    expect(compareAroundDeploy([run(4, 70), run(5, 72)], deployAt).verdict).toBe("pending");
  });
});

describe("detectRegression", () => {
  it("alerts when the score falls the threshold below the recent median", () => {
    expect(detectRegression(60, [72, 70, 71, 73], 10)).toBe(71.5);
  });
  it("stays quiet for small drops, short histories and when off", () => {
    expect(detectRegression(65, [72, 70, 71], 10)).toBeNull();
    expect(detectRegression(40, [72, 70], 10)).toBeNull();
    expect(detectRegression(40, [72, 70, 71], 0)).toBeNull();
  });
  it("uses only the last 7 runs as the baseline", () => {
    const old = [95, 95, 95, 95, 95];
    const recent = [70, 70, 70, 70, 70, 70, 70];
    expect(detectRegression(65, [...old, ...recent], 10)).toBeNull();
  });
});
