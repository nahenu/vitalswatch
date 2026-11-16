"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, FileDown, Gauge, Radio } from "lucide-react";
import { NextRunCountdown } from "@/components/app/next-run";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";

const SECTIONS = [
  { id: "product", label: "Product", icon: Activity },
  { id: "vitals", label: "Web Vitals", icon: Gauge },
  { id: "share", label: "Share & PDF", icon: FileDown },
] as const;

/** Top of the page: just the mark and the monitor's own heartbeat, no menu. */
export function TopLine() {
  return (
    <div className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground">
          <LogoMark className="size-7" /> VitalsWatch
        </Link>
        <div className="flex items-center gap-5">
          <p className="hidden items-center gap-2 text-xs text-subtle sm:flex">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
            </span>
            Next check run in <NextRunCountdown className="tabular-nums text-muted-foreground" />
          </p>
          <Link href="/sign-in" className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Floating dock at the bottom of the screen, lighting up the section in view. */
export function Dock() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const onTop = () => window.scrollY < 300 && setActive(null);
    window.addEventListener("scroll", onTop, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onTop);
    };
  }, []);

  return (
    <nav
      aria-label="Main"
      className="dock-in fixed inset-x-0 bottom-4 z-50 mx-auto flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-2xl border border-white/[0.09] bg-[rgba(16,16,18,0.78)] p-1.5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:bottom-6"
    >
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-label={label}
          aria-current={active === id ? "true" : undefined}
          className={cn(
            "flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground",
            active === id && "bg-white/[0.08] text-foreground",
          )}
        >
          <Icon className={cn("size-4", active === id && "text-brand")} aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </a>
      ))}
      <Link href="/r/demo" aria-label="Live demo" className="flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-muted-foreground hover:bg-white/[0.05] hover:text-foreground">
        <Radio className="size-4" aria-hidden />
        <span className="hidden sm:inline">Live demo</span>
      </Link>
      <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
      <Link href="/sign-up" className="group flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-white">
        Start free <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </nav>
  );
}
