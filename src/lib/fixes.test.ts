import { describe, expect, it } from "vitest";
import type { Issue } from "./diagnostics";
import { fixFor } from "./fixes";

const issue = (over: Partial<Issue>): Issue => ({
  id: "x",
  title: "Something",
  description: "Lighthouse's own words.",
  savingsMs: 0,
  savingsBytes: 0,
  metrics: [],
  items: [],
  ...over,
});
const SITE = "https://shop.test/";

describe("fixFor", () => {
  it("writes the fix with the page's own files", () => {
    const fix = fixFor(issue({ id: "render-blocking-insight", items: [{ url: "https://shop.test/app.js" }, { url: "https://shop.test/main.css" }] }), SITE);
    const code = fix.code.map((c) => c.code).join("\n");
    expect(code).toContain('<script src="https://shop.test/app.js" defer></script>');
    expect(code).toContain('href="https://shop.test/main.css"');
  });

  it("loads third-party scripts on first interaction", () => {
    const fix = fixFor(issue({ id: "unused-javascript", items: [{ url: "https://www.googletagmanager.com/gtm.js?id=GTM-1" }] }), SITE);
    expect(fix.code.some((c) => c.code.includes('s.src = "https://www.googletagmanager.com/gtm.js?id=GTM-1"'))).toBe(true);
  });

  it("preloads the actual LCP image", () => {
    const fix = fixFor(issue({ id: "lcp-discovery-insight", failedChecks: ["fetchpriority=high applied"] }), SITE, {
      resourceUrl: "https://shop.test/hero.avif",
      phases: [],
      checks: [],
    });
    expect(fix.steps[0]).toBe("Fix: fetchpriority=high applied");
    expect(fix.code[0].code).toContain('<link rel="preload" as="image" href="https://shop.test/hero.avif" fetchpriority="high">');
  });

  it("falls back to Lighthouse's description for audits it doesn't know", () => {
    expect(fixFor(issue({ id: "brand-new-audit" }), SITE)).toEqual({ why: "Lighthouse's own words.", steps: [], code: [] });
  });
});
