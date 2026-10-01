"use client";

import { useEffect, useRef, useState } from "react";
import { partnerOf } from "./auth";
import { isHere, presenceLabel } from "./here";
import { pulse, serverNow } from "./pulse";
import type { Place, PulseRow } from "./types";

/** How often this device says it is still here. */
const BEAT_MS = 25_000;
/** How often the wording is refreshed, so "2m ago" does not sit there all night. */
const TICK_MS = 15_000;

export interface Presence {
  available: boolean;
  partner: string;
  /** True while they have the site open in front of them. */
  here: boolean;
  /** Server time they were last here, or null if they never have been. */
  lastAt: number | null;
  /** Where on the site they are, when they are here. */
  place: string;
  /** "Active now", "Last active 5m ago", or "" when there is nothing to say. */
  label: string;
}

/**
 * Says this device is here, and reports whether the other one is.
 *
 * Checking in only happens while the page is actually in front of someone. A
 * tab left open in the background is not a person, so hiding the page says
 * goodbye and coming back says hello again.
 */
export function usePresence(who: string | null, place: Place): Presence {
  const [rows, setRows] = useState<PulseRow[]>([]);
  const [, tick] = useState(0);
  const placeRef = useRef(place);
  const saidPlace = useRef<string | null>(null);

  useEffect(() => pulse.watch(setRows), []);

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!who || !pulse.available) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      saidPlace.current = placeRef.current;
      void pulse.beat(who, placeRef.current);
    };
    const arrive = () => {
      beat();
      if (!timer) timer = setInterval(beat, BEAT_MS);
    };
    const leave = () => {
      if (timer) clearInterval(timer);
      timer = null;
      void pulse.rest(who);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") arrive();
      else leave();
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [who]);

  // Moving to another part of the site is worth saying straight away, rather
  // than leaving the other one looking at where you were for half a minute.
  useEffect(() => {
    placeRef.current = place;
    if (!who || !pulse.available) return;
    if (saidPlace.current === null || saidPlace.current === place) return;
    if (document.visibilityState !== "visible") return;
    saidPlace.current = place;
    void pulse.beat(who, place);
  }, [who, place]);

  const partner = who ? partnerOf(who) : "";
  const row = rows.find((r) => r.who === partner) ?? null;
  const now = serverNow();
  const here = isHere(row, now);

  return {
    available: pulse.available,
    partner,
    here,
    lastAt: row ? row.at : null,
    place: here && row ? row.place : "",
    label: presenceLabel(row, now),
  };
}
