/**
 * The stickers that dress the pages of the storybook, and the plants in the
 * garden under it. Drawn against INK. These are outlined in `k`, which works
 * here because a page is pale paper, not the night sky.
 */

import { INK, type Palette } from "./palette";

export interface Sticker {
  rows: string[];
  palette: Palette;
}

const HEART: string[] = [
  "..kk...kk..",
  ".krrk.krrk.",
  "krRRrkrrrrk",
  "krRrrrrrrrk",
  "krrrrrrrrrk",
  ".krrrrrrrk.",
  "..krrrrrk..",
  "...krrrk...",
  "....krk....",
  ".....k.....",
];

const HEART_SMALL: string[] = [
  ".rr.rr.",
  "rRrrrrr",
  "rrrrrrr",
  ".rrrrr.",
  "..rrr..",
  "...r...",
];

const STAR: string[] = [
  ".....k.....",
  "....kBk....",
  "....kBk....",
  "kkkkBBBkkkk",
  "kBBBBBBBBBk",
  ".kBBBbBBBk.",
  "..kBBbBBk..",
  "..kBbBbBk..",
  ".kBBk.kBBk.",
  ".kBk...kBk.",
  ".kk.....kk.",
];

const SPARKLE: string[] = [
  "...b...",
  "...b...",
  "..bBb..",
  "bbBwBbb",
  "..bBb..",
  "...b...",
  "...b...",
];

const MOON: string[] = [
  "...kkkk...",
  "..kmmmmk..",
  ".kmmGkk...",
  "kmmGk.....",
  "kmmGk.....",
  "kmmGk.....",
  "kmmmGk....",
  ".kmmmGkkk.",
  "..kmmmmmk.",
  "...kkkkk..",
];

const CLOUD: string[] = [
  "....kkkk....",
  "..kkwwwwkk..",
  ".kwwwwwwwwk.",
  "kwwwwwwwwwwk",
  "kSwwwwwwwwSk",
  ".kSSSSSSSSk.",
  "..kkkkkkkk..",
];

/** Petals are `r` and `R`, the eye is `B`, so a palette swap changes the flower. */
const FLOWER: string[] = [
  "..rr.rr..",
  ".rRRrRRr.",
  ".rRRBRRr.",
  "..rBBBr..",
  ".rRRBRRr.",
  ".rRRrRRr.",
  "..rr.rr..",
  "....t....",
  "..l.t....",
  "..llt.l..",
  "...ltll..",
  "....t....",
];

const TALL: string[] = [
  "...r...",
  "..rRr..",
  ".rRBRr.",
  "..rRr..",
  "...r...",
  "...t...",
  "...t.l.",
  ".l.tll.",
  ".lltl..",
  "..lt...",
  "...t...",
  "...t...",
  "...t...",
];

const SPROUT: string[] = [
  ".l...l.",
  "lLl.lLl",
  ".ll.ll.",
  "..ltl..",
  "...t...",
  "...t...",
];

/** Lips, for sealing a page. Held down, they grow; let go, they print. */
const LIPS: string[] = [
  "..qq.....qq..",
  ".qrrq...qrrq.",
  "qrRrrqqqrrRrq",
  "qrrrrrrrrrrrq",
  ".qrrrrrrrrrq.",
  "..qrrrrrrrq..",
  "...qrrrrrq...",
  ".....qqq.....",
];

/** The print the lips leave: the same shape, open in the middle like lipstick. */
const KISS_MARK: string[] = [
  "..qr.....rq..",
  ".qrrq...qrrq.",
  "qr.rrq.qrr.rq",
  "qrr.rrrrr.rrq",
  ".qrrr.r.rrrq.",
  "..qrrrrrrrq..",
  "...qr.r.rq...",
  ".....qqq.....",
];

const BOW: string[] = [
  "rr.......rr",
  "rRr.....rRr",
  "rRRr.r.rRRr",
  ".rRRrRrRRr.",
  "..rRRrRRr..",
  ".rRRrRrRRr.",
  "rRRr.r.rRRr",
  "rRr..r..rRr",
  "rr...r...rr",
];

