/**
 * The sticker sheet as the tray shows it: which sprites, in what order, in
 * what colours, called what. The sprites themselves live in art/stickers.ts.
 */

import { INK, type Palette } from "@/lib/art/palette";
import { BLOOMS, STICKER_SHEET } from "@/lib/art/stickers";
import type { TapeTint } from "@/lib/layout";

/** Tray order: the ones that get used most come first. */
export const SHEET_ORDER = [
  "HEART",
  "HEART_SMALL",
  "LIPS",
  "BOW",
  "STAR",
  "SPARKLE",
  "SUN",
  "MOON",
  "CLOUD",
  "FLOWER",
  "TALL",
  "SPROUT",
  "CHERRY",
  "BUTTERFLY",
  "MUSIC",
  "LETTER",
].filter((k) => k in STICKER_SHEET);

export const SHEET_NAMES: Record<string, string> = {
  HEART: "A heart",
  HEART_SMALL: "A small heart",
  LIPS: "Lips",
  BOW: "A bow",
  STAR: "A star",
  SPARKLE: "A sparkle",
  SUN: "The sun",
  MOON: "The moon",
  CLOUD: "A cloud",
  FLOWER: "A flower",
  TALL: "A tall flower",
  SPROUT: "A sprout",
  CHERRY: "Cherries",
  BUTTERFLY: "A butterfly",
  MUSIC: "A note of music",
  LETTER: "A letter",
};

const INKS: Record<string, Palette> = {
  SPARKLE: { ...INK, b: INK.r, B: INK.R },
  TALL: BLOOMS[2],
  MUSIC: { ...INK, k: "#2a2118" },
};

/** The colours a sheet sprite is drawn in on paper. */
export function inkFor(key: string): Palette {
  return INKS[key] ?? INK;
}

/** Washi tape, seen through to the paper. */
export const TAPE_COLOURS: Record<TapeTint, string> = {
  rose: "rgba(201, 123, 132, 0.72)",
  brass: "rgba(216, 169, 75, 0.72)",
  sky: "rgba(127, 141, 181, 0.72)",
  leaf: "rgba(122, 176, 98, 0.72)",
  plain: "rgba(246, 238, 216, 0.78)",
};

export const TAPE_NAMES: Record<TapeTint, string> = {
  rose: "Rose tape",
  brass: "Brass tape",
  sky: "Sky tape",
  leaf: "Leaf tape",
  plain: "Plain tape",
};

/** Torn ends: a run of square teeth, so the edge is stepped rather than blurred. */
function zigzag(): string {
  const teeth = 5;
  const depth = 6;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const y = (i / (teeth * 2)) * 100;
    const inset = i % 2 === 0 ? 0 : depth;
    left.push(`${inset}% ${y}%`);
    right.push(`${100 - inset}% ${100 - y}%`);
  }
  return `polygon(${[...left, ...right].join(", ")})`;
}

export const TAPE_CLIP = zigzag();

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A torn-paper outline for a scrap of text. Seeded by the item's id, so the
 * same scrap tears the same way every time it is drawn, on either phone.
 */
export function tornClip(seed: string): string {
  let h = hash(seed);
  const next = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const jitter = () => Math.round(next() * 3) * 1.4;
  const top: string[] = [];
  const bottom: string[] = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100;
    top.push(`${x}% ${jitter()}%`);
    bottom.push(`${100 - x}% ${100 - jitter()}%`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
}
