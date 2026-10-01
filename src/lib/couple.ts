"use client";

import { useEffect, useSyncExternalStore } from "react";
import { coalesce, isCloud, onReady, open, withConn } from "./conn";
import { MOON, STAR } from "./auth";

/**
 * The couple's names and whether they have Plus.
 *
 * Every table stores "Moon" or "Star". This is the one place that turns those
 * keys into the names the two of them actually go by. It is a tiny external
 * store rather than React state so any component can ask for a name without
 * threading props through the whole tree.
 */
export interface Couple {
  moonName: string;
  starName: string;
  /** True once both names exist. */
  named: boolean;
  /** Either of them bought Plus, so both have it. */
  plus: boolean;
  /** False until the database has answered, so setup never flashes. */
  loaded: boolean;
}

const LOCAL_KEY = "same-moon:couple";

let state: Couple = { moonName: "", starName: "", named: false, plus: false, loaded: false };
const listeners = new Set<() => void>();

function set(next: Partial<Couple>) {
  state = { ...state, ...next };
  state.named = Boolean(state.moonName && state.starName);
  for (const l of listeners) l();
}

let started = false;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  if (!isCloud) {
    // No database configured: this phone keeps the names to itself.
    try {
      const saved = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") as Partial<Couple>;
      set({ moonName: saved.moonName ?? "", starName: saved.starName ?? "", plus: Boolean(saved.plus), loaded: true });
    } catch {
      set({ loaded: true });
    }
    return;
  }

  onReady((conn) => {
    const push = coalesce(() => {
      const row = [...conn.db.couple.iter()][0];
      const plus = [...conn.db.plus.iter()][0];
      set({
        moonName: row?.moonName ?? "",
        starName: row?.starName ?? "",
        plus: Boolean(plus?.active),
        loaded: true,
      });
    });
    conn.db.couple.onInsert(push);
    conn.db.couple.onUpdate(push);
    conn.db.plus.onInsert(push);
    conn.db.plus.onUpdate(push);
    push();
  });
  open();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const snapshot = () => state;

/** The couple, live. */
export function useCouple(): Couple {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** A display name for a stored "Moon"/"Star" key. Anything else passes through. */
export function nameIn(c: Couple, who: string | null | undefined): string {
  if (who === MOON) return c.moonName || "Moon";
  if (who === STAR) return c.starName || "Star";
  return who ?? "";
}

/**
 * A display name without a hook, for components deep in the tree. The page
 * subscribes with useNameOf, so everything under it re-renders when names land.
 */
export function displayName(who: string | null | undefined): string {
  return nameIn(state, who);
}

/** `const nameOf = useNameOf(); nameOf(row.by)` */
export function useNameOf(): (who: string | null | undefined) => string {
  const c = useCouple();
  return (who) => nameIn(c, who);
}

export async function nameUs(moonName: string, starName: string): Promise<void> {
  if (!isCloud) {
    set({ moonName: moonName.trim(), starName: starName.trim() });
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    return;
  }
  await withConn((conn) => conn.reducers.nameUs({ moonName, starName }));
}

/** Record that one of them bought Plus, which turns it on for both. */
export async function unlockPlus(by: string): Promise<void> {
  if (!isCloud) {
    set({ plus: true });
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    return;
  }
  await withConn((conn) => conn.reducers.unlockPlus({ by }));
}
