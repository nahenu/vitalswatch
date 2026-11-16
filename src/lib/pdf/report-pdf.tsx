import { Document, Font, Image, Line, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Diagnostics } from "@/lib/diagnostics";
import { diffDiagnostics, isEmptyDiff } from "@/lib/diff";
import { LCP_PHASES, fixFor } from "@/lib/fixes";
import { CORE_FIELD_METRICS, LAB_METRICS, METRICS, RATING_LABEL, formatMetric, rateMetric, rateScore, type FieldData, type Rating } from "@/lib/vitals";

/**
 * The PDF version of a site report. Light and print-friendly on purpose: it's
 * for sharing with a team or attaching to a ticket. Built with react-pdf, so it
 * renders on the server without a headless browser.
 */

export interface PdfReportInput {
  site: { name: string; url: string };
  strategy: "mobile" | "desktop";
  generatedAt: Date;
  scores: { mobile: number | null; desktop: number | null };
  lab: Partial<Record<(typeof LAB_METRICS)[number], number | null>>;
  field: FieldData | null;
  trend: { t: number; score: number }[];
  deploys: { t: number; ref: string; message: string | null; before: number | null; after: number | null }[];
  diag: Diagnostics | null;
  baseline: { t: number; label: string; diag: Diagnostics } | null;
  reportUrl?: string;
}

// Never hyphenate: it breaks URLs and code ("on-load", "no-script").
Font.registerHyphenationCallback((word) => [word]);

const C = {
  ink: "#111114",
  text: "#33343a",
  muted: "#6b6d76",
  line: "#e3e4e8",
  soft: "#f4f5f7",
  brand: "#0e8ea0",
  good: "#16833a",
  warn: "#b7790a",
  poor: "#c62f34",
};
const RATING_COLOR: Record<Rating, string> = { good: C.good, "needs-improvement": C.warn, poor: C.poor };

/** The built-in PDF fonts only cover Latin-1: swap the typographic symbols we use for plain ones. */
const t = (s: string | number | null | undefined) =>
  String(s ?? "")
    .replace(/−/g, "-")
    .replace(/→/g, "->")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[  ]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ‘’“”…–—•]/g, "");

/** Leading spaces become non-breaking so the PDF keeps the code's indentation. */
const NBSP = String.fromCharCode(160);
const keepIndent = (code: string) => code.replace(/^ +/gm, (m) => NBSP.repeat(m.length));

const fmtBytes = (b?: number) => (b == null ? "-" : b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);
const fmtMs = (ms?: number) => (ms == null ? "-" : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const day = (d: number | Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(d));

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: C.text, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.ink, lineHeight: 1.25, marginBottom: 2 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 8 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 4 },
  label: { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  section: { marginTop: 18 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 12 },
  row: { flexDirection: "row" },
  code: { fontFamily: "Courier", fontSize: 7.5, color: C.ink, backgroundColor: C.soft, padding: 8, borderRadius: 4, marginTop: 4, lineHeight: 1.45 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 4 },
  th: { fontSize: 7, color: C.muted, textTransform: "uppercase" },
});

