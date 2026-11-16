"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { runCheckNow } from "@/app/actions/sites";

/**
 * Runs Lighthouse on mobile and desktop through PageSpeed Insights. It takes
 * 15–40 seconds, so show elapsed time instead of a spinner that looks stuck.
 * `autoStart` kicks off the very first run after a site is added.
 */
export function RunCheckButton({ siteId, autoStart = false }: { siteId: string; autoStart?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    try {
      const result = await runCheckNow(siteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const failed = result.outcomes.filter((o) => o.error);
      if (failed.length === result.outcomes.length) toast.error(failed[0].error);
      else {
        const m = result.outcomes.find((o) => o.strategy === "mobile")?.score;
        const d = result.outcomes.find((o) => o.strategy === "desktop")?.score;
        toast.success(`Done: mobile ${m ?? "failed"}, desktop ${d ?? "failed"}`);
      }
      router.refresh();
    } catch {
      toast.error("The check didn't finish. Try again in a minute.");
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      // Drop ?first=1 so a reload doesn't start another run.
      window.history.replaceState(null, "", window.location.pathname);
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <button
      type="button"
      onClick={run}
      disabled={running}
      aria-live="polite"
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-progress disabled:opacity-80"
    >
      {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-3.5 fill-current" aria-hidden />}
      {running ? `Testing… ${elapsed}s` : "Run check"}
    </button>
  );
}
