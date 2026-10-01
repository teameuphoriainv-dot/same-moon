/**
 * What the board games are played with.
 *
 * Each of them keeps the same piece in every game: the moon plays rose and
 * the star plays brass. Who moves first changes from
 * match to match, but which piece is whose never does, so a glance at the
 * board is enough to see who holds what.
 */

import { BALLOON, CAKE_MINI, GIFT, PARTY } from "../sprites";
import { INK, type Palette } from "./palette";
import { STICKER_SHEET } from "./stickers";

/** Same key as auth.ts; kept local so the tests can compile this file alone. */
const MOON = "Moon";

export interface Art {
  rows: string[];
  palette: Palette;
}

const MOON_PIECE: string[] = [
  "....mmmm....",
  "..mmmmmmmm..",
  ".mmmmwwmmmm.",
  ".mmGmwwmmmm.",
  "mmGGmmmmmGmm",
  "mmmmmmmmGGmm",
  "mmmmmmmmmmmm",
  "mmmGmmmmmmmG",
  ".mGGmmmmGmG.",
  ".mmmmmmmmGG.",
  "..mmmmmGGG..",
  "....GGGG....",
];

const STAR_PIECE: string[] = [
  ".....BB.....",
  ".....BB.....",
  "....BwBB....",
  "....BwBB....",
  "BBBBBBBBBBBb",
  ".BwBBBBBBBb.",
  "..BBBBBBBb..",
  "...BBBBBb...",
  "..BBBBBBbb..",
  "..BBB..Bbb..",
  ".BBB....bbb.",
  ".BB......bb.",
];

/** `x` is the body, `h` the side the light is on, `s` the side it is not. */
export const DISC: string[] = [
  "...hhhh...",
  "..hhxxxx..",
  ".hhxxxxxx.",
  "hhxxxxxxxs",
  "hxxxxxxxxs",
  "hxxxxxxxxs",
  "hxxxxxxxss",
  ".xxxxxxss.",
  "..xxxxss..",
  "...ssss...",
];

const ROSE_DISC: Palette = { x: INK.r, h: INK.R, s: INK.q };
const BRASS_DISC: Palette = { x: INK.b, h: INK.B, s: INK.z };

export function pieceFor(name: string): Art {
  return { rows: name === MOON ? MOON_PIECE : STAR_PIECE, palette: INK };
}

export function discFor(name: string): Palette {
  return name === MOON ? ROSE_DISC : BRASS_DISC;
}

/** What each of them is called on the board, for "You are stars". */
export function pieceName(name: string): string {
  return name === MOON ? "moons" : "stars";
}

/** The eight faces in a game of pairs, keyed by the letter the server deals. */
export const FACES: Record<string, Art> = {
  A: { rows: STICKER_SHEET.HEART, palette: INK },
  B: { rows: STICKER_SHEET.STAR, palette: INK },
  C: { rows: STICKER_SHEET.MOON, palette: INK },
  D: { rows: STICKER_SHEET.CLOUD, palette: INK },
  E: { rows: STICKER_SHEET.FLOWER, palette: INK },
  F: { rows: BALLOON, palette: { ...PARTY, b: INK.u, w: INK.U } },
  G: { rows: CAKE_MINI, palette: PARTY },
  H: { rows: GIFT, palette: PARTY },
};

/** Two cards, one over the other. The glyph for the talking games. */
export const CARDS: string[] = [
  "....ssssssss",
  "....ssssssss",
  "xxxxxxxxssss",
  "xxxxxxxxssss",
  "xxrrxrrxssss",
  "xrrrrrrxssss",
  "xrrrrrrxssss",
  "xxrrrrxxssss",
  "xxxrrxxxssss",
  "xxxxxxxxssss",
  "xxxxxxxx....",
  "xxxxxxxx....",
];

export const PIECE_SHEET: Record<string, string[]> = {
  MOON_PIECE,
  STAR_PIECE,
  DISC,
  CARDS,
};
