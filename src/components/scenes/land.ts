/**
 * Drawing the land under the moon. Pure functions over a 2d context, so the
 * component stays small and a script can rasterize the scene without a browser.
 *
 * Everything is placed by seeded numbers off the width, so both phones see the
 * same valley and a resize only reveals more of it.
 */

import {
  DARK_WINDOW,
  FENCE,
  HOUSE_CHIMNEY,
  HOUSE_EAVE,
  HOUSE_LAMP,
  HOUSE_STEP,
  HOUSE_WINDOW,
  HOUSES,
  LIT_WINDOW,
  NIGHT,
  PINE,
  PINE_SMALL,
  TREE,
  TREE_SMALL,
  TUFT,
  VILLAGE,
} from "@/lib/art/scenery";
import { bayer, seeded, stamp } from "./seeded";

/** How many pixels tall the land is. */
export const ROWS = 60;

const FARTHEST = "#1a2342";
const FAR = "#121a2f";
const NEAR = "#0b1221";
const GROUND = "#070b14";
const PATH = "#182338";
const POND = "#101b34";
const POND_RIM = "#0d1629";
const GLINT = ["#aebbe0", "#f4e9d4"];
const STRING = "#2b3450";
const BULBS = ["#f2d287", "#e3a3aa", "#f4e9d4", "#a8d98a"];
const FIREFLY = "#d3f0b5";
const SMOKE = "#4a5678";
const GLOW = "#f2d287";
const PANE_DIM = "#f0c777";
const LIT_FRAME = "#8a6a3a";
const GRASS = { t: "#1c2842" };
const HAMLET = { v: NIGHT.v, w: NIGHT.w };
const DARK = { ...NIGHT, ...DARK_WINDOW };
const LIT = { ...NIGHT, ...LIT_WINDOW };

/**
 * The dusk left over the far hills, from nothing at the top down to a warm
 * plum where the land begins. Six flat steps; the dither is what blends them.
 */
const DUSK: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [14, 20, 40, 120],
  [24, 27, 52, 175],
  [36, 32, 62, 215],
  [44, 34, 66, 240],
  [56, 42, 76, 255],
];
const DUSK_TOP = 6;
const DUSK_ROWS = 28;

const HOUSE_W = HOUSES[0][0].length;
const HOUSE_H = HOUSES[0].length;

export interface Home {
  name: string;
  /** True while they have the site open. Their window is lit. */
  here: boolean;
}

export interface Land {
  W: number;
  farthest: (x: number) => number;
  far: (x: number) => number;
  near: (x: number) => number;
  /** Top left corner of each house. */
  houses: [{ x: number; y: number }, { x: number; y: number }];
  /** Centre column and half width of the pond, when there is room for one. */
  pond: { x: number; rx: number } | null;
  tufts: { x: number; y: number; lean: number }[];
  flies: { x: number; y: number; beat: number }[];
}

export function shape(W: number): Land {
  const bump = (x: number, centre: number, spread: number) =>
    Math.exp(-(((x - centre) / spread) ** 2));
  const spread = 24 + W * 0.035;
  const leftAt = Math.round(W * 0.16);
  const rightAt = Math.round(W * 0.84);

  const farthest = (x: number) =>
    ROWS - 27 - Math.round(4 * Math.sin(x * 0.021 + 2.1) + 2 * Math.sin(x * 0.067 + 0.9));
  const far = (x: number) =>
    ROWS - 19 - Math.round(4 * Math.sin(x * 0.043 + 1.3) + 2.5 * Math.sin(x * 0.103 + 0.4));
  const near = (x: number) =>
    ROWS -
    9 -
    Math.round(
      10 * bump(x, leftAt, spread) + 10 * bump(x, rightAt, spread) + 1.2 * Math.sin(x * 0.21),
    );

  // A house stands on the crest of its hill with a footing built down to the
  // slope either side, so it never floats and never sinks.
  const seat = (at: number) => ({ x: at - Math.floor(HOUSE_W / 2), y: near(at) - HOUSE_H });
  const houses: Land["houses"] = [seat(leftAt), seat(rightAt)];

  const pond = W >= 96 ? { x: Math.round(W / 2), rx: Math.min(18, Math.round(W * 0.07)) } : null;

  const rand = seeded(424242 + W);
  const tufts: Land["tufts"] = [];
  for (let x = 1; x < W - 3; x += 4 + Math.floor(rand() * 6)) {
    const byHouse = houses.some((h) => x > h.x - 3 && x < h.x + HOUSE_W + 1);
    if (byHouse) continue;
    tufts.push({ x, y: near(x + 1) - 3, lean: Math.floor(rand() * 2) });
  }
  const flies = Array.from({ length: Math.max(5, Math.round(W / 22)) }, () => {
    const x = Math.floor(rand() * W);
    return { x, y: near(x) - 1 - Math.floor(rand() * 7), beat: Math.floor(rand() * 19) };
  });

  return { W, farthest, far, near, houses, pond, tufts, flies };
}

