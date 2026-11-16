"use client";

import { useEffect, useState } from "react";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

/** One heartbeat: flat, a small P bump, the QRS spike, a T wave, flat. 300 units wide. */
const BEAT = "L80,70 Q92,62 104,70 L132,70 L140,80 L150,14 L161,96 L170,70 L196,70 Q216,52 236,70 L300,70";
const beats = (n: number) => {
  let d = "M0,70";
  for (let i = 0; i < n; i++) d += " " + BEAT.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+x + i * 300},${y}`);
  return d;
};
const TRACE = beats(4);

// Each tick nudges the readouts the way back-to-back Lighthouse runs really wobble.
const FRAMES = [
  { score: 94, lcp: 1.9, inp: 124, cls: 0.03 },
  { score: 92, lcp: 2.0, inp: 131, cls: 0.03 },
  { score: 95, lcp: 1.8, inp: 118, cls: 0.02 },
  { score: 93, lcp: 1.9, inp: 127, cls: 0.03 },
];

const BARS = [71, 72, 70, 73, 72, 74, 52, 51, 74, 75, 73, 76, 75, 74, 77, 86, 87, 85, 88, 87, 89, 90, 92, 91, 93, 92, 94, 93, 95, 94];

function Readout({ label, unit, value, decimals = 0, tone = "good" }: { label: string; unit?: string; value: number; decimals?: number; tone?: "good" | "warn" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0">
      <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-subtle">
        <span className={cn("size-1.5 rounded-full", tone === "good" ? "bg-good" : "bg-warn")} aria-hidden />
        {label}
      </span>
      <span className="text-lg font-medium tabular-nums tracking-tight text-foreground">
        <NumberTicker value={value} startValue={Number((value * 0.6).toFixed(decimals))} decimalPlaces={decimals} className="tracking-tight text-foreground" />
        {unit && <span className="ml-0.5 text-xs text-subtle">{unit}</span>}
      </span>
    </div>
  );
}

export function Monitor({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 3200);
    return () => clearInterval(id);
  }, []);

  const f = FRAMES[frame];

  return (
    <div
      className={cn("relative rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,#121214,#08080a)] p-2 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(0,0,0,0.6)]", className)}
      role="img"
      aria-label="Example readout for store.example.com on mobile: Lighthouse score 94, Largest Contentful Paint 1.9 seconds, Interaction to Next Paint 124 milliseconds, Cumulative Layout Shift 0.03, with a 30-day trend that dips after one deploy and recovers."
    >
      <BorderBeam size={160} duration={9} colorFrom="#2dd4e6" colorTo="rgba(45,212,230,0)" borderWidth={1.5} />

      <div aria-hidden className="relative overflow-hidden rounded-[20px] border border-white/[0.05] bg-screen">
        {/* Screen glare */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(115deg,rgba(255,255,255,0.05),transparent_38%)]" />

        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 text-[11px]">
          <span className="flex items-center gap-2 font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            store.example.com
            <span className="text-subtle">· mobile</span>
          </span>
          <span className="text-subtle">Next run 02:30 UTC</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_11.5rem]">
          {/* Trace */}
          <div className="relative h-44 overflow-hidden border-b border-white/[0.06] sm:h-auto sm:border-b-0 sm:border-r">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(45,212,230,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(45,212,230,0.06)_1px,transparent_1px)] bg-[size:24px_24px]" />
            <p className="absolute left-4 top-3 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">Performance · live</p>
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]">
              <svg viewBox="0 0 1200 110" className="monitor-trace h-28 w-[200%] overflow-visible" preserveAspectRatio="none">
                <path d={TRACE} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px rgba(45,212,230,0.8))" }} />
              </svg>
            </div>
          </div>

          {/* Readouts */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">Score</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tighter text-brand [text-shadow:0_0_24px_rgba(45,212,230,0.45)]">
              <NumberTicker value={f.score} startValue={40} className="tracking-tighter text-brand" />
            </p>
            <div className="mt-3">
              <Readout label="LCP" unit="s" value={f.lcp} decimals={1} />
              <Readout label="INP" unit="ms" value={f.inp} />
              <Readout label="CLS" value={f.cls} decimals={2} />
            </div>
          </div>
        </div>

        {/* 30-day strip */}
        <div className="border-t border-white/[0.06] px-4 pb-3 pt-3">
          <div className="flex h-10 items-end gap-[3px]">
            {BARS.map((s, i) => (
              <span
                key={i}
                className={cn("flex-1 rounded-[2px]", s < 60 ? "bg-poor/80" : i === BARS.length - 1 ? "bg-brand" : "bg-brand/25")}
                style={{ height: `${((s - 40) / 60) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-subtle">
            <span>30 days ago</span>
            <span className="text-poor">▲ 7be01d4 · chat widget</span>
            <span>today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
