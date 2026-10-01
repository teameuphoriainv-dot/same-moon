"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  layoutOf,
  MAX_ITEMS,
  MAX_TEXT,
  newItemId,
  SPAN,
  TAPE_TINTS,
  type Item,
  type Layout,
} from "./layout";
import type { Scrap } from "./types";

export const ROTATE_STEP = 15;
export const SIZE_STEP = 40;
const MIN_SIZE = 40;
const MAX_SIZE = SPAN;
/** How long after the last change the arrangement is written. */
const SAVE_DELAY = 250;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Drag {
  id: string;
  /** Where the pointer went down, in CSS pixels. */
  px: number;
  py: number;
  /** Where the item was, in permille. */
  ox: number;
  oy: number;
  /** The page box at that moment, so a move converts to permille. */
  w: number;
  h: number;
  moved: boolean;
}

/**
 * Arranging one page: moving what is on it, adding to it, taking from it.
 *
 * The arrangement lives here as local state while someone is working on it,
 * and is written to the book a moment after they stop. The copy coming back
 * from the database is only adopted while nobody here is mid-gesture, so a
 * slow round trip never yanks an item out from under a finger.
 */
export function useArrange(page: Scrap, save: (id: number, layout: Layout) => Promise<void>) {
  const [layout, setLayoutState] = useState<Layout>(() => layoutOf(page));
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const latest = useRef(layout);
  const pageRef = useRef(page);
  pageRef.current = page;
  const undo = useRef<Layout | null>(null);
  const drag = useRef<Drag | null>(null);
  const timer = useRef<number | null>(null);
  const dirty = useRef<Layout | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const tapeTurn = useRef(0);

  const setLayout = useCallback((next: Layout) => {
    latest.current = next;
    setLayoutState(next);
  }, []);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const waiting = dirty.current;
    if (!waiting) return;
    dirty.current = null;
    // A failed write keeps the local copy; the next change sends it again.
    void save(pageRef.current.id, waiting).catch(() => {});
  }, [save]);

  /** Apply a change and queue the write. */
  const commit = useCallback(
    (next: Layout, opts: { now?: boolean; remember?: boolean } = {}) => {
      if (opts.remember !== false) undo.current = latest.current;
      setLayout(next);
      dirty.current = next;
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (opts.now) flush();
      else timer.current = window.setTimeout(flush, SAVE_DELAY);
    },
    [flush, setLayout],
  );

  // What the other phone did, adopted only while this one is idle.
  const incoming = page.layout;
  useEffect(() => {
    if (drag.current || timer.current !== null || dirty.current || editingRef.current) return;
    setLayout(layoutOf(pageRef.current));
  }, [incoming, setLayout]);

  // Turning away from the page must not lose a move made a moment ago.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const items = () => latest.current.items;
  const withItems = (next: Item[]): Layout => ({ ...latest.current, items: next });
  const change = (id: string, fn: (i: Item) => Item) =>
    withItems(items().map((i) => (i.id === id ? fn(i) : i)));

  // --- moving ------------------------------------------------------------------

  const onItemDown = useCallback(
    (e: React.PointerEvent, id: string, canvas: HTMLElement | null) => {
      if (!canvas) return;
      const item = latest.current.items.find((i) => i.id === id);
      if (!item) return;
      const rect = canvas.getBoundingClientRect();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id, px: e.clientX, py: e.clientY, ox: item.x, oy: item.y, w: rect.width, h: rect.height, moved: false };
      setSelected(id);
    },
    [],
  );

  const onItemMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.w === 0 || d.h === 0) return;
      const dx = ((e.clientX - d.px) / d.w) * SPAN;
      const dy = ((e.clientY - d.py) / d.h) * SPAN;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      if (!d.moved) undo.current = latest.current;
      d.moved = true;
      setLayout(change(d.id, (i) => ({ ...i, x: clamp(d.ox + dx, 0, SPAN), y: clamp(d.oy + dy, 0, SPAN) })));
    },
    // change() reads refs only, so nothing here goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setLayout],
  );

  const onItemUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) commit(latest.current, { now: true, remember: false });
  }, [commit]);

  // --- the selected item --------------------------------------------------------

  const rotate = (deg: number) =>
    selected && commit(change(selected, (i) => ({ ...i, r: ((((i.r + deg) % 360) + 540) % 360) - 180 })));

  const grow = (by: number) =>
    selected && commit(change(selected, (i) => ({ ...i, s: clamp(i.s + by, MIN_SIZE, MAX_SIZE) })));

  const toFront = () => {
    if (!selected) return;
    const it = items().find((i) => i.id === selected);
    if (it) commit(withItems([...items().filter((i) => i !== it), it]));
  };

  const remove = () => {
    const it = items().find((i) => i.id === selected);
    if (!it || it.t === "main") return;
    commit(withItems(items().filter((i) => i !== it)), { now: true });
    setSelected(null);
    if (editing === selected) setEditing(null);
  };

  // --- adding ---------------------------------------------------------------------

  const place = (item: Omit<Item, "id" | "x" | "y" | "r">, r = 0) => {
    if (items().length >= MAX_ITEMS) return null;
    const id = newItemId();
    const spread = () => Math.round((Math.random() - 0.5) * 120);
    const fresh: Item = { id, x: SPAN / 2 + spread(), y: SPAN / 2 + spread(), r, ...item };
    commit(withItems([...items(), fresh]), { now: true });
    setSelected(id);
    return id;
  };

  const addSticker = (k: string) => place({ t: "sticker", s: 130, k }, Math.round((Math.random() - 0.5) * 30));

  const addTape = () => {
    const k = TAPE_TINTS[tapeTurn.current++ % TAPE_TINTS.length];
    place({ t: "tape", s: 180, k }, [-35, 35, -8, 8][tapeTurn.current % 4]);
  };

  /** A blank scrap goes down first; the words come in as they are typed. */
  const addText = () => {
    const id = place({ t: "text", s: 380, txt: "" }, Math.round((Math.random() - 0.5) * 12));
    if (id) setEditing(id);
  };

  const editText = (id: string) => setEditing(id);

  const changeText = (id: string, txt: string) =>
    setLayout(change(id, (i) => ({ ...i, txt: txt.slice(0, MAX_TEXT) })));

  /** Blur: an empty scrap is thrown away, anything else is kept. */
  const finishText = (id: string) => {
    setEditing(null);
    const it = items().find((i) => i.id === id);
    if (!it) return;
    if (!it.txt?.trim()) {
      commit(withItems(items().filter((i) => i !== it)), { now: true, remember: false });
      if (selected === id) setSelected(null);
    } else commit(latest.current, { now: true });
  };

  // --- the mode itself --------------------------------------------------------------

  const undoOnce = () => {
    const back = undo.current;
    if (!back) return;
    undo.current = null;
    commit(back, { now: true, remember: false });
    setSelected(null);
  };

  const begin = () => {
    undo.current = null;
    setActive(true);
  };

  const done = () => {
    // Half-written scraps do not survive leaving the mode.
    const kept = items().filter((i) => i.t !== "text" || i.txt?.trim());
    if (kept.length !== items().length) commit(withItems(kept), { remember: false });
    flush();
    setActive(false);
    setSelected(null);
    setEditing(null);
  };

  return {
    layout,
    active,
    selected,
    editing,
    canUndo: undo.current !== null,
    full: layout.items.length >= MAX_ITEMS,
    begin,
    done,
    select: setSelected,
    onItemDown,
    onItemMove,
    onItemUp,
    rotate,
    grow,
    toFront,
    remove,
    addSticker,
    addTape,
    addText,
    editText,
    changeText,
    finishText,
    undoOnce,
  };
}

export type Arranger = ReturnType<typeof useArrange>;
