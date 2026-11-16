import type { Diagnostics, Issue } from "./diagnostics";

/**
 * Realistic diagnostics for the demo store and for the PageSpeed fake used by
 * end-to-end tests. "widget" is the run after a live-chat widget shipped:
 * a new third party, a heavy script and long main-thread tasks.
 */
export function sampleDiagnostics(origin: string, variant: "clean" | "widget" = "clean"): Diagnostics {
  const o = origin.replace(/\/$/, "");
  const chat = "https://widget.chatly.example/v3/loader.js";
  const issues: Issue[] = [
    {
      id: "render-blocking-insight",
      title: "Render-blocking requests",
      description: "Requests are blocking the page's initial render, which may delay LCP. Deferring or inlining can move these network requests out of the critical path.",
      displayValue: "Est savings of 480 ms",
      savingsMs: 480,
      savingsBytes: 0,
      metrics: ["LCP", "FCP"],
      items: [
        { url: `${o}/_next/static/css/app-4f2a91.css`, totalBytes: 48_210, ms: 330 },
        { url: "https://fonts.example-cdn.com/css2?family=Brand", totalBytes: 1_420, ms: 150 },
      ],
    },
    {
      id: "image-delivery-insight",
      title: "Improve image delivery",
      description: "Reducing the download time of images can improve the perceived load time of the page and LCP.",
      displayValue: "Est savings of 184 KiB",
      savingsMs: 310,
      savingsBytes: 188_400,
      metrics: ["LCP"],
      items: [
        { url: `${o}/images/hero-sofa.jpg`, totalBytes: 241_000, wastedBytes: 162_000, note: "Using a modern image format (WebP, AVIF) could improve this image's download size." },
        { url: `${o}/images/collection-oak.png`, totalBytes: 61_300, wastedBytes: 26_400, note: "This image file is larger than it needs to be (1200x900) for its displayed dimensions (400x300)." },
      ],
    },
    {
      id: "unused-javascript",
      title: "Reduce unused JavaScript",
      description: "Reduce unused JavaScript and defer loading scripts until they are required to decrease bytes consumed by network activity.",
      displayValue: "Est savings of 96 KiB",
      savingsMs: 220,
      savingsBytes: 98_300,
      metrics: ["LCP", "FCP"],
      items: [
        { url: `${o}/_next/static/chunks/framework-9c1d.js`, totalBytes: 139_000, wastedBytes: 54_100 },
        { url: "https://www.googletagmanager.com/gtm.js?id=GTM-DEMO", totalBytes: 112_400, wastedBytes: 44_200 },
      ],
    },
  ];

  if (variant === "widget") {
    issues.unshift({
      id: "bootup-time",
      title: "Reduce JavaScript execution time",
      description: "Consider reducing the time spent parsing, compiling, and executing JS. You may find delivering smaller JS payloads helps with this.",
      displayValue: "1.9 s",
      savingsMs: 720,
      savingsBytes: 0,
      metrics: ["TBT"],
      items: [
        { url: chat, ms: 640, totalBytes: 214_000 },
        { url: `${o}/_next/static/chunks/framework-9c1d.js`, ms: 310 },
      ],
    });
    issues[3].items.unshift({ url: chat, totalBytes: 214_000, wastedBytes: 171_000 });
  }

  return {
    lighthouseVersion: "13.6.0",
    screen: { width: 412, height: 823 },
    filmstrip: [],
    lcp: {
      element: {
        snippet: `<img src="${o}/images/hero-sofa.jpg" alt="Oak three-seater sofa" class="hero__image" width="1200" height="800">`,
        selector: "main > section.hero > picture > img.hero__image",
        label: "Oak three-seater sofa",
        rect: { top: 64, left: 0, width: 412, height: 275 },
      },
      resourceUrl: `${o}/images/hero-sofa.jpg`,
      phases: [
        { key: "timeToFirstByte", label: "Time to first byte", ms: 420 },
        { key: "resourceLoadDelay", label: "Resource load delay", ms: variant === "widget" ? 1_150 : 240 },
        { key: "resourceLoadDuration", label: "Resource load duration", ms: 520 },
        { key: "elementRenderDelay", label: "Element render delay", ms: variant === "widget" ? 610 : 180 },
      ],
      checks: [
        { label: "fetchpriority=high applied", ok: true },
        { label: "Request is discoverable in initial document", ok: true },
        { label: "LCP resources shouldn’t use loading=lazy", ok: true },
      ],
    },
    layoutShifts: [
      {
        node: { snippet: `<div class="promo-bar">Free delivery this week</div>`, selector: "body > div.promo-bar", label: "Free delivery this week", rect: { top: 0, left: 0, width: 412, height: 36 } },
        score: 0.031,
        causes: ["Injected iframe or content"],
      },
    ],
    issues,
    thirdParties: [
      ...(variant === "widget" ? [{ entity: "Chatly", bytes: 214_000, mainThreadMs: 640, urls: [chat] }] : []),
      { entity: "Google Tag Manager", bytes: 112_400, mainThreadMs: 140, urls: ["https://www.googletagmanager.com/gtm.js?id=GTM-DEMO"] },
      { entity: "Example Fonts", bytes: 38_000, mainThreadMs: 0, urls: ["https://fonts.example-cdn.com/css2?family=Brand"] },
    ],
    resources: [
      { type: "script", label: "Script", requests: variant === "widget" ? 24 : 19, bytes: variant === "widget" ? 712_000 : 498_000 },
      { type: "image", label: "Image", requests: 21, bytes: 612_000 },
      { type: "font", label: "Font", requests: 3, bytes: 96_000 },
      { type: "stylesheet", label: "Stylesheet", requests: 2, bytes: 52_000 },
      { type: "document", label: "Document", requests: 1, bytes: 31_000 },
    ],
    totals: { requests: variant === "widget" ? 58 : 53, bytes: variant === "widget" ? 1_503_000 : 1_289_000 },
    mainThread: [
      { label: "Script Evaluation", ms: variant === "widget" ? 1_480 : 760 },
      { label: "Style & Layout", ms: 410 },
      { label: "Other", ms: 330 },
      { label: "Rendering", ms: 190 },
      { label: "Script Parsing & Compilation", ms: 160 },
    ],
    longTasks: [
      ...(variant === "widget" ? [{ url: chat, ms: 412, startMs: 3_920 }] : []),
      { url: `${o}/_next/static/chunks/framework-9c1d.js`, ms: 168, startMs: 2_210 },
    ],
  };
}
