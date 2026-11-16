/**
 * The hero's product shot: 90 days of a store's mobile score, with the deploy
 * that broke it and the one that fixed it. Static SVG, drawn on load with CSS.
 */
const LEVELS = [
  { from: 0, score: 57 },
  { from: 29, score: 71 },
  { from: 52, score: 52 },
  { from: 56, score: 74 },
  { from: 77, score: 86 },
];
const DEPLOYS = [
  { day: 29, ref: "a41c9e2" },
  { day: 52, ref: "7be01d4", bad: true },
  { day: 56, ref: "c93f210" },
  { day: 77, ref: "1f8e7aa" },
];

const W = 1000;
const H = 300;
const PAD = { l: 44, r: 20, t: 24, b: 30 };

function score(day: number) {
  const level = LEVELS.findLast((l) => l.from <= day)!.score;
  // Deterministic wobble so it looks like real Lighthouse noise.
  return level + Math.sin(day * 1.7) * 1.6 + Math.sin(day * 0.63 + 1) * 1.2;
}

export function HeroChart() {
  const days = Array.from({ length: 91 }, (_, i) => i);
  const x = (d: number) => PAD.l + (d / 90) * (W - PAD.l - PAD.r);
  const y = (s: number) => PAD.t + (1 - (s - 30) / 70) * (H - PAD.t - PAD.b);
  const line = days.map((d) => `${d ? "L" : "M"}${x(d).toFixed(1)},${y(score(d)).toFixed(1)}`).join("");
  const area = `${line}L${x(90)},${H - PAD.b}L${x(0)},${H - PAD.b}Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Example: a store's mobile Lighthouse score over 90 days. It drops from 71 to 52 after a deploy that added a chat widget, then recovers to 74 after the fix, and reaches 86 after a later image optimisation.">
        <defs>
          <linearGradient id="hero-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity={0.22} />
            <stop offset="1" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[50, 90].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={v === 90 ? "var(--good)" : "var(--poor)"} strokeOpacity={0.5} strokeDasharray="2 5" />
            <text x={PAD.l - 10} y={y(v)} dy="0.32em" textAnchor="end" className="fill-subtle text-[12px]">
              {v}
            </text>
          </g>
        ))}
        {DEPLOYS.map((d) => (
          <g key={d.ref}>
            <line x1={x(d.day - 0.5)} x2={x(d.day - 0.5)} y1={PAD.t + 8} y2={H - PAD.b} stroke={d.bad ? "var(--poor)" : "var(--muted-foreground)"} strokeOpacity={d.bad ? 0.7 : 0.35} strokeDasharray="3 4" />
            <rect x={x(d.day - 0.5) - 4} y={PAD.t} width={8} height={8} rx={1.5} transform={`rotate(45 ${x(d.day - 0.5)} ${PAD.t + 4})`} fill={d.bad ? "var(--poor)" : "var(--foreground)"} />
          </g>
        ))}
        <path d={area} fill="url(#hero-fill)" className="fade-late" style={{ ["--reveal-delay" as string]: "1.4s" }} />
        <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" pathLength={1600} className="draw-line" />
        <circle cx={x(90)} cy={y(score(90))} r={5} fill="var(--good)" stroke="var(--card)" strokeWidth={2.5} className="fade-late" style={{ ["--reveal-delay" as string]: "2.3s" }} />
        {["Aug", "Sep", "Oct", "Nov"].map((m, i) => (
          <text key={m} x={x(i * 30)} y={H - 8} textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"} className="fill-subtle text-[12px]">
            {m}
          </text>
        ))}
      </svg>

      {/* Callouts in HTML so they stay crisp and readable at any width. */}
      <div
        className="fade-late absolute hidden w-56 rounded-lg border border-poor/30 bg-popover/95 p-3 text-xs shadow-2xl shadow-black/60 backdrop-blur sm:block"
        style={{ left: `${(x(52) / W) * 100 - 30}%`, top: `${(y(50) / H) * 100 + 6}%`, ["--reveal-delay" as string]: "1.9s" }}
      >
        <p className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground">7be01d4</span>
          <span className="ml-auto font-medium text-poor">71 → 52</span>
        </p>
        <p className="mt-1 text-foreground">Add live chat widget</p>
        <p className="mt-1 text-subtle">Total Blocking Time +700 ms. Emailed you at 02:34.</p>
      </div>
      <div
        className="fade-late absolute hidden w-52 rounded-lg border border-good/30 bg-popover/95 p-3 text-xs shadow-2xl shadow-black/60 backdrop-blur md:block"
        style={{ left: `${(x(60) / W) * 100}%`, top: `${(y(96) / H) * 100}%`, ["--reveal-delay" as string]: "2.2s" }}
      >
        <p className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground">c93f210</span>
          <span className="ml-auto font-medium text-good">52 → 74</span>
        </p>
        <p className="mt-1 text-foreground">Load chat on first interaction</p>
      </div>
    </div>
  );
}
