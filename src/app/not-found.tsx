import Link from "next/link";
import { Logo } from "@/components/marketing/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col px-5">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center">
        <Logo />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <svg viewBox="0 0 200 40" className="h-10 w-48" aria-hidden>
          <path d="M0 22h70l6-12 9 24 7-30 8 26 5-8h20" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M125 22h75" fill="none" stroke="var(--subtle)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 6" />
        </svg>
        <h1 className="text-lit mt-8 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">No signal on this page.</h1>
        <p className="mt-3 max-w-sm text-muted-foreground">The link may be wrong, the report may be private, or the site was deleted.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-medium text-black hover:bg-white/90">
            Go to your sites
          </Link>
          <Link href="/" className="inline-flex h-11 items-center rounded-xl border border-border-strong px-5 text-sm font-medium text-foreground hover:bg-raised">
            VitalsWatch home
          </Link>
        </div>
      </div>
    </main>
  );
}
