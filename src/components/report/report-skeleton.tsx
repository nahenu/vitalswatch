export function ReportSkeleton() {
  return (
    <div role="status" className="animate-pulse space-y-4">
      <span className="sr-only">Loading report…</span>
      <div className="h-4 w-20 rounded bg-muted" />
      <div className="h-9 w-64 rounded bg-muted" />
      <div className="grid gap-4 pt-4 lg:grid-cols-[5fr_7fr]">
        <div className="h-64 rounded-2xl bg-card" />
        <div className="h-64 rounded-2xl bg-card" />
      </div>
      <div className="h-[26rem] rounded-2xl bg-card" />
    </div>
  );
}
