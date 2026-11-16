import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { BorderBeam } from "@/components/ui/border-beam";
import { FlickeringGrid } from "@/components/ui/flickering-grid";

const BEAT = "l70,0 q10,-8 20,0 l22,0 l7,9 l9,-58 l10,74 l8,-25 l22,0 q18,-16 36,0 l96,0";
const LINE = `M0,80 ${Array.from({ length: 8 }, () => BEAT).join(" ")}`;

/** Centered, full-bleed: the page is a monitor, the form sits on the screen. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <FlickeringGrid
        aria-hidden
        className="absolute inset-0 -z-20 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_50%,black,transparent)]"
        squareSize={3}
        gridGap={8}
        color="rgb(45, 212, 230)"
        maxOpacity={0.12}
        flickerChance={0.05}
      />
      {/* The trace runs the full width behind the card. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
        <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="monitor-trace h-28 w-[200%] opacity-60">
          <path d={LINE} fill="none" stroke="var(--brand)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 5px rgba(45,212,230,0.7))" }} />
        </svg>
      </div>

      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <Logo />
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Back to site
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="relative w-full max-w-[25rem] rounded-[22px] border border-white/[0.08] bg-[rgba(10,10,12,0.82)] p-7 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-9">
          <BorderBeam size={140} duration={10} colorFrom="#2dd4e6" colorTo="rgba(45,212,230,0)" />
          <h1 className="text-lit text-[1.75rem] font-semibold leading-tight tracking-[-0.035em]">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>

      <p className="px-6 pb-6 text-center text-xs text-subtle">Free for 10 pages · No card · Nothing to install on your site</p>
    </div>
  );
}
