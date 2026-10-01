/**
 * The parts of the storybook that are plain arithmetic: what order the pages
 * go in, which stickers land where, and what is safe to draw. No React and no
 * database in here, so all of it can be tested directly.
 */

import type { Scrap } from "./types";

export const CHARMS = ["hearts", "stars", "moons", "flowers"] as const;
export type Charm = (typeof CHARMS)[number];

export const CHARM_NAMES: Record<Charm, string> = {
  hearts: "Hearts",
  stars: "Stars",
  moons: "Moons",
  flowers: "Flowers",
};

/** Anything unrecognised falls back to hearts, so an old row still draws. */
export function charmOf(value: string): Charm {
  return (CHARMS as readonly string[]).includes(value) ? (value as Charm) : "hearts";
}

/**
 * The order the book is read in: by the day each page is from, so an old photo
 * added today still lands where it belongs in the story. Pages from the same
 * day stay in the order they were added.
 */
export function inOrder(pages: Scrap[]): Scrap[] {
  return [...pages].sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    return a.id - b.id;
  });
}

function rng(seed: number): () => number {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type Slot = "tl" | "tr" | "bl" | "br";
const SLOTS: Slot[] = ["tl", "tr", "bl", "br"];
const TILTS = [-1.6, -0.9, 0, 0.9, 1.6];
const SIZES = [30, 36, 42];

export interface Placed {
  slot: Slot;
  /** Which sticker of the page's set. */
  which: number;
  /** Width in CSS pixels. */
  size: number;
}

export interface Decor {
  /** How far the photo is turned, in degrees. */
  tilt: number;
  stickers: Placed[];
}

/**
 * How one page is dressed. It depends on nothing but the page's id, so a page
 * looks the same on both phones and the same every time it is opened.
 */
export function decorFor(id: number): Decor {
  const rand = rng(id);
  const tilt = TILTS[Math.floor(rand() * TILTS.length)];
  // Three of the four corners, so every page has one corner left quiet.
  const skip = Math.floor(rand() * SLOTS.length);
  const stickers = SLOTS.filter((_, i) => i !== skip).map((slot) => ({
    slot,
    which: Math.floor(rand() * 3),
    size: SIZES[Math.floor(rand() * SIZES.length)],
  }));
  return { tilt, stickers };
}

/**
 * Both of these come out of a database that anyone who knows its name can
 * write to, so neither is trusted as it arrives.
 */
export function safePhoto(url: string): string | null {
  if (!/^https:\/\/[^\s"'<>()]+$/.test(url)) return null;
  return url;
}

export function safeThumb(thumb: string): string | null {
  if (thumb.length > 16 * 1024) return null;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(thumb) ? thumb : null;
}

/** Split a drawing into rows. Returns nothing if it is not a square of inks. */
export function artRows(art: string): string[] | null {
  const side = Math.round(Math.sqrt(art.length));
  if (side < 1 || side * side !== art.length || !/^[a-z.]+$/.test(art)) return null;
  const rows: string[] = [];
  for (let y = 0; y < side; y++) rows.push(art.slice(y * side, (y + 1) * side));
  return rows;
}

/** One plant per page, for the garden under the book. */
export function plantFor(id: number): { kind: "flower" | "sprout" | "tall"; hue: number } {
  const rand = rng(id * 7 + 3);
  const roll = rand();
  return {
    kind: roll > 0.72 ? "sprout" : roll > 0.36 ? "flower" : "tall",
    hue: Math.floor(rand() * 4),
  };
}
