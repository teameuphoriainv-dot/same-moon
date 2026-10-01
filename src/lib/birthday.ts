import { dayKey, nightKey, parseDay } from "./dates";

export interface Birthday {
  /** 1-indexed, so it reads like a date. */
  month: number;
  day: number;
}

/** "MM-DD" to a birthday, or null if it is not a real one. */
export function parseBirthday(raw: string | undefined): Birthday | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw?.trim() ?? "");
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { month, day } : null;
}

/**
 * Whose birthday the site dresses up for. Off unless the couple sets
 * NEXT_PUBLIC_BIRTHDAY="MM-DD" and NEXT_PUBLIC_BIRTHDAY_NAME when they deploy.
 * Everything birthday-shaped on the site keys off this one value.
 */
export const BIRTHDAY: Birthday | null = parseBirthday(process.env.NEXT_PUBLIC_BIRTHDAY);

export const HONOREE = process.env.NEXT_PUBLIC_BIRTHDAY_NAME?.trim() ?? "";

/**
 * Deliberately keyed on `nightKey`, not the calendar date, so the decorations
 * stay up through the small hours of the night of the birthday and come down
 * at the same 5am rollover as everything else on the site.
 */
export function isBirthday(key: string = nightKey(), on: Birthday | null = BIRTHDAY): boolean {
  if (!on) return false;
  const d = parseDay(key);
  return d.getMonth() + 1 === on.month && d.getDate() === on.day;
}

/**
 * The birthday *right now*, as a day key, or null if today is not it.
 *
 * Accepts either reading of the clock on purpose. The site's nights roll over
 * at 5am, so from midnight until 5am on the 20th `nightKey` still says the
 * 19th, and keying the decor on that alone would leave the first five hours of
 * her actual birthday completely undecorated. Taking either the night or the
 * calendar day means the decor is up from the first minute of the 20th and
 * still up in the small hours after it, which is the behaviour anyone would
 * expect from a birthday and the one the rollover would otherwise break.
 */
export function birthdayNow(now: Date = new Date(), on: Birthday | null = BIRTHDAY): string | null {
  for (const key of [nightKey(now), dayKey(now)]) {
    if (isBirthday(key, on)) return key;
  }
  return null;
}

/** The birthday in a given year, as a day key. */
export function birthdayKey(year: number, on: Birthday): string {
  const m = String(on.month).padStart(2, "0");
  const d = String(on.day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * One candle per line. She taps a candle out and the line underneath it shows.
 * Edit these freely, the card lays out from whatever is in this array.
 */
export interface Candle {
  /** Shown in small caps above the line. */
  title: string;
  line: string;
}

export const CANDLES: Candle[] = [
  { title: "One", line: "For every night you picked up." },
  { title: "Two", line: "For every night you called back." },
  { title: "Three", line: "For the nights that were only a minute and still counted." },
  { title: "Four", line: "Happy birthday. Look up tonight." },
];

/** The letter under the cake. One string per paragraph. */
export const LETTER: string[] = [
  "Happy birthday.",
  "Every square on this page is a night one of you called the other. Today gets a cake.",
  "Wherever you are, look up. Same moon.",
];

export const SIGNED = process.env.NEXT_PUBLIC_BIRTHDAY_FROM?.trim() ?? "";
