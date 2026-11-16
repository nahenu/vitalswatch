import type { Issue, IssueItem, LcpDetail } from "./diagnostics";

/**
 * Lighthouse says *what* is slow. This turns each finding into *why it hurts*
 * and *what to change*, with code that uses the page's own URLs and selectors,
 * so the fix can be pasted rather than researched.
 */

export interface CodeSample {
  label: string;
  lang: "html" | "js" | "css" | "json" | "bash";
  code: string;
}

export interface Fix {
  why: string;
  steps: string[];
  code: CodeSample[];
}

const file = (url?: string) => {
  if (!url) return "file";
  try {
    const u = new URL(url);
    return u.pathname.split("/").filter(Boolean).pop() || u.hostname;
  } catch {
    return url;
  }
};
const origin = (url?: string) => {
  try {
    return url ? new URL(url).origin : "https://cdn.example.com";
  } catch {
    return "https://cdn.example.com";
  }
};
const firstUrl = (items: IssueItem[], test: (u: string) => boolean = () => true) => items.find((i) => i.url && test(i.url))?.url;
const isJs = (u: string) => /\.m?js(\?|$)/i.test(u) || /gtm|gtag|analytics|pixel|widget|sdk|events/i.test(u);
const isCss = (u: string) => /\.css(\?|$)/i.test(u);

