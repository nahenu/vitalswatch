"use client";

import { useEffect, useState } from "react";

/** Next 02:30 UTC, when the daily cron fires. */
function nextRun(now: number) {
  const d = new Date(now);
  d.setUTCHours(2, 30, 0, 0);
  if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Live hh:mm:ss countdown. The clock is only read in the browser (never during
 * prerender), so the static shell shows a placeholder until the first tick.
 */
export function NextRunCountdown({ className }: { className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (now == null) return <span className={className}>--:--:--</span>;
  const s = Math.max(0, Math.floor((nextRun(now) - now) / 1000));
  return (
    <span className={className}>
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  );
}