/** Stamp a sprite so every column stands on the ground under it. */
function stampOnSlope(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  palette: Record<string, string>,
  left: number,
  ground: (x: number) => number,
) {
  for (let x = 0; x < rows[0].length; x++) {
    const top = ground(left + x) - rows.length;
    for (let y = 0; y < rows.length; y++) {
      const fill = palette[rows[y][x]];
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(left + x, top + y, 1, 1);
    }
  }
}

function paintDusk(ctx: CanvasRenderingContext2D, W: number) {
  const img = ctx.createImageData(W, DUSK_ROWS);
  const px = img.data;
  for (let y = 0; y < DUSK_ROWS; y++) {
    const t = (y / DUSK_ROWS) * (DUSK.length - 1);
    const base = Math.floor(t);
    const frac = t - base;
    for (let x = 0; x < W; x++) {
      const step = DUSK[Math.min(DUSK.length - 1, base + (bayer(x, y) < frac ? 1 : 0))];
      const i = (y * W + x) * 4;
      px[i] = step[0];
      px[i + 1] = step[1];
      px[i + 2] = step[2];
      px[i + 3] = step[3];
    }
  }
  ctx.putImageData(img, 0, DUSK_TOP);
}

/** Everything that never moves, drawn once and kept. */
export function paintLand(ctx: CanvasRenderingContext2D, land: Land) {
  const { W, farthest, far, near, houses, pond } = land;
  ctx.clearRect(0, 0, W, ROWS);
  paintDusk(ctx, W);

  // The farthest hill, and a hamlet on it for the eye to travel to.
  ctx.fillStyle = FARTHEST;
  for (let x = 0; x < W; x++) ctx.fillRect(x, farthest(x), 1, ROWS - farthest(x));
  const rand = seeded(1911 + W);
  let placed = 0;
  for (let x = Math.round(W * 0.3) + Math.floor(rand() * 8); x < W * 0.72 && placed < 3; x += 9 + Math.floor(rand() * 9)) {
    // Only where the nearer ridge leaves the little house showing.
    if (far(x + 2) - farthest(x + 2) < 5) continue;
    const rows = VILLAGE[placed];
    stamp(ctx, rows, HAMLET, x, farthest(x + 2) - rows.length + 1);
    placed += 1;
  }

  ctx.fillStyle = FAR;
  for (let x = 0; x < W; x++) ctx.fillRect(x, far(x), 1, ROWS - far(x));

  // Small pines along the far ridge, for distance.
  for (let x = 6; x < W - 6; x += 9 + Math.floor(rand() * 14)) {
    if (rand() > 0.55) stamp(ctx, PINE_SMALL, NIGHT, x, far(x + 2) - PINE_SMALL.length + 2);
  }

  // Trees stand behind the near ridge, sunk two pixels so they grow out of it.
  for (const h of houses) {
    const plant = (off: number, rows: string[]) => {
      const tx = h.x + off;
      if (tx < -3 || tx > W - 4) return;
      stamp(ctx, rows, NIGHT, tx, near(tx + Math.floor(rows[0].length / 2)) - rows.length + 2);
    };
    plant(-13, PINE);
    plant(-24, TREE_SMALL);
    plant(HOUSE_W + 2, TREE);
    plant(HOUSE_W + 12, PINE);
  }
  for (let x = Math.round(W * 0.34); x < W * 0.66; x += 15 + Math.floor(rand() * 18)) {
    if (pond && Math.abs(x + 4 - pond.x) < pond.rx + 4 && rand() > 0.5) continue;
    const rows = rand() > 0.5 ? TREE : PINE;
    stamp(ctx, rows, NIGHT, x, near(x + 3) - rows.length + 2);
  }

  ctx.fillStyle = NEAR;
  for (let x = 0; x < W; x++) ctx.fillRect(x, near(x), 1, ROWS - near(x));

  houses.forEach((h, i) => {
    ctx.fillStyle = NIGHT.F;
    for (let x = 2; x < HOUSE_W - 2; x++) {
      const gx = h.x + x;
      ctx.fillRect(gx, h.y + HOUSE_H, 1, Math.max(0, near(gx) - h.y - HOUSE_H));
    }
    stamp(ctx, HOUSES[i], DARK, h.x, h.y);

    // The fence is on the outside, leaving the valley between them open.
    const fx = i === 0 ? h.x - FENCE[0].length - 2 : h.x + HOUSE_W + 2;
    stampOnSlope(ctx, FENCE, NIGHT, fx, near);

    // A footpath from the step down the hill toward the valley.
    const dir = i === 0 ? 1 : -1;
    ctx.fillStyle = PATH;
    for (let k = 0; k < 16; k++) {
      const px = h.x + HOUSE_STEP.x + dir * k;
      if (k < 2 || (k + px) % 2 === 0) ctx.fillRect(px, near(px), 1, 1);
      if (k > 2 && (k + px) % 3 === 0) ctx.fillRect(px, near(px) + 1, 1, 1);
    }
  });

  if (pond) {
    const top = ROWS - 8;
    for (let dy = 0; dy < 3; dy++) {
      const half = Math.round(pond.rx * (dy === 1 ? 1 : 0.7));
      ctx.fillStyle = dy === 0 ? POND_RIM : POND;
      ctx.fillRect(pond.x - half, top + dy, half * 2 + 1, 1);
    }
  }

  ctx.fillStyle = GROUND;
  ctx.fillRect(0, ROWS - 5, W, 5);
}

