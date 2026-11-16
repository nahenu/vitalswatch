# VitalsWatch

**Catch the deploy that made your site slow.**

**Live:** [vitalswatch-coral.vercel.app](https://vitalswatch-coral.vercel.app) · **Demo report (no sign-up):** [vitalswatch-coral.vercel.app/r/demo](https://vitalswatch-coral.vercel.app/r/demo)

VitalsWatch tests your pages every day with Lighthouse, tracks real-user Core Web Vitals from the Chrome UX Report, lines every dip up with the release that caused it, and emails you before your users notice. Every report explains *why* a page is slow, with the exact files and a fix you can paste, and can be shared as a link or downloaded as a PDF.

Built with Next.js 16, React 19, TypeScript, PostgreSQL (Neon), Drizzle ORM and Better Auth.

## Why not just use PageSpeed Insights?

PageSpeed Insights is a snapshot: it tells you how fast a page is right now and forgets it. Performance work fails over time, not in one moment: a chat widget here, an unoptimised banner there. VitalsWatch keeps the history and answers the questions a snapshot can't:

| | PageSpeed Insights | VitalsWatch |
| --- | --- | --- |
| Score and Core Web Vitals | ✓ | ✓, every day and after every deploy |
| History and trend | | ✓ 90 days, mobile and desktop |
| Which release made it slower | | ✓ Before/after per deploy, using 3-run medians so noise can't fool you |
| What changed between runs | | ✓ New scripts, third parties, issues and page weight |
| Alerts | | ✓ One email when the score falls below its recent median |
| How to fix it | Generic advice | Copy-paste code using the page's own URLs and selectors |
| Share with a team | Screenshot | Read-only link and a multi-page PDF |

## Features

- **Daily monitoring.** A Vercel cron job runs Lighthouse (through the free PageSpeed Insights API) on every page, mobile and desktop.
- **Real users and lab, side by side.** Chrome UX Report field data (LCP, INP, CLS at p75) with a plain-language pass/fail reason, next to the Lighthouse lab score.
- **Diagnostics with fixes.** The LCP element outlined on a screenshot with its four-phase breakdown, layout-shift culprits, a filmstrip, third-party cost, page weight, and every failing audit with its files, the reason it hurts and code to fix it.
- **Deploy tracking.** Record a release with one click, from GitHub Actions (`deployment_status`, works with Vercel and Netlify) or with a single `curl`. Each deploy gets a before/after verdict.
- **What changed.** Run-to-run and deploy-to-deploy diffs of scripts, third parties, issues and bytes.
- **Regression alerts.** Email when the mobile score drops a chosen amount below the median of the last 7 runs, at most once a day.
- **Sharing.** Read-only public reports and a server-rendered PDF (react-pdf, no headless browser).

## How it works

```
Vercel Cron (daily) ─┐
Deploy webhook ──────┼─> runChecks(site) ──> PageSpeed Insights API (mobile + desktop in parallel)
"Run check" button ──┘          │
                                ├─ parsePsi()          score, lab metrics, CrUX field data
                                ├─ parseDiagnostics()  700 KB response -> ~20 KB record + screenshots
                                ├─ store in Postgres   checks (numbers) + check_details (diagnostics, pruned)
                                └─ detectRegression()  median of last 7 runs -> email via Resend
```

- **Pure, tested core.** Rating thresholds, the PageSpeed and Lighthouse 13 parsers, deploy comparison, regression detection, the run diff and the fix generator are plain functions with unit tests.
- **Noise-aware comparisons.** Lighthouse scores swing a few points between identical runs, so deploy verdicts compare medians of 3 runs on each side and ignore moves under 5 points.
- **Storage budget.** Diagnostics are ~100x larger than the numbers, so they live in their own table and only the latest runs per site and device are kept. Screenshots are served from a cached route instead of being inlined into pages.
- **Rendering.** App Router with Cache Components / Partial Prerendering: static shells stream in instantly, data loads in Suspense boundaries.

## Tech stack

Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · Magic UI · Lenis · Motion · Drizzle ORM · PostgreSQL (Neon in production, PGlite locally) · Better Auth · react-pdf · Resend · Vitest · Playwright + axe-core · GitHub Actions · Vercel (cron, `after()` background work)

## Run it locally

```bash
npm install
cp .env.example .env.local      # then fill in BETTER_AUTH_SECRET and PSI_API_KEY
npm run dev                     # http://localhost:3001
```

No database setup is needed: locally the app uses PGlite (real Postgres compiled to WebAssembly) stored in `./.data`, and migrations run automatically.

Demo data: with the dev server running, `curl -X POST http://localhost:3001/api/dev/seed`, then sign in as `demo@vitalswatch.dev` / `vitals-demo` (three sites with 90 days of history and deploys).

### Environment variables

| Variable | Needed | What it's for |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Yes | Signs sessions. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `PSI_API_KEY` | Yes, in practice | Free PageSpeed Insights key ([get one](https://developers.google.com/speed/docs/insights/v5/get-started), no billing). Keyless requests are heavily rate-limited. |
| `DATABASE_URL` | Production | Postgres connection string (e.g. Neon). Empty locally = PGlite. |
| `CRON_SECRET` | Production | Vercel sends it with the daily cron request. Also unlocks the demo seed in production. |
| `RESEND_API_KEY` | Optional | Sends alert and password-reset emails. Without it they're printed to the server console in development. |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL` | Optional on Vercel | Public URL; falls back to the Vercel production domain. |

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Dev server on port 3001 |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end and accessibility tests (Playwright + axe) against a production build with a throwaway database and a fake PageSpeed API |
| `npm run lint` | ESLint |
| `npm run db:generate` | Create a migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` (runs automatically on Vercel via `vercel-build`) |

## Deploying to Vercel

1. Create a Neon database and import the repo into Vercel.
2. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PSI_API_KEY` and `CRON_SECRET` (optionally `RESEND_API_KEY`).
3. Deploy. `vercel-build` applies migrations before building, and `vercel.json` schedules the daily check at 02:30 UTC.

## License

MIT
