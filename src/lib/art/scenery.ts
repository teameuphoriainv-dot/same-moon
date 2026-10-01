/**
 * What the landscape is built from. The two scenes draw these onto a canvas
 * one pixel at a time, at whatever width the screen turns out to be.
 *
 * Scenery has its own small palette rather than using INK, because at night
 * everything is a shade of the same blue and the differences that matter are
 * a few points of lightness. Nothing is outlined in near-black: on this canvas
 * a shape is carried by the step between its fill and the hill behind it.
 */

import type { Palette } from "./palette";

export const NIGHT: Palette = {
  /** The house. */
  W: "#27314d", // wall, lit side
  V: "#1b2338", // wall, shaded
  e: "#141a2c", // wall, in the shadow of the eave
  F: "#11172a", // footing
  S: "#3a4462", // doorstep
  r: "#a4626c", // roof, top edge
  q: "#6f3f48", // roof
  Q: "#52303a", // roof, shaded
  s: "#5c3641", // roof, seam between tile rows
  c: "#323d5c", // chimney
  h: "#414e70", // chimney cap
  D: "#5a3d24", // door
  d: "#3f2a18", // door, shaded edge
  b: "#b08a45", // door knob
  f: "#1f2840", // window frame
  o: "#6b5636", // porch lamp, unlit
  g: "#2d5236", // flower box, leaves
  x: "#c97b84", // flower box, blooms
  /** The window. Swapped between lit and dark by the scene. */
  y: "#f2d287",
  Y: "#fffbf0",
  /** Trees. */
  T: "#060a13",
  t: "#0f1830",
  /** The fence. */
  i: "#4d5980", // picket
  j: "#38425f", // rail
  /** The village on the far hill. */
  v: "#0e1428",
  w: "#d9ad5e",
};

/** The same windows with nobody home. */
export const DARK_WINDOW = { y: "#131a2d", Y: "#1a2238" };

/** The windows once somebody is. The scene paints the big one brighter still. */
export const LIT_WINDOW = { y: "#c9973f", Y: "#e0b86a", o: "#f2d287" };

/**
 * 24 x 20. Two windows, a door with a step, a chimney on the right slope, a
 * flower box under the small window, and a lamp by the door. The big window
 * is four panes of `y` behind a frame `f`, with `Y` where the lamp inside is.
 */
export const HOUSE: string[] = [
  "...........rr...........",
  "..........rqqQ..........",
  ".........rqqqQQ.........",
  "........rsssssQQ.hhhh...",
  ".......rqqqqqqqQQ.cc....",
  "......rqqqqqqqqqQQcc....",
  ".....rssssssssssQQcc....",
  "....rqqqqqqqqqqqQQcc....",
  "...rqqqqqqqqqqqqqqqQQ...",
  "..rsssssssssssssssssQQ..",
  ".rqqqqqqqqqqqqqqqqqqqQQ.",
  "...eeeeeeeeeeeeeeeeee...",
  "...WWyyfyyWWWWWWWWWVV...",
  "...WWyYfyyWodDdWWyyVV...",
  "...WWfffffWWDDDWWyYVV...",
  "...WWyyfyyWWDDbWgxxgV...",
  "...WWyyfyyWWDDDWWWWVV...",
  "...WWWWWWWWWDDDWWWWVV...",
  "...WWWWWWWWWDDDWWWWVV...",
  "..FFFFFFFFFFSSSFFFFFFF..",
];

/** The other house: a square door and a little attic window in the roof. */
export const HOUSE_B: string[] = [
  "...........rr...........",
  "..........rqqQ..........",
  ".........rqqqQQ.........",
  "........rsssssQQ.hhhh...",
  ".......rqqqyyqqQQ.cc....",
  "......rqqqyyyyqqQQcc....",
  ".....rssssssssssQQcc....",
  "....rqqqqqqqqqqqQQcc....",
  "...rqqqqqqqqqqqqqqqQQ...",
  "..rsssssssssssssssssQQ..",
  ".rqqqqqqqqqqqqqqqqqqqQQ.",
  "...eeeeeeeeeeeeeeeeee...",
  "...WWyyfyyWWWWWWWWWVV...",
  "...WWyYfyyWoDDDWWyyVV...",
  "...WWfffffWWDDDWWyYVV...",
  "...WWyyfyyWWDDbWgxxgV...",
  "...WWyyfyyWWDDDWWWWVV...",
  "...WWWWWWWWWDDDWWWWVV...",
  "...WWWWWWWWWDDDWWWWVV...",
  "..FFFFFFFFFFSSSFFFFFFF..",
];

/** Left house, right house. Same size and anchors, so the scene treats them alike. */
export const HOUSES: [string[], string[]] = [HOUSE, HOUSE_B];

