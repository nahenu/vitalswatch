import { describe, expect, it } from "vitest";
import { parseDiagnostics, stripLinks } from "./diagnostics";

const node = (selector: string, snippet: string, rect = { top: 58, left: 0, width: 412, height: 424 }) => ({
  type: "node",
  selector,
  snippet,
  nodeLabel: selector,
  boundingRect: { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height },
});

/** The shape of a Lighthouse 13 result, trimmed to what the parser reads. */
const lighthouse = {
  lighthouseResult: {
    lighthouseVersion: "13.6.0",
    configSettings: { screenEmulation: { width: 412, height: 823 } },
    audits: {
      "lcp-breakdown-insight": {
        details: {
          type: "list",
          items: [
            {
              type: "table",
              items: [
                { subpart: "timeToFirstByte", label: "Time to first byte", duration: 7.1 },
                { subpart: "resourceLoadDelay", label: "Resource load delay", duration: 88.7 },
                { subpart: "resourceLoadDuration", label: "Resource load duration", duration: 950.2 },
                { subpart: "elementRenderDelay", label: "Element render delay", duration: 40 },
              ],
            },
            node("section.hero > img", `<img src="https://shop.test/hero.webp" style="background:url(data:image/png;base64,${"A".repeat(400)})">`),
          ],
        },
      },
      "lcp-discovery-insight": {
        details: {
          type: "list",
          items: [{ type: "checklist", items: { priorityHinted: { label: "fetchpriority=high applied", value: false }, eagerlyLoaded: { label: "No loading=lazy", value: true } } }],
        },
      },
      "cls-culprits-insight": {
        details: {
          type: "list",
          items: [
            {
              type: "table",
              items: [
                { node: { type: "text", value: "Total" }, score: 0.08 },
                { node: node("div.promo", `<div class="promo">`), score: 0.06, subItems: { items: [{ cause: "Injected iframe" }] } },
              ],
            },
          ],
        },
      },
      "unused-javascript": {
        title: "Reduce unused JavaScript",
        description: "Reduce unused JavaScript. [Learn how](https://developer.chrome.com/docs/unused-js).",
        score: 0.5,
        scoreDisplayMode: "metricSavings",
        displayValue: "Est savings of 676 KiB",
        metricSavings: { LCP: 0, FCP: 0 },
        details: {
          type: "opportunity",
          items: [{ url: "https://cdn.test/widget.js", totalBytes: 128_131, wastedBytes: 100_624 }],
          overallSavingsBytes: 692_631,
        },
      },
      "bootup-time": {
        title: "Reduce JavaScript execution time",
        score: 0,
        scoreDisplayMode: "metricSavings",
        metricSavings: { TBT: 1250 },
        details: { type: "table", items: [{ url: "https://shop.test/app.js", total: 904 }] },
      },
      "font-display-insight": { title: "Font display", score: 1, scoreDisplayMode: "metricSavings", details: { type: "table", items: [] } },
      "largest-contentful-paint": { score: 0.2, scoreDisplayMode: "numeric", numericValue: 3200 },
      "third-parties-insight": {
        details: {
          type: "table",
          items: [
            { entity: "Chat Co", transferSize: 210_000, mainThreadTime: 640, subItems: { items: [{ url: "https://chat.test/loader.js" }] } },
            { entity: "Fonts Inc", transferSize: 30_000, mainThreadTime: 0 },
          ],
        },
      },
      "resource-summary": {
        details: {
          items: [
            { resourceType: "total", requestCount: 169, transferSize: 2_477_183 },
            { resourceType: "script", label: "Script", requestCount: 65, transferSize: 2_203_930 },
            { resourceType: "media", label: "Media", requestCount: 0, transferSize: 0 },
          ],
        },
      },
      "screenshot-thumbnails": {
        details: { items: Array.from({ length: 8 }, (_, i) => ({ timing: (i + 1) * 300, data: `data:image/jpeg;base64,frame${i}` })) },
      },
      "final-screenshot": { details: { data: "data:image/jpeg;base64,final" } },
    },
  },
};

describe("parseDiagnostics", () => {
  const d = parseDiagnostics(lighthouse);

  it("finds the LCP element, its resource and its four phases", () => {
    expect(d.lcp?.element?.selector).toBe("section.hero > img");
    expect(d.lcp?.resourceUrl).toBe("https://shop.test/hero.webp");
    expect(d.lcp?.phases.map((p) => [p.key, p.ms])).toEqual([
      ["timeToFirstByte", 7],
      ["resourceLoadDelay", 89],
      ["resourceLoadDuration", 950],
      ["elementRenderDelay", 40],
    ]);
    expect(d.lcp?.checks).toContainEqual({ label: "fetchpriority=high applied", ok: false });
  });

  it("shortens base64 blobs inside element snippets", () => {
    expect(d.lcp?.element?.snippet).toContain("data:…");
    expect(d.lcp?.element?.snippet?.length).toBeLessThan(120);
  });

  it("lists layout shift culprits without the Total row", () => {
    expect(d.layoutShifts).toEqual([{ node: expect.objectContaining({ selector: "div.promo" }), score: 0.06, causes: ["Injected iframe"] }]);
  });

  it("keeps failing audits with their files, biggest time saving first, and skips metrics and passes", () => {
    expect(d.issues.map((i) => i.id)).toEqual(["bootup-time", "unused-javascript"]);
    const js = d.issues[1];
    expect(js.savingsBytes).toBe(692_631);
    expect(js.items[0]).toMatchObject({ url: "https://cdn.test/widget.js", totalBytes: 128_131, wastedBytes: 100_624 });
    expect(js.description).toBe("Reduce unused JavaScript. Learn how.");
    expect(js.learnMore).toBe("https://developer.chrome.com/docs/unused-js");
    expect(d.issues[0]).toMatchObject({ savingsMs: 1250, metrics: ["TBT"] });
  });

  it("summarises third parties, weight and screenshots", () => {
    expect(d.thirdParties[0]).toEqual({ entity: "Chat Co", bytes: 210_000, mainThreadMs: 640, urls: ["https://chat.test/loader.js"] });
    expect(d.totals).toEqual({ requests: 169, bytes: 2_477_183 });
    expect(d.resources.map((r) => r.type)).toEqual(["script"]);
    expect(d.filmstrip).toHaveLength(6);
    expect(d.filmstrip[0].ms).toBe(300);
    expect(d.filmstrip.at(-1)?.ms).toBe(2400);
    expect(d.finalScreenshot).toBe("data:image/jpeg;base64,final");
    expect(d.screen).toEqual({ width: 412, height: 823 });
  });

  it("survives an empty or malformed response", () => {
    expect(parseDiagnostics({})).toMatchObject({ issues: [], thirdParties: [], filmstrip: [], totals: { requests: 0, bytes: 0 } });
    expect(parseDiagnostics(null).lcp).toBeUndefined();
  });
});

describe("stripLinks", () => {
  it("keeps link text and code, drops markdown syntax", () => {
    expect(stripLinks("Use `fetchpriority` ([guide](https://x.dev)).")).toBe("Use fetchpriority (guide).");
  });
});