function Footer({ input }: { input: PdfReportInput }) {
  return (
    <View style={s.footer} fixed>
      <Text>{t(`VitalsWatch · ${input.site.name} · ${input.strategy} · ${day(input.generatedAt)}`)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function ScoreBox({ label, score }: { label: string; score: number | null }) {
  const color = score == null ? C.muted : RATING_COLOR[rateScore(score)];
  return (
    <View style={[s.card, { flex: 1, alignItems: "center" }]}>
      <Text style={s.label}>{label}</Text>
      <Text style={{ fontSize: 30, fontFamily: "Helvetica-Bold", color, marginTop: 4, lineHeight: 1.15 }}>{score ?? "-"}</Text>
      <Text style={{ fontSize: 8, color }}>{score == null ? "No run" : RATING_LABEL[rateScore(score)]}</Text>
    </View>
  );
}

function TrendSvg({ trend, deploys }: { trend: PdfReportInput["trend"]; deploys: PdfReportInput["deploys"] }) {
  if (trend.length < 2) return <Text style={{ color: C.muted }}>Not enough runs for a trend yet.</Text>;
  const W = 515;
  const H = 120;
  const t0 = trend[0].t;
  const t1 = trend.at(-1)!.t;
  const x = (v: number) => ((v - t0) / Math.max(1, t1 - t0)) * (W - 30) + 25;
  const y = (v: number) => 8 + (1 - v / 100) * (H - 24);
  const d = trend.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  return (
    <Svg width={W} height={H}>
      {[0, 50, 90, 100].map((v) => (
        <Line key={v} x1={25} x2={W - 5} y1={y(v)} y2={y(v)} stroke={v === 90 ? C.good : v === 50 ? C.poor : C.line} strokeWidth={0.6} strokeDasharray={v === 90 || v === 50 ? "2 3" : undefined} />
      ))}
      {deploys
        .filter((dp) => dp.t >= t0 && dp.t <= t1)
        .map((dp) => (
          <Line key={dp.ref + dp.t} x1={x(dp.t)} x2={x(dp.t)} y1={6} y2={H - 16} stroke={C.muted} strokeWidth={0.6} strokeDasharray="2 2" />
        ))}
      <Path d={d} stroke={C.brand} strokeWidth={1.6} fill="none" />
      <Text x={2} y={y(90) + 3} style={{ fontSize: 6.5, fill: C.muted }}>
        90
      </Text>
      <Text x={2} y={y(50) + 3} style={{ fontSize: 6.5, fill: C.muted }}>
        50
      </Text>
      <Text x={25} y={H - 3} style={{ fontSize: 6.5, fill: C.muted }}>
        {t(day(t0))}
      </Text>
      <Text x={W - 60} y={H - 3} style={{ fontSize: 6.5, fill: C.muted }}>
        {t(day(t1))}
      </Text>
    </Svg>
  );
}

function FieldBlock({ field }: { field: FieldData }) {
  const misses = CORE_FIELD_METRICS.flatMap((m) => {
    const v = field.metrics[m];
    return v && v.rating !== "good" ? [`${METRICS[m].short} is ${formatMetric(m, v.p75)} (needs <= ${formatMetric(m, METRICS[m].thresholds[0])})`] : [];
  });
  const pass = field.overall === "good";
  return (
    <View style={s.card}>
      <View style={[s.row, { justifyContent: "space-between", marginBottom: 8 }]}>
        <Text style={s.h3}>Real users · Core Web Vitals</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", color: pass ? C.good : C.poor }}>{pass ? "PASSES" : "FAILS"}</Text>
      </View>
      <View style={s.row}>
        {CORE_FIELD_METRICS.map((m) => {
          const v = field.metrics[m];
          return (
            <View key={m} style={{ flex: 1 }}>
              <Text style={s.label}>{METRICS[m].short}</Text>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: C.ink, lineHeight: 1.3 }}>{v ? t(formatMetric(m, v.p75)) : "-"}</Text>
              {v && <Text style={{ fontSize: 7.5, color: RATING_COLOR[v.rating] }}>{RATING_LABEL[v.rating]}</Text>}
            </View>
          );
        })}
      </View>
      <Text style={{ marginTop: 8, fontSize: 8 }}>
        {t(pass ? "At least 75% of visits get a good LCP, INP and CLS." : `Why it fails: ${misses.join(", ") || "one metric is outside the good range"}.`)}
      </Text>
      <Text style={{ marginTop: 3, fontSize: 7.5, color: C.muted }}>
        {t(`75th percentile of Chrome users, last 28 days (${field.scope === "url" ? "this page" : "whole site"}). This is the data Google uses for search ranking.`)}
      </Text>
    </View>
  );
}

export function ReportPdf({ input }: { input: PdfReportInput }) {
  const d = input.diag;
  const siteUrl = input.site.url;
  const diff = d && input.baseline ? diffDiagnostics(input.baseline.diag, d) : null;
  return (
    <Document title={`VitalsWatch report: ${input.site.name}`} author="VitalsWatch" subject="Page speed report">
      {/* ── Page 1: summary ── */}
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
          <View>
            <Text style={{ fontSize: 8, color: C.brand, fontFamily: "Helvetica-Bold", letterSpacing: 1 }}>VITALSWATCH · SPEED REPORT</Text>
            <Text style={[s.h1, { marginTop: 6 }]}>{t(input.site.name)}</Text>
            <Text style={{ color: C.muted }}>{t(siteUrl)}</Text>
          </View>
          <Text style={{ color: C.muted, fontSize: 8 }}>{t(`Generated ${day(input.generatedAt)}`)}</Text>
        </View>

        <View style={[s.row, s.section, { gap: 10 }]}>
          <ScoreBox label="Mobile score" score={input.scores.mobile} />
          <ScoreBox label="Desktop score" score={input.scores.desktop} />
        </View>

        <View style={s.section}>
          <Text style={s.h2}>{t(`Lab metrics · ${input.strategy}`)}</Text>
          <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
            {LAB_METRICS.map((m) => {
              const v = input.lab[m];
              return (
                <View key={m} style={[s.card, { width: 160, padding: 8 }]}>
                  <Text style={s.label}>{t(`${METRICS[m].short} · ${METRICS[m].label}`)}</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", lineHeight: 1.3, color: v == null ? C.muted : RATING_COLOR[rateMetric(m, v)] }}>{t(formatMetric(m, v))}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {input.field && (
          <View style={s.section}>
            <FieldBlock field={input.field} />
          </View>
        )}

        <View style={s.section}>
          <Text style={s.h2}>{t(`Score over time · ${input.strategy}`)}</Text>
          <TrendSvg trend={input.trend} deploys={input.deploys} />
        </View>

        {input.deploys.length > 0 && (
          <View style={s.section}>
            <Text style={s.h2}>Deploys (median of 3 runs before vs after)</Text>
            <View style={s.tr}>
              <Text style={[s.th, { width: 70 }]}>Date</Text>
              <Text style={[s.th, { width: 60 }]}>Ref</Text>
              <Text style={[s.th, { flex: 1 }]}>Message</Text>
              <Text style={[s.th, { width: 70, textAlign: "right" }]}>Score</Text>
            </View>
            {input.deploys.slice(0, 8).map((dp) => {
              const delta = dp.before != null && dp.after != null ? Math.round(dp.after - dp.before) : null;
              return (
                <View key={dp.ref + dp.t} style={s.tr} wrap={false}>
                  <Text style={{ width: 70 }}>{t(day(dp.t))}</Text>
                  <Text style={{ width: 60, fontFamily: "Courier" }}>{t(dp.ref)}</Text>
                  <Text style={{ flex: 1 }}>{t(dp.message ?? "Deploy")}</Text>
                  <Text style={{ width: 70, textAlign: "right", color: delta == null ? C.muted : delta <= -5 ? C.poor : delta >= 5 ? C.good : C.text }}>
                    {dp.before == null || dp.after == null ? "-" : t(`${Math.round(dp.before)} -> ${Math.round(dp.after)}`)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        <Footer input={input} />
      </Page>

      {/* ── Page 2+: diagnostics ── */}
      {d && (
        <Page size="A4" style={s.page}>
          <Text style={s.h1}>Why it&apos;s slow</Text>
          <Text style={{ color: C.muted, marginTop: 2 }}>{t(`Latest ${input.strategy} run${d.lighthouseVersion ? `, Lighthouse ${d.lighthouseVersion}` : ""}.`)}</Text>

          {d.lcp && (
            <View style={[s.section, s.card]} wrap={false}>
              <Text style={s.h3}>Largest Contentful Paint element</Text>
              <View style={[s.row, { gap: 12 }]}>
                {d.finalScreenshot && d.screen && (
                  <View style={{ width: 90, position: "relative" }}>
                    {/* react-pdf draws this into the PDF; it is not an HTML <img>. */}
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={d.finalScreenshot} style={{ width: 90 }} />
                    {d.lcp.element?.rect && (
                      <Svg width={90} height={(90 * d.screen.height) / d.screen.width} style={{ position: "absolute", top: 0, left: 0 }}>
                        <Rect
                          x={(d.lcp.element.rect.left / d.screen.width) * 90}
                          y={(d.lcp.element.rect.top / d.screen.width) * 90}
                          width={(d.lcp.element.rect.width / d.screen.width) * 90}
                          height={(d.lcp.element.rect.height / d.screen.width) * 90}
                          stroke={C.brand}
                          strokeWidth={1.5}
                          fill="none"
                        />
                      </Svg>
                    )}
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  {d.lcp.element?.snippet && <Text style={s.code}>{t(d.lcp.element.snippet)}</Text>}
                  <View style={{ marginTop: 6 }}>
                    {d.lcp.phases.map((p) => (
                      <View key={p.key} style={[s.row, { justifyContent: "space-between" }]}>
                        <Text>{t(LCP_PHASES[p.key]?.short ?? p.label)}</Text>
                        <Text>{fmtMs(p.ms)}</Text>
                      </View>
                    ))}
                  </View>
                  {(() => {
                    const worst = [...d.lcp.phases].sort((a, b) => b.ms - a.ms)[0];
                    return worst && LCP_PHASES[worst.key] ? <Text style={{ marginTop: 6, fontSize: 8 }}>{t(`Biggest part: ${LCP_PHASES[worst.key].short.toLowerCase()}. ${LCP_PHASES[worst.key].advice}`)}</Text> : null;
                  })()}
                </View>
              </View>
            </View>
          )}

          {diff && input.baseline && (
            <View style={[s.section, s.card]} wrap={false}>
              <Text style={s.h3}>{t(`What changed ${input.baseline.label}`)}</Text>
              <Text style={{ color: C.muted, fontSize: 8 }}>{t(`Page weight ${diff.bytesDelta >= 0 ? "+" : "-"}${fmtBytes(Math.abs(diff.bytesDelta))}, requests ${diff.requestsDelta >= 0 ? "+" : "-"}${Math.abs(diff.requestsDelta)}`)}</Text>
              {isEmptyDiff(diff) ? (
                <Text style={{ marginTop: 4 }}>No new scripts, issues or third parties.</Text>
              ) : (
                <View style={{ marginTop: 4 }}>
                  {diff.newThirdParties.map((x) => (
                    <Text key={x.entity} style={{ color: C.poor }}>{t(`+ New third party ${x.entity} (${fmtBytes(x.bytes)}, ${fmtMs(x.mainThreadMs)} main thread)`)}</Text>
                  ))}
                  {diff.newIssues.map((x) => (
                    <Text key={x.id} style={{ color: C.poor }}>{t(`+ New issue: ${x.title}`)}</Text>
                  ))}
                  {diff.newFiles.slice(0, 4).map((x) => (
                    <Text key={x.url}>{t(`+ New file ${x.url}`)}</Text>
                  ))}
                  {diff.resolvedIssues.map((x) => (
                    <Text key={x.id} style={{ color: C.good }}>{t(`- Fixed: ${x.title}`)}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={s.section}>
            <Text style={s.h2}>{t(`Issues to fix (${d.issues.length})`)}</Text>
            {d.issues.map((issue, i) => {
              const fix = fixFor(issue, siteUrl, d.lcp);
              return (
                <View key={issue.id} style={[s.card, { marginBottom: 10 }]}>
                  <View style={[s.row, { justifyContent: "space-between" }]} wrap={false}>
                    <Text style={s.h3}>{t(`${i + 1}. ${issue.title}`)}</Text>
                    <Text style={{ color: C.warn, fontFamily: "Helvetica-Bold" }}>
                      {t(issue.savingsMs > 0 ? `-${fmtMs(issue.savingsMs)}` : issue.savingsBytes > 0 ? `-${fmtBytes(issue.savingsBytes)}` : (issue.displayValue ?? ""))}
                    </Text>
                  </View>
                  <Text>{t(fix.why)}</Text>
                  {issue.items.length > 0 && (
                    <View style={{ marginTop: 6 }}>
                      {issue.items.map((it, j) => (
                        <View key={j} style={[s.tr, { paddingVertical: 2 }]} wrap={false}>
                          <Text style={{ flex: 1, fontSize: 7.5 }}>{t(it.url ?? it.label ?? it.node?.selector ?? "")}</Text>
                          <Text style={{ width: 55, textAlign: "right", fontSize: 7.5 }}>{fmtBytes(it.totalBytes)}</Text>
                          <Text style={{ width: 55, textAlign: "right", fontSize: 7.5, color: C.warn }}>{it.wastedBytes ? fmtBytes(it.wastedBytes) : ""}</Text>
                          <Text style={{ width: 45, textAlign: "right", fontSize: 7.5 }}>{it.ms != null ? fmtMs(it.ms) : ""}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {fix.steps.length > 0 && (
                    <View style={{ marginTop: 6 }}>
                      {fix.steps.map((step, j) => (
                        <Text key={j}>{t(`${j + 1}. ${step}`)}</Text>
                      ))}
                    </View>
                  )}
                  {fix.code.map((c) => (
                    <View key={c.label} wrap={false}>
                      <Text style={{ marginTop: 6, fontSize: 7, color: C.muted }}>{t(c.label)}</Text>
                      <Text style={s.code}>{keepIndent(t(c.code))}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>

          {d.thirdParties.length > 0 && (
            <View style={s.section} wrap={false}>
              <Text style={s.h2}>Third-party code</Text>
              {d.thirdParties.map((x) => (
                <View key={x.entity} style={s.tr}>
                  <Text style={{ flex: 1 }}>{t(x.entity)}</Text>
                  <Text style={{ width: 70, textAlign: "right" }}>{fmtBytes(x.bytes)}</Text>
                  <Text style={{ width: 80, textAlign: "right", color: x.mainThreadMs >= 250 ? C.poor : C.text }}>{fmtMs(x.mainThreadMs)}</Text>
                </View>
              ))}
            </View>
          )}

          {d.resources.length > 0 && (
            <View style={s.section} wrap={false}>
              <Text style={s.h2}>{t(`Page weight · ${fmtBytes(d.totals.bytes)}, ${d.totals.requests} requests`)}</Text>
              {[...d.resources].sort((a, b) => b.bytes - a.bytes).map((r) => (
                <View key={r.type} style={s.tr}>
                  <Text style={{ flex: 1 }}>{t(r.label)}</Text>
                  <Text style={{ width: 60, textAlign: "right" }}>{r.requests}</Text>
                  <Text style={{ width: 70, textAlign: "right" }}>{fmtBytes(r.bytes)}</Text>
                </View>
              ))}
            </View>
          )}

          {input.reportUrl && <Text style={{ marginTop: 16, color: C.muted, fontSize: 8 }}>{t(`Live report: ${input.reportUrl}`)}</Text>}
          <Footer input={input} />
        </Page>
      )}
    </Document>
  );
}
