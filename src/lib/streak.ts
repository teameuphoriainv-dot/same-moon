import { addDays, daysBetween, nightKey } from "./dates";
import type { Book, Stats } from "./types";

/**
 * A clouded night keeps the chain alive but earns no credit.
 * Skipping one outright ends it.
 */
function chainLength(book: Book, from: string): number {
  let count = 0;
  let cursor = from;
  while (book.nights[cursor]) {
    if (book.nights[cursor].kind === "called") count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function chainStart(book: Book, from: string): string {
  let cursor = from;
  while (book.nights[addDays(cursor, -1)]) cursor = addDays(cursor, -1);
  return cursor;
}

export function computeStats(book: Book, now: Date = new Date()): Stats {
  const tonight = nightKey(now);
  const yesterday = addDays(tonight, -1);
  const loggedTonight = Boolean(book.nights[tonight]);

  let current = 0;
  let pendingTonight = false;
  if (loggedTonight) {
    current = chainLength(book, tonight);
  } else if (book.nights[yesterday]) {
    current = chainLength(book, yesterday);
    pendingTonight = true;
  }

  const keys = Object.keys(book.nights).sort();
  let longest = 0;
  const seen = new Set<string>();
  for (const key of keys) {
    const start = chainStart(book, key);
    if (seen.has(start)) continue;
    seen.add(start);
    let end = start;
    while (book.nights[addDays(end, 1)]) end = addDays(end, 1);
    longest = Math.max(longest, chainLength(book, end));
  }
  longest = Math.max(longest, current);

  const values = Object.values(book.nights);
  const startedOn = book.startedOn || keys[0] || tonight;

  return {
    current,
    longest,
    totalCalled: values.filter((n) => n.kind === "called").length,
    cloudedUsed: values.filter((n) => n.kind === "clouded").length,
    daysSinceStart: Math.max(0, daysBetween(startedOn, tonight)) + 1,
    loggedTonight,
    pendingTonight,
  };
}

/** Clouded nights are rationed: one earned per 14 called nights, 3 max in the bank. */
export const CLOUDED_EARNED_EVERY = 14;
export const CLOUDED_MAX_BANKED = 3;

export function cloudedAvailable(stats: Stats): number {
  const earned = Math.floor(stats.totalCalled / CLOUDED_EARNED_EVERY);
  return Math.max(0, Math.min(CLOUDED_MAX_BANKED, earned - stats.cloudedUsed));
}
