"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CircleCheck, TriangleAlert } from "lucide-react";
import { AnimatedList } from "@/components/ui/animated-list";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedSpan, Terminal, TypingAnimation } from "@/components/ui/terminal";
import { cn } from "@/lib/utils";

export function BentoCard({ title, body, children, className }: { title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <MagicCard
      className={cn("rounded-2xl", className)}
      gradientSize={260}
      gradientColor="rgba(45,212,230,0.07)"
      gradientOpacity={1}
      gradientFrom="rgba(45,212,230,0.55)"
      gradientTo="rgba(45,212,230,0.08)"
    >
      <div className="relative flex h-full flex-col">
        <div className="flex-1 overflow-hidden">{children}</div>
        <div className="border-t border-border p-6">
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </MagicCard>
  );
}

const ALERTS = [
  { icon: "down", site: "store.example.com", text: "Mobile score 71 → 52 after 7be01d4", time: "02:34" },
  { icon: "ok", site: "docs.example.com", text: "Passes Core Web Vitals for the first time", time: "02:31" },
  { icon: "warn", site: "blog.example.com", text: "INP needs work: 240 ms at p75", time: "Yesterday" },
  { icon: "up", site: "store.example.com", text: "Deploy 1f8e7aa made mobile 13 points faster", time: "Mon" },
] as const;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function AlertFeed() {
  // With reduced motion, show every alert at once instead of sliding them in.
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const items = ALERTS.map((a) => {
          const Icon = a.icon === "down" ? ArrowDownRight : a.icon === "up" ? ArrowUpRight : a.icon === "ok" ? CircleCheck : TriangleAlert;
          const tone = a.icon === "down" ? "text-poor bg-poor/10" : a.icon === "warn" ? "text-warn bg-warn/10" : "text-good bg-good/10";
          return (
            <div key={a.text} className="flex w-full items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", tone)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2 text-[11px] text-subtle">
                  <span className="truncate">{a.site}</span>
                  <span className="shrink-0">{a.time}</span>
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-foreground">{a.text}</p>
              </div>
            </div>
          );
        });
  return (
    <div className="relative h-72 overflow-hidden px-5 pt-5 [mask-image:linear-gradient(to_bottom,black_65%,transparent)]">
      {reduced ? (
        <div className="flex flex-col gap-2.5">{[...items].reverse()}</div>
      ) : (
        <AnimatedList delay={1400} className="gap-2.5">
          {items}
        </AnimatedList>
      )}
    </div>
  );
}

export function DeployTerminal() {
  return (
    <div className="p-5">
      <Terminal className="max-w-none border-border bg-screen text-[11.5px] [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]">
        <TypingAnimation duration={22} className="text-muted-foreground">
          {`$ curl -X POST $VW/api/deploys -H "Authorization: Bearer $VW_TOKEN" -d '{"ref":"1f8e7aa"}'`}
        </TypingAnimation>
        <AnimatedSpan className="text-good">{`✓ 202 { "deploy": 214, "checking": true }`}</AnimatedSpan>
        <AnimatedSpan className="text-subtle">… testing mobile and desktop</AnimatedSpan>
        <AnimatedSpan className="text-foreground">{`mobile   74 → 87   faster`}</AnimatedSpan>
        <AnimatedSpan className="text-foreground">{`desktop  91 → 98   faster`}</AnimatedSpan>
      </Terminal>
    </div>
  );
}

/** Six runs either side of a deploy: the single runs scatter, the medians don't. */
export function MediansSketch() {
  const before = [72, 75, 70];
  const after = [55, 51, 53];
  const W = 320;
  const H = 150;
  const y = (s: number) => 16 + (1 - (s - 40) / 50) * (H - 40);
  const xs = [40, 80, 120, 200, 240, 280];
  return (
    <div className="grid h-72 place-items-center px-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" aria-hidden>
        <line x1={160} x2={160} y1={8} y2={H - 18} stroke="var(--poor)" strokeOpacity={0.6} strokeDasharray="3 4" />
        <text x={160} y={H - 4} textAnchor="middle" className="fill-subtle text-[10px]">deploy</text>
        {[...before, ...after].map((s, i) => (
          <circle key={i} cx={xs[i]} cy={y(s)} r={4.5} fill={i < 3 ? "var(--brand)" : "var(--poor)"} fillOpacity={0.35} stroke={i < 3 ? "var(--brand)" : "var(--poor)"} />
        ))}
        <line x1={28} x2={132} y1={y(72)} y2={y(72)} stroke="var(--brand)" strokeWidth={2} />
        <line x1={188} x2={292} y1={y(53)} y2={y(53)} stroke="var(--poor)" strokeWidth={2} />
        <text x={28} y={y(72) - 10} className="fill-foreground text-[11px] font-medium">median 72</text>
        <text x={292} y={y(53) + 20} textAnchor="end" className="fill-foreground text-[11px] font-medium">median 53</text>
      </svg>
    </div>
  );
}
