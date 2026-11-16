import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { RATING_LABEL, rateScore, type Rating } from "@/lib/vitals";
import { cn } from "@/lib/utils";

export const RATING_TEXT: Record<Rating, string> = {
  good: "text-good",
  "needs-improvement": "text-warn",
  poor: "text-poor",
};
export const RATING_BG: Record<Rating, string> = {
  good: "bg-good",
  "needs-improvement": "bg-warn",
  poor: "bg-poor",
};
export const RATING_STROKE: Record<Rating, string> = {
  good: "var(--good)",
  "needs-improvement": "var(--warn)",
  poor: "var(--poor)",
};

const ICON = { good: CircleCheck, "needs-improvement": TriangleAlert, poor: CircleX } as const;

/** Rating as icon + word, never colour alone. */
export function RatingLabel({ rating, className, label }: { rating: Rating; className?: string; label?: string }) {
  const Icon = ICON[rating];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
      <Icon className={cn("size-3.5 shrink-0", RATING_TEXT[rating])} aria-hidden />
      {label ?? RATING_LABEL[rating]}
    </span>
  );
}

/** Lighthouse-style gauge. */
export function ScoreRing({ score, size = 96, label }: { score: number | null; size?: number; label?: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const rating = score == null ? null : rateScore(score);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--raised)" strokeWidth="7" />
        {rating && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={RATING_STROKE[rating]}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(c * (score as number)) / 100} ${c}`}
          />
        )}
      </svg>
      <span className="font-semibold tabular-nums tracking-tight text-foreground" style={{ fontSize: size * 0.3 }}>
        {score ?? "—"}
        {label && <span className="sr-only"> {label}</span>}
      </span>
    </div>
  );
}

/** Small round score chip for lists. */
export function ScoreChip({ score, className }: { score: number | null; className?: string }) {
  const rating = score == null ? null : rateScore(score);
  return (
    <span className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}>
      <span className={cn("size-2 rounded-full", rating ? RATING_BG[rating] : "bg-subtle")} aria-hidden />
      <span className="font-medium text-foreground">{score ?? "—"}</span>
    </span>
  );
}