const BUTTERFLY: string[] = [
  ".pp.....pp.",
  "pPPp.k.pPPp",
  "pPPPpkpPPPp",
  "pPpPpkpPpPp",
  ".pPPpkpPPp.",
  "..ppPkPpp..",
  ".pPPpkpPPp.",
  ".pPppkppPp.",
  "..pp.k.pp..",
];

const SUN: string[] = [
  "....b.b....",
  ".b..bBb..b.",
  "..bBBBBBb..",
  "..BBBwBBB..",
  "bbBBwwwBBbb",
  "bBBBwwwBBBb",
  "bbBBwwwBBbb",
  "..BBBwBBB..",
  "..bBBBBBb..",
  ".b..bBb..b.",
  "....b.b....",
];

const MUSIC: string[] = [
  "...kkkkk",
  "...kkkkk",
  "...kk..k",
  "...k...k",
  "...k...k",
  ".kkk.kkk",
  "kkkk.kkk",
  ".kk...k.",
];

const CHERRY: string[] = [
  ".....tt....",
  "....t..t...",
  "...t....t..",
  "..t......t.",
  ".qq.....qq.",
  "qRrq...qRrq",
  "qrrq...qrrq",
  ".qq.....qq.",
];

const LETTER: string[] = [
  "kkkkkkkkkkkkk",
  "kwwwwwwwwwwwk",
  "kwkwwwwwwwkwk",
  "kwwkwwwwwkwwk",
  "kwwwkwwwkwwwk",
  "kwwwwkrkwwwwk",
  "kwwwwwrwwwwwk",
  "kwwwwwwwwwwwk",
  "kkkkkkkkkkkkk",
];

/** The four colours a flower can come in. */
export const BLOOMS: Palette[] = [
  INK,
  { ...INK, r: INK.b, R: INK.B, B: INK.w },
  { ...INK, r: INK.p, R: INK.P, B: INK.B },
  { ...INK, r: INK.u, R: INK.U, B: INK.B },
];

const ROSE_SPARKLE: Palette = { ...INK, b: INK.r, B: INK.R };

export const STICKERS: Record<string, Sticker[]> = {
  hearts: [
    { rows: HEART, palette: INK },
    { rows: HEART_SMALL, palette: INK },
    { rows: SPARKLE, palette: ROSE_SPARKLE },
  ],
  stars: [
    { rows: STAR, palette: INK },
    { rows: SPARKLE, palette: INK },
    { rows: STAR, palette: { ...INK, B: INK.m, b: INK.G } },
  ],
  moons: [
    { rows: MOON, palette: INK },
    { rows: CLOUD, palette: INK },
    { rows: SPARKLE, palette: { ...INK, b: INK.s, B: INK.S } },
  ],
  flowers: [
    { rows: FLOWER, palette: BLOOMS[0] },
    { rows: FLOWER, palette: BLOOMS[2] },
    { rows: SPROUT, palette: INK },
  ],
};

/** The strip of tape holding a photo down, tinted to match the stickers. */
export const TAPE: Record<string, string> = {
  hearts: "rgba(201, 123, 132, 0.74)",
  stars: "rgba(216, 169, 75, 0.74)",
  moons: "rgba(127, 141, 181, 0.74)",
  flowers: "rgba(122, 176, 98, 0.74)",
};

export const PLANTS = { flower: FLOWER, tall: TALL, sprout: SPROUT };

export const STICKER_SHEET: Record<string, string[]> = {
  HEART,
  HEART_SMALL,
  STAR,
  SPARKLE,
  MOON,
  CLOUD,
  FLOWER,
  TALL,
  SPROUT,
  LIPS,
  BOW,
  BUTTERFLY,
  SUN,
  MUSIC,
  CHERRY,
  LETTER,
};

/** Not on the sheet: the print only appears once a page is sealed. */
export const KISS_PRINT = KISS_MARK;
