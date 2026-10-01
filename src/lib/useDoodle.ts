"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doodles, encodeStrokes } from "./arcade";
import { BLANK_DOODLE, type DoodleState } from "./types";

/** Strokes are gathered for this long and sent together. */
const FLUSH_MS = 90;
/** A pixel the server never confirmed is dropped after this long. */
const WAIT_MS = 3000;

interface Waiting {
  ink: string;
  since: number;
}

/**
 * The shared canvas, drawn on straight away.
 *
 * A pixel shows under the finger the instant it is painted and is sent a
 * moment later in a batch. Until the server has it, the pixel is kept in
 * `waiting` and laid over whatever the server last said, so a stroke from the
 * other phone arriving mid-drag cannot make this one flicker.
 */
export function useDoodle(who: string | null) {
  const [server, setServer] = useState<DoodleState>(BLANK_DOODLE);
  const [waiting, setWaiting] = useState<Map<number, Waiting>>(new Map());
  const queue = useRef<Map<number, string>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheet = useRef(0);

  useEffect(
    () =>
      doodles.watch((next) => {
        // A wiped sheet takes everything in flight with it.
        if (next.sheet !== sheet.current) {
          queue.current = new Map();
          setWaiting(new Map());
        }
        sheet.current = next.sheet;
        setServer(next);
      }),
    [],
  );

  // Let go of every pixel the server now agrees with, or has clearly lost.
  useEffect(() => {
    setWaiting((prev) => {
      if (prev.size === 0) return prev;
      const now = Date.now();
      const next = new Map(prev);
      for (const [at, pixel] of prev) {
        if (server.cells[at] === pixel.ink || now - pixel.since > WAIT_MS) next.delete(at);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [server]);

  const flush = useCallback(() => {
    timer.current = null;
    if (!who || queue.current.size === 0) return;
    const strokes = encodeStrokes(queue.current);
    queue.current = new Map();
    void doodles.paint(sheet.current, who, strokes);
  }, [who]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const paint = useCallback(
    (pixels: number[], ink: string) => {
      if (!who || pixels.length === 0) return;
      const since = Date.now();
      setWaiting((prev) => {
        const next = new Map(prev);
        for (const at of pixels) next.set(at, { ink, since });
        return next;
      });
      for (const at of pixels) queue.current.set(at, ink);
      if (!timer.current) timer.current = setTimeout(flush, FLUSH_MS);
    },
    [who, flush],
  );

  const clear = useCallback(() => {
    if (!who) return;
    queue.current = new Map();
    setWaiting(new Map());
    void doodles.clear(who);
  }, [who]);

  const setPrompt = useCallback((text: string) => {
    void doodles.prompt(text);
  }, []);

  const cells = useMemo(() => {
    if (waiting.size === 0) return server.cells;
    const chars = server.cells.split("");
    for (const [at, pixel] of waiting) {
      if (at < chars.length) chars[at] = pixel.ink;
    }
    return chars.join("");
  }, [server.cells, waiting]);

  return {
    available: doodles.available,
    size: server.size,
    cells,
    /** True once anything at all has been drawn. */
    drawn: /[a-z]/.test(cells),
    prompt: server.prompt,
    paint,
    clear,
    setPrompt,
  };
}