function forId(id: string, issue: Issue, siteUrl: string, lcp?: LcpDetail): Fix | null {
  const items = issue.items;
  switch (id) {
    case "render-blocking-insight":
    case "render-blocking-resources": {
      const js = firstUrl(items, isJs);
      const css = firstUrl(items, isCss);
      return {
        why: "The browser stops drawing the page until these files have downloaded and run. Every one of them pushes the first paint (and so LCP) later.",
        steps: [
          "Add defer (or async for independent scripts) to scripts that aren't needed for the first screen.",
          "Inline the small amount of CSS the first screen needs and load the rest without blocking.",
          "Move tag-manager or widget scripts out of <head>.",
        ],
        code: [
          ...(js || !css ? [{ label: "Don't block on the script", lang: "html" as const, code: `<!-- before -->\n<script src="${js ?? "/js/app.js"}"></script>\n\n<!-- after -->\n<script src="${js ?? "/js/app.js"}" defer></script>` }] : []),
          ...(css
            ? [{ label: "Load non-critical CSS without blocking", lang: "html" as const, code: `<link rel="preload" href="${css}" as="style" onload="this.rel='stylesheet'">\n<noscript><link rel="stylesheet" href="${css}"></noscript>` }]
            : []),
        ],
      };
    }

    case "lcp-discovery-insight":
    case "prioritize-lcp-image": {
      const img = lcp?.resourceUrl ?? firstUrl(items) ?? "/images/hero.webp";
      return {
        why: "The browser finds out about the biggest image late, or treats it as low priority, so the main content appears after less important files.",
        steps: [
          ...(issue.failedChecks ?? []).map((c) => `Fix: ${c}`),
          "Make the LCP image discoverable in the HTML (not set from JavaScript or CSS).",
          "Give it fetchpriority=\"high\" and never loading=\"lazy\".",
        ],
        code: [
          { label: "Preload and prioritise the LCP image", lang: "html", code: `<link rel="preload" as="image" href="${img}" fetchpriority="high">\n\n<img src="${img}" fetchpriority="high" decoding="async" width="1200" height="600" alt="…">` },
        ],
      };
    }

    case "image-delivery-insight":
    case "uses-optimized-images":
    case "modern-image-formats":
    case "uses-responsive-images":
    case "offscreen-images": {
      const img = firstUrl(items) ?? "/images/photo.jpg";
      const base = file(img).replace(/\.\w+$/, "");
      return {
        why: "These images are larger than they need to be: an older format, more pixels than the screen shows, or loaded before they are on screen.",
        steps: ["Serve AVIF or WebP with a fallback.", "Send a size that matches the slot with srcset/sizes.", "Lazy-load images below the first screen (never the LCP image)."],
        code: [
          {
            label: "Modern format, right size, lazy below the fold",
            lang: "html",
            code: `<picture>\n  <source type="image/avif" srcset="${base}-480.avif 480w, ${base}-960.avif 960w" sizes="(max-width: 600px) 100vw, 50vw">\n  <img src="${img}" srcset="${base}-480.webp 480w, ${base}-960.webp 960w" sizes="(max-width: 600px) 100vw, 50vw"\n       width="960" height="640" loading="lazy" decoding="async" alt="…">\n</picture>`,
          },
          { label: "In Next.js", lang: "js", code: `import Image from "next/image";\n\n<Image src="${img}" width={960} height={640} sizes="(max-width: 600px) 100vw, 50vw" alt="…" />` },
        ],
      };
    }

    case "unused-javascript":
    case "duplicated-javascript-insight":
    case "duplicated-javascript": {
      const own = firstUrl(items, (u) => u.startsWith(new URL(siteUrl).origin));
      const third = firstUrl(items, (u) => !u.startsWith(new URL(siteUrl).origin));
      return {
        why: "The page downloads and parses JavaScript it never runs on this screen. Parsing costs main-thread time on phones even when the code is cached.",
        steps: [
          "Split code by route and load heavy components only when they are shown.",
          "Load marketing and chat scripts after the user interacts, not on page load.",
          "Remove libraries you no longer use (check the bundle analyzer).",
        ],
        code: [
          { label: "Load a heavy component only when needed (Next.js)", lang: "js", code: `import dynamic from "next/dynamic";\n\nconst Chat = dynamic(() => import("./Chat"), { ssr: false });\n// Render <Chat /> only after the user opens it.` },
          ...(third
            ? [{ label: `Load ${file(third)} on first interaction`, lang: "js" as const, code: `const load = () => {\n  const s = document.createElement("script");\n  s.src = "${third}";\n  s.async = true;\n  document.head.append(s);\n};\n["pointerdown", "keydown", "scroll"].forEach((e) => addEventListener(e, load, { once: true, passive: true }));` }]
            : []),
          ...(own && !third ? [{ label: "Find what's inside the bundle", lang: "bash" as const, code: `ANALYZE=true npm run build   # with @next/bundle-analyzer` }] : []),
        ],
      };
    }

    case "bootup-time":
    case "mainthread-work-breakdown":
    case "long-tasks": {
      const heavy = items.find((i) => i.url)?.url;
      return {
        why: "The main thread is busy running JavaScript, so taps and clicks wait. This is what drives Total Blocking Time in the lab and INP for real users.",
        steps: [
          heavy ? `Start with ${file(heavy)}: it uses the most CPU on this page.` : "Start with the script that uses the most CPU.",
          "Defer third-party tags until after load or first interaction.",
          "Break long loops and renders into smaller chunks that yield to the browser.",
        ],
        code: [
          { label: "Yield to the browser inside long work", lang: "js", code: `async function processAll(items) {\n  for (const [i, item] of items.entries()) {\n    process(item);\n    // Give the browser a chance to handle input every 50 items.\n    if (i % 50 === 0) await (globalThis.scheduler?.yield?.() ?? new Promise((r) => setTimeout(r)));\n  }\n}` },
          { label: "Next.js: third-party scripts after load", lang: "js", code: `import Script from "next/script";\n\n<Script src="${heavy && !heavy.startsWith(new URL(siteUrl).origin) ? heavy : "https://example.com/tag.js"}" strategy="lazyOnload" />` },
        ],
      };
    }

    case "third-parties-insight":
    case "third-party-summary":
      return {
        why: "Code from other companies (ads, analytics, chat) competes with your own for bandwidth and main-thread time, and you can't optimise it directly.",
        steps: ["Remove tags nobody uses any more.", "Load the rest after the page is interactive.", "Use a lightweight facade for embeds (video, chat) until clicked."],
        code: [
          { label: "Facade: real widget only after a click", lang: "html", code: `<button id="chat-btn">Chat with us</button>\n<script>\n  document.getElementById("chat-btn").addEventListener("click", () => {\n    const s = document.createElement("script");\n    s.src = "https://widget.example.com/chat.js";\n    document.head.append(s);\n  }, { once: true });\n</script>` },
        ],
      };

    case "cache-insight":
    case "uses-long-cache-ttl": {
      const own = items.filter((i) => i.url?.startsWith(new URL(siteUrl).origin)).length;
      return {
        why: "Returning visitors download these files again because their cache lifetime is short. Fingerprinted assets can be cached for a year.",
        steps: [
          own ? "Set long cache headers on your own versioned files (JS, CSS, fonts, images)." : "Most of these are third-party files: you can't change their headers, but you can load fewer of them.",
          "Keep short caching only for HTML.",
        ],
        code: [
          { label: "Cache headers (next.config.js)", lang: "js", code: `async headers() {\n  return [{\n    source: "/:all*(js|css|woff2|png|jpg|webp|avif|svg)",\n    headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],\n  }];\n}` },
        ],
      };
    }

    case "legacy-javascript-insight":
    case "legacy-javascript":
      return {
        why: "Your bundles ship polyfills and transforms for old browsers that almost no visitor uses, which is dead weight on every page load.",
        steps: ["Target modern browsers in your build.", "Drop polyfill packages that modern browsers don't need."],
        code: [{ label: "package.json", lang: "json", code: `"browserslist": [\n  "chrome >= 109", "edge >= 109", "firefox >= 115", "safari >= 15.4"\n]` }],
      };

    case "unused-css-rules":
    case "unminified-css":
      return {
        why: "Large stylesheets block rendering, and most of their rules don't apply to this page.",
        steps: ["Remove unused CSS with your framework's purge step.", "Split CSS per route.", "Inline the first screen's critical CSS."],
        code: [{ label: "Tailwind only ships classes you use", lang: "css", code: `@import "tailwindcss";\n/* Scans your files and drops every unused utility at build time. */` }],
      };

    case "font-display-insight":
    case "font-display":
      return {
        why: "Text stays invisible until the web font downloads.",
        steps: ["Show fallback text immediately with font-display: swap.", "Preload the one font file used above the fold."],
        code: [
          { label: "CSS", lang: "css", code: `@font-face {\n  font-family: "Brand";\n  src: url("/fonts/brand.woff2") format("woff2");\n  font-display: swap;\n}` },
          { label: "Preload the main font", lang: "html", code: `<link rel="preload" href="/fonts/brand.woff2" as="font" type="font/woff2" crossorigin>` },
        ],
      };

    case "document-latency-insight":
    case "server-response-time":
    case "redirects":
    case "uses-text-compression":
      return {
        why: "Everything waits for the HTML document. A slow server, a redirect or uncompressed HTML delays every other metric.",
        steps: [...(issue.failedChecks ?? []).map((c) => `Fix: ${c}`), "Link to the final URL so there's no redirect.", "Cache HTML at the edge (CDN) where possible.", "Serve HTML with Brotli or gzip."],
        code: [{ label: "Cache a page at the edge (Next.js)", lang: "js", code: `export const revalidate = 300; // rebuild at most every 5 minutes, serve from the CDN` }],
      };

    case "network-dependency-tree-insight":
    case "uses-rel-preconnect":
    case "critical-request-chains": {
      const o = origin(firstUrl(items, (u) => !u.startsWith(new URL(siteUrl).origin)));
      return {
        why: "Important files are found late, each one waiting for the previous to download. Connecting to other servers early saves a round trip.",
        steps: ["Preconnect to the 2–3 origins the first screen needs.", "Avoid chains like CSS → font or JS → image for above-the-fold content."],
        code: [{ label: "Preconnect", lang: "html", code: `<link rel="preconnect" href="${o}" crossorigin>` }],
      };
    }

    case "cls-culprits-insight":
    case "unsized-images":
    case "layout-shifts":
      return {
        why: "Elements move after they first appear, usually because space wasn't reserved for an image, ad, banner or late font.",
        steps: ["Give every image and video width and height (or aspect-ratio).", "Reserve space for banners and embeds before they load.", "Avoid inserting content above existing content."],
        code: [{ label: "Reserve space", lang: "css", code: `img, video { height: auto; }\n.banner-slot { min-height: 90px; }\n.hero-media { aspect-ratio: 16 / 9; }` }],
      };

    case "dom-size-insight":
    case "dom-size":
      return {
        why: "A very large DOM makes every style recalculation and layout slower, which hurts interactions.",
        steps: ["Render long lists virtually.", "Don't render hidden tabs and menus until opened."],
        code: [{ label: "Render only visible rows", lang: "js", code: `import { useVirtualizer } from "@tanstack/react-virtual";` }],
      };

    case "forced-reflow-insight":
      return {
        why: "JavaScript reads layout (offsetHeight, getBoundingClientRect) right after changing styles, forcing the browser to recalculate layout synchronously.",
        steps: ["Batch all reads, then all writes.", "Use requestAnimationFrame for visual updates."],
        code: [{ label: "Read, then write", lang: "js", code: `const h = el.offsetHeight;          // read first\nrequestAnimationFrame(() => {\n  other.style.height = h + "px";    // write later\n});` }],
      };

    case "viewport-insight":
      return {
        why: "Without a mobile viewport, phones add a delay to every tap.",
        steps: ["Add the viewport meta tag."],
        code: [{ label: "<head>", lang: "html", code: `<meta name="viewport" content="width=device-width, initial-scale=1">` }],
      };

    case "total-byte-weight":
      return {
        why: "The page is heavy overall. On a typical phone connection, every megabyte costs seconds.",
        steps: ["Start with the largest files listed here.", "Compress images and remove unused scripts."],
        code: [],
      };
  }
  return null;
}

export function fixFor(issue: Issue, siteUrl: string, lcp?: LcpDetail): Fix {
  let fix: Fix | null = null;
  try {
    fix = forId(issue.id, issue, siteUrl, lcp);
  } catch {
    fix = null;
  }
  return fix ?? { why: issue.description, steps: issue.failedChecks?.map((c) => `Fix: ${c}`) ?? [], code: [] };
}

/** What each LCP phase means and what to do when it dominates. */
export const LCP_PHASES: Record<string, { short: string; advice: string }> = {
  timeToFirstByte: { short: "Server", advice: "The server is slow to send HTML. Cache at the edge, avoid redirects." },
  resourceLoadDelay: { short: "Discovery", advice: "The image is found late. Preload it and use fetchpriority=\"high\"." },
  resourceLoadDuration: { short: "Download", advice: "The image takes long to download. Serve AVIF/WebP at the right size." },
  elementRenderDelay: { short: "Render", advice: "The image is ready but not drawn. Remove render-blocking CSS/JS and long tasks." },
};