function paintHome(ctx: CanvasRenderingContext2D, land: Land, i: number, frame: number) {
  const h = land.houses[i];
  stamp(ctx, HOUSES[i], LIT, h.x, h.y);

  // Light from the big window pools on the wall and spills down onto the grass.
  const cx = h.x + HOUSE_WINDOW.x + 2;
  const cy = h.y + HOUSE_WINDOW.y + 2;
  ctx.fillStyle = GLOW;
  for (let dy = -6; dy <= 10; dy++) {
    for (let dx = -9; dx <= 9; dx++) {
      const reach = Math.abs(dx) + Math.abs(dy) * (dy < 0 ? 1.4 : 0.75);
      if (reach > 9) continue;
      if (reach > 6 && bayer(cx + dx, cy + dy) > 0.5) continue;
      ctx.globalAlpha = reach <= 3 ? 0.22 : reach <= 6 ? 0.12 : 0.06;
      ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  // Four panes behind a frame. Now and then the lamp inside dips.
  const dim = frame % 23 === 0;
  const wx = h.x + HOUSE_WINDOW.x;
  const wy = h.y + HOUSE_WINDOW.y;
  for (let dy = 0; dy < HOUSE_WINDOW.size; dy++) {
    for (let dx = 0; dx < HOUSE_WINDOW.size; dx++) {
      const frameBar = dx === 2 || dy === 2;
      const bright = (dx === 1 || dx === 3) && dy === 1;
      ctx.fillStyle = frameBar ? LIT_FRAME : bright ? NIGHT.Y : dim ? PANE_DIM : NIGHT.y;
      ctx.fillRect(wx + dx, wy + dy, 1, 1);
    }
  }

  // The porch lamp and its small halo.
  const lx = h.x + HOUSE_LAMP.x;
  const ly = h.y + HOUSE_LAMP.y;
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = GLOW;
  ctx.fillRect(lx - 1, ly, 1, 1);
  ctx.fillRect(lx + 1, ly, 1, 1);
  ctx.fillRect(lx, ly - 1, 1, 1);
  ctx.fillRect(lx, ly + 1, 1, 1);

  // Three puffs, each a third of the way behind the last.
  ctx.fillStyle = SMOKE;
  for (let p = 0; p < 3; p++) {
    const rise = (frame * 0.35 + p * 4) % 12;
    ctx.globalAlpha = Math.max(0, 0.55 - rise * 0.045);
    const sx = h.x + HOUSE_CHIMNEY.x + Math.round(Math.sin(rise * 0.6 + p) * 1.2);
    const size = rise > 6 ? 2 : 1;
    ctx.fillRect(sx, Math.round(h.y + HOUSE_CHIMNEY.y - rise), size, size);
  }
  ctx.globalAlpha = 1;
}

function paintLights(ctx: CanvasRenderingContext2D, land: Land, frame: number) {
  const { W, houses, near } = land;
  const a = { x: houses[0].x + HOUSE_W, y: houses[0].y + HOUSE_EAVE };
  const b = { x: houses[1].x - 1, y: houses[1].y + HOUSE_EAVE };
  const sag = 7 + W * 0.02;
  const span = Math.max(1, b.x - a.x);

  // The valley floor catches a little of it.
  ctx.fillStyle = GLOW;
  ctx.globalAlpha = 0.07;
  for (let x = a.x + 3; x < b.x - 3; x++) {
    for (let dy = 0; dy < 4; dy++) {
      if (bayer(x, dy) < 0.5 - dy * 0.12) ctx.fillRect(x, near(x) + dy, 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  for (let x = a.x; x <= b.x; x++) {
    const u = (x - a.x) / span;
    const y = Math.round(a.y + (b.y - a.y) * u + sag * 4 * u * (1 - u));
    ctx.fillStyle = STRING;
    ctx.fillRect(x, y, 1, 1);
    if ((x - a.x) % 5 !== 2) continue;
    const n = Math.floor((x - a.x) / 5);
    // Each bulb breathes on its own clock, never quite out.
    const beat = (frame + n * 5) % 14;
    const glow = beat < 2 ? 0.45 : beat < 4 ? 0.75 : 1;
    ctx.fillStyle = BULBS[n % BULBS.length];
    ctx.globalAlpha = glow;
    ctx.fillRect(x, y + 1, 1, 1);
    ctx.globalAlpha = glow * 0.3;
    ctx.fillRect(x, y + 2, 1, 1);
    ctx.fillRect(x - 1, y + 1, 1, 1);
    ctx.fillRect(x + 1, y + 1, 1, 1);
    ctx.globalAlpha = 1;
  }
}

/** One frame: the still land, then whatever moves or is lit tonight. */
export function paintLive(
  ctx: CanvasRenderingContext2D,
  backdrop: CanvasImageSource,
  land: Land,
  homes: readonly [Home, Home],
  frame: number,
) {
  const { W, pond, tufts, flies } = land;
  ctx.clearRect(0, 0, W, ROWS);
  ctx.drawImage(backdrop, 0, 0);

  const sway = Math.floor(frame / 4) % 2;
  for (const g of tufts) stamp(ctx, TUFT[(g.lean + sway) % 2], GRASS, g.x, g.y);

  // The moon on the water, broken up by the smallest breeze.
  if (pond) {
    const shimmer = Math.floor(frame / 3) % 2;
    ctx.fillStyle = GLINT[shimmer];
    ctx.globalAlpha = 0.55;
    ctx.fillRect(pond.x - 1 + shimmer, ROWS - 7, 2, 1);
    ctx.fillRect(pond.x + 1 - shimmer, ROWS - 6, 1, 1);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(pond.x - 3 + shimmer * 2, ROWS - 8, 1, 1);
    ctx.fillRect(pond.x + 3 - shimmer, ROWS - 7, 1, 1);
    ctx.globalAlpha = 1;
  }

  if (homes[0].here) paintHome(ctx, land, 0, frame);
  if (homes[1].here) paintHome(ctx, land, 1, frame);
  if (homes[0].here && homes[1].here) paintLights(ctx, land, frame);

  ctx.fillStyle = FIREFLY;
  for (const f of flies) {
    const on = (frame + f.beat) % 19;
    if (on > 5) continue;
    ctx.globalAlpha = on === 2 || on === 3 ? 0.95 : 0.4;
    ctx.fillRect(f.x + (on > 2 ? 1 : 0), f.y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
