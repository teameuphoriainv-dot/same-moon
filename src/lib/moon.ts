import { parseDay } from "./dates";

/** Mean synodic month, in days. */
const SYNODIC = 29.530588853;
/** Julian date of the new moon on 2000-01-06 18:14 UTC. */
const KNOWN_NEW_MOON_JD = 2451550.1;

function julianDate(d: Date): number {
  return d.getTime() / 86_400_000 + 2440587.5;
}

/**
 * Where tonight sits in the lunar cycle.
 * 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
 */
export function moonPhase(d: Date = new Date()): number {
  const age = (julianDate(d) - KNOWN_NEW_MOON_JD) / SYNODIC;
  return ((age % 1) + 1) % 1;
}

export function moonPhaseForDay(key: string): number {
  return moonPhase(parseDay(key));
}

/** Fraction of the disc that is lit, 0 to 1. */
export function illumination(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

export function phaseName(phase: number): string {
  const lit = illumination(phase);
  const waxing = phase < 0.5;
  if (lit < 0.02) return "New Moon";
  if (lit > 0.98) return "Full Moon";
  if (Math.abs(lit - 0.5) < 0.04) return waxing ? "First Quarter" : "Last Quarter";
  if (lit < 0.5) return waxing ? "Waxing Crescent" : "Waning Crescent";
  return waxing ? "Waxing Gibbous" : "Waning Gibbous";
}

/**
 * SVG path for the lit portion of a moon of radius R, centered on the origin.
 * Built from the outer limb plus the terminator ellipse.
 */
export function litPath(R: number, phase: number): string {
  const x = Math.cos(2 * Math.PI * phase);
  const rx = Math.abs(x) * R;
  const waxing = phase < 0.5;
  const outerSweep = waxing ? 1 : 0;
  const termSweep = waxing ? (x > 0 ? 0 : 1) : (x > 0 ? 1 : 0);
  return [
    `M 0 ${-R}`,
    `A ${R} ${R} 0 0 ${outerSweep} 0 ${R}`,
    `A ${rx.toFixed(4)} ${R} 0 0 ${termSweep} 0 ${-R}`,
    "Z",
  ].join(" ");
}
