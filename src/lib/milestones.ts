export interface Milestone {
  n: number;
  name: string;
  note: string;
}

export const MILESTONES: Milestone[] = [
  { n: 3, name: "Waxing Crescent", note: "Three nights. It has started." },
  { n: 7, name: "First Quarter", note: "A week without missing one." },
  { n: 14, name: "Full Moon", note: "Two weeks lit all the way through." },
  { n: 21, name: "Last Quarter", note: "Three weeks. This is a habit now." },
  { n: 30, name: "One Moon", note: "A whole lunar month of nights." },
  { n: 50, name: "Fifty Nights", note: "Fifty separate times you picked up." },
  { n: 75, name: "Seventy Five", note: "Most things do not last this long." },
  { n: 100, name: "Hundred Nights", note: "The big one." },
  { n: 150, name: "Five Moons", note: "Still going." },
  { n: 200, name: "Two Hundred", note: "Two hundred nights, same moon." },
  { n: 300, name: "Ten Moons", note: "Almost a year of calls." },
  { n: 365, name: "One Orbit", note: "A full trip around the sun together." },
  { n: 500, name: "Five Hundred", note: "Absurd. Wonderful." },
  { n: 730, name: "Two Orbits", note: "Twice around." },
  { n: 1000, name: "A Thousand Nights", note: "A thousand." },
];

export function reached(current: number): Milestone[] {
  return MILESTONES.filter((m) => current >= m.n);
}

export function nextMilestone(current: number): Milestone | null {
  return MILESTONES.find((m) => m.n > current) ?? null;
}

export function justHit(current: number): Milestone | null {
  return MILESTONES.find((m) => m.n === current) ?? null;
}

/** Progress from the last milestone toward the next, 0 to 1. */
export function progressToNext(current: number): number {
  const next = nextMilestone(current);
  if (!next) return 1;
  const prev = [...MILESTONES].reverse().find((m) => m.n <= current)?.n ?? 0;
  return (current - prev) / (next.n - prev);
}
