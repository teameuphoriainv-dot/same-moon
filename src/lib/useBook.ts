"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nightKey } from "./dates";
import { getBackend, type Backend, type Mode } from "./store";
import { computeStats } from "./streak";
import { EMPTY_BOOK, type Book, type Night, type NightKind } from "./types";

export function useBook() {
  const backendRef = useRef<Backend | null>(null);
  const [book, setBook] = useState<Book>(EMPTY_BOOK);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("local");

  useEffect(() => {
    const backend = getBackend();
    backendRef.current = backend;
    setMode(backend.mode);
    let alive = true;
    backend.load().then((loaded) => {
      if (alive) {
        setBook(loaded);
        setReady(true);
      }
    });
    const unsubscribe = backend.subscribe((incoming) => {
      if (alive) setBook(incoming);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const setNight = useCallback(
    (day: string, patch: Partial<Night> | null) => {
      setBook((prev) => {
        const nights = { ...prev.nights };
        if (patch === null) {
          delete nights[day];
          void backendRef.current?.clearNight(day);
        } else {
          const existing: Night | undefined = nights[day];
          nights[day] = {
            ...existing,
            ...patch,
            day,
            kind: patch.kind ?? existing?.kind ?? "called",
          };
          void backendRef.current?.setNight(nights[day]);
        }
        const startedOn =
          prev.startedOn && prev.startedOn <= day ? prev.startedOn : Object.keys(nights).sort()[0] ?? day;
        return { ...prev, startedOn, nights };
      });
    },
    [],
  );

  const logNight = useCallback(
    (day: string, kind: NightKind = "called", note?: string) =>
      setNight(day, { kind, note, at: new Date().toISOString() }),
    [setNight],
  );

  const logTonight = useCallback(
    (kind: NightKind = "called") => logNight(nightKey(), kind),
    [logNight],
  );

  const clearNight = useCallback((day: string) => setNight(day, null), [setNight]);

  const addJoke = useCallback((text: string, by: string) => {
    void backendRef.current?.addJoke(text, by);
    // Optimistic locally; the cloud subscription overwrites with the real id.
    setBook((prev) => {
      const clean = text.trim().slice(0, 60);
      if (!clean || prev.jokes.some((j) => j.text.toLowerCase() === clean.toLowerCase())) return prev;
      const id = prev.jokes.reduce((max, j) => Math.max(max, j.id), 0) + 1;
      return { ...prev, jokes: [...prev.jokes, { id, text: clean, by }] };
    });
  }, []);

  const removeJoke = useCallback((id: number) => {
    void backendRef.current?.removeJoke(id);
    setBook((prev) => ({ ...prev, jokes: prev.jokes.filter((j) => j.id !== id) }));
  }, []);

  const stats = useMemo(() => computeStats(book), [book]);

  return { book, stats, ready, mode, logNight, logTonight, clearNight, setNight, addJoke, removeJoke };
}