/** The big window inside either house: its top left corner and its size. */
export const HOUSE_WINDOW = { x: 5, y: 12, size: 5 };
/** Where the chimney opens, for the smoke. */
export const HOUSE_CHIMNEY = { x: 18, y: 3 };
/** The row of the eave, where a string of lights would be tied. */
export const HOUSE_EAVE = 10;
/** The porch lamp, for its small glow. */
export const HOUSE_LAMP = { x: 11, y: 13 };
/** The doorstep, where the footpath starts. */
export const HOUSE_STEP = { x: 13, y: 19 };

/** 7 x 11. */
export const PINE: string[] = [
  "...t...",
  "..tTT..",
  "..tTT..",
  ".ttTTT.",
  ".tTTTT.",
  "ttTTTTT",
  ".tTTTT.",
  "ttTTTTT",
  "tTTTTTT",
  "...T...",
  "...T...",
];

/** 5 x 7. A smaller pine, for the distance. */
export const PINE_SMALL: string[] = [
  "..t..",
  ".tTT.",
  ".tTT.",
  "ttTTT",
  ".tTT.",
  "ttTTT",
  "..T..",
];

/** 9 x 12. A round tree, lit from above on the left. */
export const TREE: string[] = [
  "...ttt...",
  "..ttttT..",
  ".tttttTT.",
  ".ttttTTT.",
  "ttttTTTTT",
  "tttTTTTTT",
  ".ttTTTTT.",
  "..tTTTT..",
  "...TTT...",
  "....T....",
  "....T....",
  "....T....",
];

/** 7 x 9. A younger round tree. */
export const TREE_SMALL: string[] = [
  "..ttt..",
  ".ttttT.",
  "tttTTTT",
  "ttTTTTT",
  ".tTTTT.",
  "..TTT..",
  "...T...",
  "...T...",
  "...T...",
];

/** 13 x 5. A run of pickets with two rails. */
export const FENCE: string[] = [
  "i..i..i..i..i",
  "ijjijjijjijji",
  "i..i..i..i..i",
  "ijjijjijjijji",
  "i..i..i..i..i",
];

/** 3 x 3, two frames. Tall grass, leaning one way and then the other. */
export const TUFT: [string[], string[]] = [
  [".t.", ".t.", "t.t"],
  ["..t", ".t.", "t.t"],
];

/** Tiny houses for the far hill. One window is left lit in the first. */
export const VILLAGE: string[][] = [
  ["..v..", ".vvv.", "vvwvv", "vvvvv"],
  ["v.....", "vvvvvv", "vvvvvv", "vvvvvv"],
  ["..v..", ".vvv.", "vvvvv", "vvvvv"],
];

/**
 * Cloud shapes for the sky. `c` is the body, `C` the top edge the moon lights,
 * and `u` the underside in its own shadow.
 */
export const CLOUDS: string[][] = [
  [
    ".........CCCCCC...........",
    "......CCCccccccCCC........",
    "...CCCcccccccccccCCCC.....",
    ".CCccccccccccccccccccCCC..",
    "CcccccccccccccccccccccccC.",
    ".ccccccccccccccccccccccuu.",
    "...cccccccuuuuuuuuuuuuu...",
    ".......uuuuuuuuuuuu.......",
  ],
  [
    ".....CCCC.........",
    "...CCccccCCCC.....",
    ".CCccccccccccCC...",
    "CccccccccccccccCC.",
    ".cccccccccccccuuuu",
    "...uuuuuuuuuuuuu..",
  ],
  [
    "..........CCCCC.................",
    ".......CCCcccccCC....CCCC.......",
    "....CCCccccccccccCCCCccccCC.....",
    "..CCcccccccccccccccccccccccCC...",
    "CCcccccccccccccccccccccccccccCC.",
    ".ccccccccccccccccccccccccccuuuu.",
    "....uuuuuuuuuuuuuuuuuuuuuuuu....",
  ],
];

export const SCENERY_SHEET: Record<string, string[]> = {
  HOUSE,
  HOUSE_B,
  PINE,
  PINE_SMALL,
  TREE,
  TREE_SMALL,
  FENCE,
  TUFT_A: TUFT[0],
  TUFT_B: TUFT[1],
  VILLAGE_A: VILLAGE[0],
  VILLAGE_B: VILLAGE[1],
  VILLAGE_C: VILLAGE[2],
  CLOUD_A: CLOUDS[0],
  CLOUD_B: CLOUDS[1],
  CLOUD_C: CLOUDS[2],
};

/** The characters each scenery sprite is allowed to use. */
export const SCENERY_INK = new Set([...Object.keys(NIGHT), "c", "C", "u", "."]);
