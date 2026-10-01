/**
 * The colours on the shared canvas.
 *
 * A drawing is stored as one letter per pixel, and these are the letters. The
 * server accepts any lowercase letter, so a colour can be added here without
 * touching it. Never reuse a letter for a different colour: every drawing
 * already pinned in the storybook would change with it.
 */

import type { Palette } from "./palette";

export interface Ink {
  key: string;
  hex: string;
  name: string;
}

export const INKS: Ink[] = [
  { key: "k", hex: "#1c1b26", name: "Ink" },
  { key: "g", hex: "#8d93a3", name: "Grey" },
  { key: "w", hex: "#ffffff", name: "White" },
  { key: "r", hex: "#d64c4c", name: "Red" },
  { key: "p", hex: "#ec8fae", name: "Pink" },
  { key: "o", hex: "#ec8f3a", name: "Orange" },
  { key: "y", hex: "#f4cc4d", name: "Yellow" },
  { key: "l", hex: "#93d47c", name: "Lime" },
  { key: "t", hex: "#3e9160", name: "Green" },
  { key: "c", hex: "#55bfc6", name: "Teal" },
  { key: "s", hex: "#9ed0ec", name: "Sky" },
  { key: "b", hex: "#4577d1", name: "Blue" },
  { key: "v", hex: "#8b62c9", name: "Violet" },
  { key: "e", hex: "#7b4f2e", name: "Brown" },
  { key: "n", hex: "#e4b78f", name: "Sand" },
  { key: "m", hex: "#d8a94b", name: "Brass" },
];

/** The paper a drawing sits on. Bare canvas shows this. */
export const PAPER = "#f7f0df";

export const DOODLE_INK: Palette = Object.fromEntries(INKS.map((i) => [i.key, i.hex]));
