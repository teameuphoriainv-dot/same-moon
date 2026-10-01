/**
 * Whether somebody counts as here, and how to say so. Plain functions with
 * the clock passed in, kept apart from the hook so they can be tested.
 */

import { ago } from "./ago";
import type { PulseRow } from "./types";

/** Three missed check-ins. Past this they have left, whatever the flag says. */
export const QUIET_MS = 80_000;

export function isHere(row: PulseRow | null, now: number): boolean {
  return Boolean(row && row.active && now - row.at < QUIET_MS);
}

/** "Active now", "Last active 5m ago", or "" when they have never been here. */
export function presenceLabel(row: PulseRow | null, now: number): string {
  if (!row) return "";
  return isHere(row, now) ? "Active now" : `Last active ${ago(row.at, now)}`;
}
