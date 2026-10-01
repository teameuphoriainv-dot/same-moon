/**
 * Times, said the way a person would say them.
 *
 * Plain functions with the clock passed in, so they can be tested without
 * waiting for anything.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "just now", "5m ago", "3h ago", "yesterday", "4d ago", "Sep 20". */
export function ago(then: number, now: number): string {
  const gap = Math.max(0, now - then);
  if (gap < MINUTE) return "just now";
  if (gap < HOUR) return `${Math.floor(gap / MINUTE)}m ago`;
  if (gap < DAY) return `${Math.floor(gap / HOUR)}h ago`;
  if (gap < 2 * DAY) return "yesterday";
  if (gap < 7 * DAY) return `${Math.floor(gap / DAY)}d ago`;
  const d = new Date(then);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const day = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return sameYear ? day : `${day}, ${d.getFullYear()}`;
}

/** How long something has run, as "4:07" or "1:02:45". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** How long a call ran, in words: "under a minute", "12 minutes", "1 hour 5 minutes". */
export function spell(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE);
  if (minutes < 1) return "under a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "1 hour" : `${h} hours`;
  const mins = m === 1 ? "1 minute" : `${m} minutes`;
  if (h === 0) return mins;
  return m === 0 ? hours : `${hours} ${mins}`;
}
