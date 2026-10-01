/**
 * A "night" is not a calendar day. A call at 1am belongs to the night before.
 * Everything before this hour rolls back one day.
 */
export const ROLLOVER_HOUR = 5;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar key, "YYYY-MM-DD". Deliberately not UTC. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Which night a given moment belongs to, honoring the 5am rollover. */
export function nightKey(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = parseDay(b).getTime() - parseDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function isFuture(key: string): boolean {
  return daysBetween(nightKey(), key) > 0;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function longDate(key: string): string {
  const d = parseDay(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function shortDate(key: string): string {
  const d = parseDay(key);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** Every day key in a month, plus leading blanks so the grid starts on Sunday. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  const last = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= last; i++) cells.push(dayKey(new Date(year, month, i)));
  return cells;
}
