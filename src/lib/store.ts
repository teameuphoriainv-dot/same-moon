"use client";

import type { DbConnection } from "@/module_bindings";
import { coalesce, isCloud, onReady, withConn } from "./conn";
import { EMPTY_BOOK, type Book, type Joke, type Night } from "./types";

const LOCAL_KEY = "same-moon:book";

export type Mode = "local" | "cloud";

/**
 * Row-level rather than whole-book, because that is what maps onto SpacetimeDB
 * reducers. The local backend just applies the same operations to localStorage.
 */
export interface Backend {
  mode: Mode;
  load(): Promise<Book>;
  setNight(night: Night): Promise<void>;
  clearNight(day: string): Promise<void>;
  addJoke(text: string, by: string): Promise<void>;
  removeJoke(id: number): Promise<void>;
  subscribe(onChange: (book: Book) => void): () => void;
}

export const isCloudConfigured = isCloud;

// ---------------------------------------------------------------------------
// local
// ---------------------------------------------------------------------------

function readLocal(): Book {
  if (typeof window === "undefined") return EMPTY_BOOK;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return EMPTY_BOOK;
    const parsed = JSON.parse(raw) as Book;
    return {
      startedOn: parsed.startedOn ?? "",
      nights: parsed.nights ?? {},
      jokes: parsed.jokes ?? [],
    };
  } catch {
    return EMPTY_BOOK;
  }
}

function writeLocal(book: Book) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(book));
}

function earliest(nights: Record<string, Night>): string {
  return Object.keys(nights).sort()[0] ?? "";
}

const localBackend: Backend = {
  mode: "local",
  async load() {
    return readLocal();
  },
  async setNight(night) {
    const book = readLocal();
    const nights = { ...book.nights, [night.day]: night };
    writeLocal({ ...book, startedOn: earliest(nights), nights });
  },
  async clearNight(day) {
    const book = readLocal();
    const nights = { ...book.nights };
    delete nights[day];
    writeLocal({ ...book, startedOn: earliest(nights), nights });
  },
  async addJoke(text, by) {
    const book = readLocal();
    const clean = text.trim().slice(0, 60);
    if (!clean || book.jokes.some((j) => j.text.toLowerCase() === clean.toLowerCase())) return;
    const id = book.jokes.reduce((max, j) => Math.max(max, j.id), 0) + 1;
    writeLocal({ ...book, jokes: [...book.jokes, { id, text: clean, by }] });
  },
  async removeJoke(id) {
    const book = readLocal();
    writeLocal({ ...book, jokes: book.jokes.filter((j) => j.id !== id) });
  },
  subscribe(onChange) {
    if (typeof window === "undefined") return () => {};
    // Only fires for other tabs, which is the most this backend can offer.
    const handler = (e: StorageEvent) => {
      if (e.key === LOCAL_KEY) onChange(readLocal());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
};

// ---------------------------------------------------------------------------
// spacetimedb
// ---------------------------------------------------------------------------

/** Rebuild the whole Book from current table state. Cheap at this scale. */
function bookFrom(conn: DbConnection): Book {
  const nights: Record<string, Night> = {};
  for (const row of conn.db.night.iter()) {
    nights[row.day] = {
      day: row.day,
      kind: row.kind === "clouded" ? "clouded" : "called",
      note: row.note || undefined,
      by: row.by || undefined,
    };
  }
  const jokes: Joke[] = [...conn.db.joke.iter()]
    .map((row) => ({ id: Number(row.id), text: row.text, by: row.by || undefined }))
    .sort((a, b) => a.id - b.id);
  const meta = [...conn.db.meta.iter()][0];
  return { startedOn: meta?.startedOn || earliest(nights), nights, jokes };
}

const cloudBackend: Backend = {
  mode: "cloud",
  async load() {
    const book = await withConn(bookFrom);
    if (!book) return readLocal(); // offline: last synced copy is better than nothing
    writeLocal(book);
    return book;
  },
  async setNight(night) {
    const book = readLocal();
    writeLocal({ ...book, nights: { ...book.nights, [night.day]: night } });
    await withConn((conn) =>
      conn.reducers.markNight({
        day: night.day,
        kind: night.kind,
        note: night.note ?? "",
        by: night.by ?? "",
      }),
    );
  },
  async clearNight(day) {
    await withConn((conn) => conn.reducers.clearNight({ day }));
  },
  async addJoke(text, by) {
    await withConn((conn) => conn.reducers.addJoke({ text, by }));
  },
  async removeJoke(id) {
    await withConn((conn) => conn.reducers.removeJoke({ id: BigInt(id) }));
  },
  subscribe(onChange) {
    let live = true;
    // Re-runs on every reconnect, which is how a dropped socket recovers
    // without a reload.
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        const book = bookFrom(conn);
        writeLocal(book);
        onChange(book);
      });
      conn.db.night.onInsert(push);
      conn.db.night.onUpdate(push);
      conn.db.night.onDelete(push);
      conn.db.meta.onInsert(push);
      conn.db.meta.onUpdate(push);
      conn.db.joke.onInsert(push);
      conn.db.joke.onUpdate(push);
      conn.db.joke.onDelete(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },
};

export function getBackend(): Backend {
  return isCloud ? cloudBackend : localBackend;
}
