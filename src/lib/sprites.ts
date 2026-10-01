/**
 * The birthday sprite sheet. Plain data, no React, so the shapes can be
 * asserted in tests: a ragged row or a character with no palette entry is a
 * hole in the art, and neither is visible from reading the strings.
 */

export type Palette = Record<string, string>;



/** Brass, rose and moonlight only, so the decorations stay inside the palette. */
export const PARTY: Palette = {
  k: "#05070d",
  b: "#d8a94b",
  B: "#f2d287",
  z: "#8c6a25",
  r: "#c97b84",
  R: "#e3a3aa",
  q: "#8e4f58",
  m: "#f4e9d4",
  w: "#fffbf0",
  g: "#e2d2ae",
  s: "#7f8db5",
};

/** 11 x 15. Used for the balloons that drift up the page. */
export const BALLOON: string[] = [
  "...kkkkk...",
  "..kbbbbbk..",
  ".kbbbbbbbk.",
  ".kbbwbbbbk.",
  "kbbbwbbbbbk",
  "kbbbbbbbbbk",
  "kbbbbbbbbbk",
  ".kbbbbbbbk.",
  ".kbbbbbbbk.",
  "..kbbbbbk..",
  "...kbbbk...",
  "....kbk....",
  ".....m.....",
  "....m......",
  ".....m.....",
];

/** 9 x 11. Sits on top of the moon in the hero. */
export const HAT: string[] = [
  "....B....",
  "....k....",
  "...krk...",
  "...krk...",
  "..kbrbk..",
  "..kbrbk..",
  ".kbrbrbk.",
  ".kbrbrbk.",
  "kbrbrbrbk",
  "kkkkkkkkk",
  ".........",
];

/** 13 x 10. The little cake used as a marker and a button glyph. */
export const CAKE_MINI: string[] = [
  ".....B.......",
  ".....m.......",
  "..k.k.k.k.k..",
  "..kkkkkkkkk..",
  ".kRRRRRRRRRk.",
  ".kRmRRRmRRRk.",
  ".kbbbbbbbbbk.",
  ".kbmbbbmbbbk.",
  ".kbbbbbbbbbk.",
  "..kkkkkkkkk..",
];

/** 27 x 16. The hero cake on the birthday card. Candles are drawn separately. */
export const CAKE: string[] = [
  "...........................",
  "...kkkkkkkkkkkkkkkkkkkkk...",
  "..kRRRRRRRRRRRRRRRRRRRRRk..",
  "..kRmRRRRmRRRRmRRRRmRRRRk..",
  "..kRRRRRRRRRRRRRRRRRRRRRk..",
  "..kRqRRqRRqRRqRRqRRqRRqRk..",
  ".kRRRRRRRRRRRRRRRRRRRRRRRk.",
  ".kbbbbbbbbbbbbbbbbbbbbbbbk.",
  ".kbmbbbbmbbbbmbbbbmbbbbmbk.",
  ".kbbbbbbbbbbbbbbbbbbbbbbbk.",
  ".kbbmbbbbmbbbbmbbbbmbbbbbk.",
  ".kbbbbbbbbbbbbbbbbbbbbbbbk.",
  ".kzzzzzzzzzzzzzzzzzzzzzzzk.",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkk",
  "kgggggggggggggggggggggggggk",
  ".kkkkkkkkkkkkkkkkkkkkkkkkk.",
];

/** 5 x 12, flame included. Rendered once per candle at its own x offset. */
export const CANDLE_LIT: string[] = [
  "..B..",
  ".BBB.",
  ".Bwb.",
  "..b..",
  "..k..",
  ".krk.",
  ".kmk.",
  ".krk.",
  ".kmk.",
  ".krk.",
  ".kmk.",
  ".kkk.",
];

/** Same candle with the flame snuffed and the wick left smoking. */
export const CANDLE_OUT: string[] = [
  ".....",
  ".....",
  ".....",
  ".....",
  "..k..",
  ".kqk.",
  ".kgk.",
  ".kqk.",
  ".kgk.",
  ".kqk.",
  ".kgk.",
  ".kkk.",
];

/** 9 x 9. Confetti-ish gift box, used in the bunting row. */
export const GIFT: string[] = [
  "...kbk...",
  "..kbBbk..",
  "kkkkbkkkk",
  "kRRRbRRRk",
  "kkkkbkkkk",
  "kRRRbRRRk",
  "kRRRbRRRk",
  "kRRRbRRRk",
  "kkkkkkkkk",
];

/** 11 x 11. A stepped pennant. Its fill character is `c` so callers swap the colour. */
export const FLAG: string[] = [
  "kkkkkkkkkkk",
  "kccccccccck",
  ".kccccccck.",
  ".kccccccck.",
  "..kccccck..",
  "..kccccck..",
  "...kccck...",
  "...kccck...",
  "....kck....",
  "....kck....",
  ".....k.....",
];

/** Every sprite in the sheet, so a test can walk them all. */
export const SHEET: Record<string, string[]> = {
  BALLOON,
  HAT,
  CAKE_MINI,
  CAKE,
  CANDLE_LIT,
  CANDLE_OUT,
  GIFT,
  FLAG,
};
