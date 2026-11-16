import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { AlertFeed, BentoCard, DeployTerminal, MediansSketch } from "@/components/marketing/bento";
import { HeroChart } from "@/components/marketing/hero-chart";
import { LogoMark } from "@/components/marketing/logo";
import { Monitor } from "@/components/marketing/monitor";
import { Dock, TopLine } from "@/components/marketing/site-nav";
import { BlurFade } from "@/components/ui/blur-fade";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { site } from "@/lib/site";
import { METRICS, type FieldMetric } from "@/lib/vitals";

const VITALS: { metric: FieldMetric; question: string; at: number; value: string }[] = [
  { metric: "lcp", question: "How fast does the main content show up?", at: 0.33, value: "1.9 s" },
  { metric: "inp", question: "Does it react the moment I tap?", at: 0.24, value: "124 ms" },
  { metric: "cls", question: "Does the page stay still while it loads?", at: 0.12, value: "0.03" },
];

const GITHUB_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z";

function Scale({ metric, at }: { metric: FieldMetric; at: number }) {
  const [good, poor] = METRICS[metric].thresholds;
  const fmt = (v: number) => (metric === "cls" ? String(v) : v >= 1000 ? `${v / 1000} s` : `${v} ms`);
  return (
    <div className="mt-8">
      <div className="relative h-[3px]">
        <div className="absolute inset-0 flex gap-1">
          <span className="h-full w-[40%] rounded-full bg-good" />
          <span className="h-full w-[27%] rounded-full bg-warn" />
          <span className="h-full flex-1 rounded-full bg-poor" />
        </div>
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground" style={{ left: `${at * 100}%` }} />
      </div>
      <div className="mt-3 flex text-[11px] tabular-nums text-subtle">
        <span className="w-[40%]">≤ {fmt(good)}</span>
        <span className="w-[27%]">≤ {fmt(poor)}</span>
        <span>slower</span>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
      <div>
        <p className="text-[13px] font-medium text-brand">{eyebrow}</p>
        <h2 className="text-lit mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[3.25rem]">{title}</h2>
      </div>
      {body && <p className="max-w-md text-muted-foreground lg:justify-self-end lg:pb-1.5">{body}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative isolate overflow-x-clip">
      <TopLine />
      <Dock />

      <main>
        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="relative">
          {/* Cinematic light: one soft diagonal beam and a cyan bloom behind the monitor. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-[10%] -top-[30%] h-[140%] w-[38%] rotate-[28deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.055),transparent)] blur-2xl" />
            <div className="absolute -left-[2%] -top-[30%] h-[140%] w-[10%] rotate-[28deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)] blur-xl" />
            <div className="absolute right-[-8%] top-[18%] size-[46rem] rounded-full bg-[radial-gradient(closest-side,rgba(45,212,230,0.13),transparent)]" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-32 sm:pt-40 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:pb-32">
            <div>
              <BlurFade delay={0.05}>
                <a
                  href="#vitals"
                  className="group inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3 text-[13px] text-muted-foreground hover:border-white/15 hover:text-foreground"
                >
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">New</span>
                  Real-user INP from the Chrome UX Report
                  <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </a>
              </BlurFade>
              <BlurFade delay={0.12}>
                <h1 className="text-lit mt-7 text-[2.9rem] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-[4.6rem]">
                  Catch the deploy that made your site slow.
                </h1>
              </BlurFade>
              <BlurFade delay={0.2}>
                <p className="mt-7 max-w-[30rem] text-[17px] leading-relaxed text-muted-foreground">
                  VitalsWatch checks your pages every morning, lines every dip up with the release that caused it, and emails you before your users notice.
                </p>
              </BlurFade>
              <BlurFade delay={0.28}>
                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <Link
                    href="/sign-up"
                    className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-medium text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_30px_-6px_rgba(255,255,255,0.25)] hover:bg-white"
                  >
                    Start watching free
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                  <Link href="/r/demo" className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-foreground/90 hover:text-foreground">
                    View a live report
                    <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
                <p className="mt-8 text-[13px] text-subtle">Free for 10 pages · Nothing to install on your site</p>
              </BlurFade>
            </div>

            <BlurFade delay={0.3} offset={24}>
              <Monitor className="mx-auto w-full max-w-[34rem] lg:ml-auto" />
            </BlurFade>
          </div>
        </section>

        {/* ── Sources ────────────────────────────────────────── */}
        <section aria-label="Data sources" className="border-y border-border">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-10 gap-y-4 px-5 py-7 text-sm">
            <p className="text-subtle">Measured with the tools Google ranks you by</p>
            <ul className="flex flex-wrap items-center gap-x-9 gap-y-3 font-medium tracking-tight text-muted-foreground">
              <li>Lighthouse</li>
              <li>PageSpeed Insights</li>
              <li>Chrome UX Report</li>
              <li>Core Web Vitals</li>
            </ul>
          </div>
        </section>

        {/* ── Product bento ──────────────────────────────────── */}
        <section id="product" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28 sm:py-36">
          <SectionHead
            eyebrow="Product"
            title="Every slowdown leaves a trail. We keep it."
            body="Daily Lighthouse runs on Google's servers, real-user data from Chrome, and a marker for every release, on one timeline."
          />

          <div className="mt-16 grid gap-3 lg:grid-cols-6">
            <BentoCard
              className="lg:col-span-4"
              title="Each dip, next to the deploy that caused it"
              body="Releases show up on the chart the moment CI pings us, so a step down points straight at its commit."
            >
              <div className="px-3 pb-14 pt-6 sm:px-5">
                <HeroChart />
              </div>
            </BentoCard>
            <BentoCard className="lg:col-span-2" title="An email before your users notice" body="One message when a score drops past your threshold. Never a daily digest you learn to ignore.">
              <AlertFeed />
            </BentoCard>
            <BentoCard className="lg:col-span-3" title="One line in CI" body="Post the commit after each deploy. We test mobile and desktop right away and report back.">
              <DeployTerminal />
            </BentoCard>
            <BentoCard
              className="lg:col-span-3"
              title="Medians, not luck"
              body="Lighthouse can swing several points between identical runs. Before/after uses the median of three runs on each side."
            >
              <MediansSketch />
            </BentoCard>
          </div>
        </section>

        {/* ── Web Vitals ─────────────────────────────────────── */}
        <section id="vitals" className="scroll-mt-24 border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-28 sm:py-36">
            <SectionHead
              eyebrow="Core Web Vitals"
              title="Three numbers decide how fast your site feels."
              body="Measured at the 75th percentile of real visits over 28 days. A page passes when all three are in the green."
            />
            <div className="mt-16 grid overflow-hidden rounded-2xl border border-border md:grid-cols-3">
              {VITALS.map((v, i) => (
                <article key={v.metric} className={`p-8 ${i ? "border-t border-border md:border-l md:border-t-0" : ""}`}>
                  <p className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium text-brand">{METRICS[v.metric].short}</span>
                    <span className="text-xs text-subtle">{METRICS[v.metric].label}</span>
                  </p>
                  <p className="mt-6 text-5xl font-semibold tabular-nums tracking-[-0.04em] text-foreground">{v.value}</p>
                  <p className="mt-6 font-medium text-foreground">{v.question}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{METRICS[v.metric].description}</p>
                  <Scale metric={v.metric} at={v.at} />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Share & PDF ───────────────────────────────────── */}
        <section id="share" className="scroll-mt-24 border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-28 sm:py-36 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[13px] font-medium text-brand">Share &amp; PDF</p>
              <h2 className="text-lit mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[3.25rem]">Send the whole story, not a screenshot.</h2>
              <p className="mt-6 max-w-md text-muted-foreground">
                Share a read-only link with your team or client, or download a PDF with the scores, the trend, every issue and the code to fix it. Ready to attach
                to a ticket.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                {["Scores, Core Web Vitals and why they pass or fail", "Deploy-by-deploy before and after", "Every issue with its files and a code fix"].map((x) => (
                  <li key={x} className="flex items-center gap-2.5">
                    <span className="size-1.5 rounded-full bg-brand" aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative" aria-hidden>
              <div className="absolute -inset-10 -z-10 bg-[radial-gradient(closest-side,rgba(45,212,230,0.08),transparent)]" />
              {/* A miniature of the PDF's first page. */}
              <div className="mx-auto w-full max-w-sm rotate-[-2deg] rounded-xl bg-[#fbfbfa] p-6 text-[#33343a] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
                <p className="text-[9px] font-bold tracking-[0.12em] text-[#0a6b78]">VITALSWATCH · SPEED REPORT</p>
                <p className="mt-2 text-xl font-bold text-[#111114]">store.example.com</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[["MOBILE", "86", "#16833a"], ["DESKTOP", "98", "#16833a"]].map(([l, v, c]) => (
                    <div key={l} className="rounded-md border border-[#e3e4e8] py-2 text-center">
                      <p className="text-[8px] tracking-wider text-[#6b6d76]">{l} SCORE</p>
                      <p className="text-2xl font-bold" style={{ color: c }}>{v}</p>
                    </div>
                  ))}
                </div>
                <svg viewBox="0 0 300 60" className="mt-4 w-full">
                  <path d="M0 44 L40 45 L80 43 L110 30 L150 31 L170 50 L185 28 L230 27 L250 14 L300 12" fill="none" stroke="#0e8ea0" strokeWidth="2" />
                  <line x1="0" x2="300" y1="12" y2="12" stroke="#16833a" strokeDasharray="3 3" strokeWidth="0.8" />
                </svg>
                <div className="mt-4 space-y-1.5">
                  {["1. Render-blocking requests  -480 ms", "2. Improve image delivery  -310 ms", "3. Reduce unused JavaScript  -220 ms"].map((x) => (
                    <p key={x} className="rounded bg-[#f4f5f7] px-2 py-1 text-[10px]">{x}</p>
                  ))}
                </div>
              </div>
              <div className="mx-auto -mt-6 flex w-full max-w-sm translate-x-6 items-center gap-3 rounded-xl border border-border-strong bg-popover px-4 py-3 shadow-2xl shadow-black/60">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">↗</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-subtle">Read-only link</span>
                  <span className="block truncate font-mono text-xs text-foreground">{`${new URL(site.url).host}/r/demo`}</span>
                </span>
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black">Copy</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-border">
          <FlickeringGrid
            aria-hidden
            className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_55%_60%_at_50%_45%,black,transparent)]"
            squareSize={3}
            gridGap={7}
            color="rgb(45, 212, 230)"
            maxOpacity={0.18}
            flickerChance={0.08}
          />
          <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-32 text-center sm:py-40">
            <LogoMark className="size-11" />
            <h2 className="text-lit mt-8 max-w-3xl text-5xl font-semibold leading-[1] tracking-[-0.05em] sm:text-7xl">Your site was fast once. Keep it that way.</h2>
            <p className="mt-6 text-muted-foreground">Set up in under a minute. Free for 10 pages.</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <Link href="/sign-up" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-medium text-primary-foreground hover:bg-white">
                Start watching free <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link href="/r/demo" className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-foreground/90 hover:text-foreground">
                View a live report <ChevronRight className="size-4 text-subtle" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pb-28 pt-8 text-[13px] text-subtle sm:pb-32">
          <p className="flex items-center gap-2.5">
            <LogoMark className="size-5" /> VitalsWatch · Built by {site.author}
          </p>
          <div className="flex items-center gap-6">
            <span>Data: PageSpeed Insights, Chrome UX Report</span>
            <a href={site.repo} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
                <path d={GITHUB_PATH} />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
