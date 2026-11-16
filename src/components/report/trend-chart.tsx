"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime, formatDay } from "@/lib/format";
import { METRICS, formatMetric, rateMetric, rateScore, type LabMetric, type Rating } from "@/lib/vitals";
import { RatingLabel } from "@/components/ui/rating";

export type ChartMetric = "score" | LabMetric;

export interface ChartPoint {
  t: number;
  value: number;
  trigger: "manual" | "scheduled" | "deploy";
}

export interface ChartDeploy {
  t: number;
  ref: string;
  message: string | null;
}

const H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

function niceMax(v: number) {
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

const fmt = (metric: ChartMetric, v: number) => (metric === "score" ? String(Math.round(v)) : formatMetric(metric, v));
const rate = (metric: ChartMetric, v: number): Rating => (metric === "score" ? rateScore(v) : rateMetric(metric, v));

/**
 * One series over time, with the "good" / "poor" thresholds as reference lines
 * and every deploy as a marker, so a step in the line lines up with its cause.
 */
export function TrendChart({
  points,
  deploys,
  metric,
  from,
  to,
}: {
  points: ChartPoint[];
  deploys: ChartDeploy[];
  metric: ChartMetric;
  from: number;
  to: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<{ kind: "point"; i: number } | { kind: "deploy"; i: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const thresholds: [number, number] = metric === "score" ? [90, 50] : METRICS[metric].thresholds;
  const yMax = useMemo(() => {
    if (metric === "score") return 100;
    const top = Math.max(METRICS[metric].thresholds[1] * 1.15, ...points.map((p) => p.value));
    return niceMax(top * 1.05);
  }, [metric, points]);

  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - from) / Math.max(1, to - from)) * innerW;
  const y = (v: number) => PAD.top + innerH - (Math.min(v, yMax) / yMax) * innerH;

  // Break the line where runs are missing for more than two days, rather than drawing a fake trend.
  const path = points
    .map((p, i) => `${i === 0 || p.t - points[i - 1].t > 2.2 * 86_400_000 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join("");

  const yTicks = metric === "score" ? [0, 50, 90, 100] : [0, yMax / 4, yMax / 2, (3 * yMax) / 4, yMax];
  const xTickCount = width < 520 ? 3 : 6;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => from + ((to - from) * i) / (xTickCount - 1));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + PAD.left;
    // Deploy markers win when the pointer is within 6px of one.
    const d = deploys.findIndex((dep) => Math.abs(x(dep.t) - px) < 6);
    if (d >= 0) return setHover({ kind: "deploy", i: d });
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].t) - px) < Math.abs(x(points[best].t) - px)) best = i;
    setHover({ kind: "point", i: best });
  }

  const hp = hover?.kind === "point" ? points[hover.i] : null;
  const hd = hover?.kind === "deploy" ? deploys[hover.i] : null;
  const tipX = hp ? x(hp.t) : hd ? x(hd.t) : 0;
  const deployRef = (t: number) => deploys.find((d) => Math.abs(d.t - t) < 30 * 60_000);

  const label =
    metric === "score" ? "Performance score" : `${METRICS[metric].short} (${METRICS[metric].label})`;
  const last = points.at(-1);

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`${label} over time${last ? `, latest ${fmt(metric, last.value)}` : ""}. ${deploys.length} deploys marked. The run history table below lists every value.`}
        className="block select-none"
      >
        {/* Grid + y axis */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-subtle text-[11px] tabular-nums">
              {metric === "score" ? v : formatMetric(metric, v).replace(" ", " ")}
            </text>
          </g>
        ))}

        {/* Thresholds */}
        {thresholds.map((v, i) =>
          v <= yMax ? (
            <g key={`th-${v}`}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke={i === 0 ? "var(--good)" : "var(--poor)"}
                strokeOpacity={0.55}
                strokeDasharray="2 4"
                strokeWidth={1}
              />
              <text x={width - PAD.right - 4} y={y(v) - 5} textAnchor="end" className="fill-muted-foreground text-[10.5px]">
                {metric === "score" ? (i === 0 ? "Good ≥ 90" : "Poor < 50") : i === 0 ? `Good ≤ ${fmt(metric, v)}` : `Poor > ${fmt(metric, v)}`}
              </text>
            </g>
          ) : null,
        )}

        {/* x axis */}
        {xTicks.map((t, i) => (
          <text
            key={t}
            x={x(t)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            className="fill-subtle text-[11px]"
          >
            {formatDay(t)}
          </text>
        ))}

        {/* Deploys */}
        {deploys.map((d, i) => (
          <g key={`${d.ref}-${d.t}`} opacity={hd && hover?.i !== i ? 0.35 : 1}>
            <line x1={x(d.t)} x2={x(d.t)} y1={PAD.top + 8} y2={PAD.top + innerH} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="3 3" />
            <rect x={x(d.t) - 4} y={PAD.top} width={8} height={8} rx={1.5} transform={`rotate(45 ${x(d.t)} ${PAD.top + 4})`} fill="var(--foreground)" />
          </g>
        ))}

        {/* Series */}
        <path d={path} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={x(last.t)} cy={y(last.value)} r={4} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />}

        {/* Hover */}
        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--foreground)" strokeOpacity={0.25} />
            <circle cx={x(hp.t)} cy={y(hp.value)} r={5} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />
          </g>
        )}

        <rect
          x={PAD.left}
          y={0}
          width={innerW}
          height={H - PAD.bottom}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {(hp || hd) && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-max max-w-60 rounded-lg border border-border-strong bg-popover px-3 py-2 text-xs shadow-xl shadow-black/40"
          style={tipX > width / 2 ? { right: width - tipX + 12 } : { left: tipX + 12 }}
        >
          {hp ? (
            <>
              <p className="text-muted-foreground">{formatDateTime(hp.t)}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-base font-semibold tabular-nums text-foreground">{fmt(metric, hp.value)}</span>
                <RatingLabel rating={rate(metric, hp.value)} />
              </p>
              <p className="mt-1 text-subtle">
                {hp.trigger === "deploy"
                  ? `After deploy ${deployRef(hp.t)?.ref ?? ""}`
                  : hp.trigger === "manual"
                    ? "Run by hand"
                    : "Daily run"}
              </p>
            </>
          ) : hd ? (
            <>
              <p className="text-muted-foreground">Deploy · {formatDateTime(hd.t)}</p>
              <p className="mt-1 font-medium text-foreground">
                <span className="font-mono text-[11px]">{hd.ref}</span>
              </p>
              {hd.message && <p className="mt-0.5 text-muted-foreground">{hd.message}</p>}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
