/**
 * How a scrapbook page is arranged.
 *
 * A page is a canvas. Everything on it (the photo, stickers, strips of tape,
 * little scraps of text, the kiss) is an item with a position, a turn and a
 * size, and the whole arrangement is one JSON string in `scrap_layout`.
 *
 * Positions are in permille of the page box, not pixels, so an arrangement
 * made on a phone lands in the same place on a laptop. No React and no
 * database in here, so all of it can be tested directly.
 */

import { STICKER_SHEET } from "./art/stickers";
import type { Scrap } from "./types";

export const LAYOUT_VERSION = 1;
/** The page box is 0..1000 on both axes, whatever its real size. */
export const SPAN = 1000;
export const MAX_ITEMS = 24;
export const MAX_TEXT = 140;
/** Same bound as MAX_LAYOUT_LEN in scrap.rs. */
export const MAX_LAYOUT_BYTES = 6 * 1024;

export type ItemKind = "main" | "sticker" | "tape" | "text";

export interface Item {
  /** Stable within the page, so React keys and selection survive re-renders. */
  id: string;
  t: ItemKind;
  /** Centre, in permille of the page box. */
  x: number;
  y: number;
  /** Turn in degrees, -180..180. */
  r: number;
  /** Width in permille of the page box. */
  s: number;
  /** For a sticker: a key of STICKER_SHEET, e.g. "HEART". For tape: a tint key. */
  k?: string;
  /** For a scrap of text. */
  txt?: string;
}

export interface Layout {
  v: number;
  items: Item[];
}

const KINDS = new Set<ItemKind>(["main", "sticker", "tape", "text"]);
export const TAPE_TINTS = ["rose", "brass", "sky", "leaf", "plain"] as const;
export type TapeTint = (typeof TAPE_TINTS)[number];

function num(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
}

/**
 * Read a stored layout. Anything malformed is dropped item by item rather than
 * failing the page: the rows come out of a database anyone with its name can
 * write to, so nothing in them is trusted.
 */
export function parseLayout(raw: string): Layout | null {
  if (!raw || raw.length > MAX_LAYOUT_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || !Array.isArray((data as Layout).items)) return null;
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const it of (data as { items: unknown[] }).items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (typeof o.id !== "string" || !/^[a-z0-9_-]{1,16}$/i.test(o.id) || seen.has(o.id)) continue;
    if (typeof o.t !== "string" || !KINDS.has(o.t as ItemKind)) continue;
    const t = o.t as ItemKind;
    const item: Item = {
      id: o.id,
      t,
      x: num(o.x, 0, SPAN, SPAN / 2),
      y: num(o.y, 0, SPAN, SPAN / 2),
      r: num(o.r, -180, 180, 0),
      s: num(o.s, 40, SPAN, 200),
    };
    if (t === "sticker") {
      // hasOwn, not `in`: "constructor" and "__proto__" are `in` every object.
      if (typeof o.k !== "string" || !Object.hasOwn(STICKER_SHEET, o.k)) continue;
      item.k = o.k;
    }
    if (t === "tape") {
      item.k = (TAPE_TINTS as readonly string[]).includes(o.k as string) ? (o.k as string) : "plain";
    }
    if (t === "text") {
      if (typeof o.txt !== "string") continue;
      const txt = o.txt.trim().slice(0, MAX_TEXT);
      if (!txt) continue;
      item.txt = txt;
    }
    // Only one anchor per page. A second one would draw the photo twice.
    if (t === "main" && items.some((i) => i.t === "main")) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  return { v: LAYOUT_VERSION, items };
}

/** Write a layout out, rounded so the JSON stays small. */
export function serializeLayout(layout: Layout): string {
  const items = layout.items.slice(0, MAX_ITEMS).map((i) => {
    const out: Item = {
      id: i.id,
      t: i.t,
      x: Math.round(num(i.x, 0, SPAN, SPAN / 2)),
      y: Math.round(num(i.y, 0, SPAN, SPAN / 2)),
      r: Math.round(num(i.r, -180, 180, 0)),
      s: Math.round(num(i.s, 40, SPAN, 200)),
    };
    if (i.k !== undefined) out.k = i.k;
    if (i.txt !== undefined) out.txt = i.txt.trim().slice(0, MAX_TEXT);
    return out;
  });
  return JSON.stringify({ v: LAYOUT_VERSION, items });
}

let counter = 0;
/** A short id that will not collide with the others on the page. */
export function newItemId(): string {
  counter = (counter + 1) % 1296;
  return `${Date.now().toString(36).slice(-5)}${counter.toString(36).padStart(2, "0")}`;
}

function rng(seed: number): () => number {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const CHARM_STICKERS: Record<string, string[]> = {
  hearts: ["HEART", "HEART_SMALL", "SPARKLE"],
  stars: ["STAR", "SPARKLE", "STAR"],
  moons: ["MOON", "CLOUD", "SPARKLE"],
  flowers: ["FLOWER", "FLOWER", "SPROUT"],
};

const CHARM_TAPE: Record<string, TapeTint> = {
  hearts: "rose",
  stars: "brass",
  moons: "sky",
  flowers: "leaf",
};

/**
 * The arrangement a page starts with, before anyone has touched it. Depends on
 * nothing but the page, so it is the same on both phones and every time it is
 * opened, and a page that was never arranged still looks placed on purpose.
 */
export function defaultLayout(page: Pick<Scrap, "id" | "kind" | "charm" | "w" | "h">): Layout {
  const rand = rng(page.id);
  // Whole degrees, so what is saved reads back exactly as it was drawn.
  const tilt = [-3, -2, 0, 2, 3][Math.floor(rand() * 5)];
  const items: Item[] = [];

  if (page.kind !== "note") {
    const portrait = page.w > 0 && page.h > page.w;
    items.push({ id: "main", t: "main", x: 500, y: portrait ? 470 : 430, r: tilt, s: portrait ? 560 : 760 });
    const tint = CHARM_TAPE[page.charm] ?? "plain";
    items.push({ id: "tape1", t: "tape", x: 500 - (portrait ? 200 : 300), y: portrait ? 160 : 190, r: -35 + tilt, s: 170, k: tint });
    items.push({ id: "tape2", t: "tape", x: 500 + (portrait ? 200 : 300), y: portrait ? 160 : 190, r: 35 + tilt, s: 170, k: tint });
  }

  const set = CHARM_STICKERS[page.charm] ?? CHARM_STICKERS.hearts;
  const corners: [number, number][] = [
    [110, 110],
    [890, 120],
    [120, 880],
    [880, 870],
  ];
  const skip = Math.floor(rand() * corners.length);
  corners.forEach(([x, y], i) => {
    if (i === skip) return;
    items.push({
      id: `st${i}`,
      t: "sticker",
      x: x + Math.round((rand() - 0.5) * 60),
      y: y + Math.round((rand() - 0.5) * 60),
      r: Math.round((rand() - 0.5) * 40),
      s: [90, 110, 130][Math.floor(rand() * 3)],
      k: set[Math.floor(rand() * set.length)],
    });
  });
  return { v: LAYOUT_VERSION, items };
}

/** The layout a page should be drawn with: its own if it has one, else the default. */
export function layoutOf(page: Scrap): Layout {
  return parseLayout(page.layout) ?? defaultLayout(page);
}

/** Whether the page has been sealed with a kiss and can never change again. */
export function isSealed(page: Pick<Scrap, "sealedBy">): boolean {
  return page.sealedBy !== "";
}
