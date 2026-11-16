const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(date: Date | number, now = Date.now()): string {
  const diff = now - new Date(date).getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDay(date);
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** "16 Nov". UTC, so server and browser render the same text. */
export const formatDay = (d: Date | number) => dayFmt.format(new Date(d));
/** "16 Nov, 02:30 UTC". */
export const formatDateTime = (d: Date | number) => `${dateTimeFmt.format(new Date(d))} UTC`;
