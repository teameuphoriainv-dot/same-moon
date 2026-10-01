"use client";

import type { DbConnection } from "@/module_bindings";
import { coalesce, isCloud, onReady, withConn } from "./conn";
import type { Message } from "./types";

const THREAD_KEY = "same-moon:thread";

/**
 * Messages and the marks around them are subscribed separately.
 *
 * They used to arrive as one object rebuilt on any change, so a typing ping
 * every couple of seconds re-created every message object and re-rendered the
 * entire thread. Keeping them apart means a typing flag moves a typing flag and
 * nothing else, which is most of what made the thread feel unstable.
 */
export interface ThreadBackend {
  subscribeMessages(cb: (messages: Message[]) => void): () => void;
  subscribeMarks(
    cb: (marks: { readBy: Record<string, number>; typing: Record<string, boolean> }) => void,
  ): () => void;
  send(body: string, by: string): Promise<void>;
  edit(id: number, body: string): Promise<void>;
  remove(id: number): Promise<void>;
  markRead(who: string, lastSeen: number): Promise<void>;
  setTyping(who: string, typing: boolean): Promise<void>;
  clearAll(): Promise<void>;
}

// ---------------------------------------------------------------------------
// local
// ---------------------------------------------------------------------------

interface LocalThread {
  messages: Message[];
  readBy: Record<string, number>;
  typing: Record<string, boolean>;
}

const EMPTY_LOCAL: LocalThread = { messages: [], readBy: {}, typing: {} };

function readLocal(): LocalThread {
  if (typeof window === "undefined") return EMPTY_LOCAL;
  try {
    const raw = window.localStorage.getItem(THREAD_KEY);
    if (!raw) return EMPTY_LOCAL;
    const parsed = JSON.parse(raw) as LocalThread;
    return {
      messages: parsed.messages ?? [],
      readBy: parsed.readBy ?? {},
      typing: parsed.typing ?? {},
    };
  } catch {
    return EMPTY_LOCAL;
  }
}

/**
 * `storage` only ever fires for *other* tabs, so this tab is told by hand.
 * Without it a write made here would never come back, which is the shape of
 * bug that used to leave the old key gate stuck.
 */
const localWatchers = new Set<() => void>();

function writeLocal(thread: LocalThread) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THREAD_KEY, JSON.stringify(thread));
  for (const w of localWatchers) w();
}

function watchLocal(cb: () => void): () => void {
  localWatchers.add(cb);
  const cross = (e: StorageEvent) => {
    if (e.key === THREAD_KEY) cb();
  };
  window.addEventListener("storage", cross);
  cb();
  return () => {
    localWatchers.delete(cb);
    window.removeEventListener("storage", cross);
  };
}

const localThread: ThreadBackend = {
  subscribeMessages(cb) {
    if (typeof window === "undefined") return () => {};
    return watchLocal(() => cb(readLocal().messages));
  },
  subscribeMarks(cb) {
    if (typeof window === "undefined") return () => {};
    return watchLocal(() => {
      const { readBy, typing } = readLocal();
      cb({ readBy, typing });
    });
  },
  async send(body, by) {
    const t = readLocal();
    const id = t.messages.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    writeLocal({
      ...t,
      messages: [...t.messages, { id, body, by, at: Date.now(), edited: false }],
      typing: { ...t.typing, [by]: false },
    });
  },
  async edit(id, body) {
    const t = readLocal();
    writeLocal({
      ...t,
      messages: t.messages.map((m) => (m.id === id ? { ...m, body, edited: true } : m)),
    });
  },
  async remove(id) {
    const t = readLocal();
    writeLocal({ ...t, messages: t.messages.filter((m) => m.id !== id) });
  },
  async markRead(who, lastSeen) {
    const t = readLocal();
    if ((t.readBy[who] ?? 0) >= lastSeen) return;
    writeLocal({ ...t, readBy: { ...t.readBy, [who]: lastSeen } });
  },
  async setTyping(who, typing) {
    const t = readLocal();
    if (Boolean(t.typing[who]) === typing) return;
    writeLocal({ ...t, typing: { ...t.typing, [who]: typing } });
  },
  async clearAll() {
    writeLocal({ messages: [], readBy: {}, typing: {} });
  },
};

// ---------------------------------------------------------------------------
// spacetimedb
// ---------------------------------------------------------------------------

function messagesFrom(conn: DbConnection): Message[] {
  return [...conn.db.message.iter()]
    .map((row) => ({
      id: Number(row.id),
      body: row.body,
      by: row.by,
      at: Number(row.at.toMillis()),
      edited: row.edited,
    }))
    .sort((a, b) => a.id - b.id);
}

const cloudThread: ThreadBackend = {
  subscribeMessages(cb) {
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (live) cb(messagesFrom(conn));
      });
      conn.db.message.onInsert(push);
      conn.db.message.onUpdate(push);
      conn.db.message.onDelete(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },
  subscribeMarks(cb) {
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        const readBy: Record<string, number> = {};
        for (const row of conn.db.read_marker.iter()) readBy[row.who] = Number(row.lastSeen);
        const typing: Record<string, boolean> = {};
        for (const row of conn.db.presence.iter()) typing[row.who] = row.typing;
        cb({ readBy, typing });
      });
      conn.db.read_marker.onInsert(push);
      conn.db.read_marker.onUpdate(push);
      conn.db.presence.onInsert(push);
      conn.db.presence.onUpdate(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },
  async send(body, by) {
    await withConn((conn) => conn.reducers.sendMessage({ body, by }));
  },
  async edit(id, body) {
    await withConn((conn) => conn.reducers.editMessage({ id: BigInt(id), body }));
  },
  async remove(id) {
    await withConn((conn) => conn.reducers.deleteMessage({ id: BigInt(id) }));
  },
  async markRead(who, lastSeen) {
    await withConn((conn) => conn.reducers.markRead({ who, lastSeen: BigInt(lastSeen) }));
  },
  async setTyping(who, typing) {
    await withConn((conn) => conn.reducers.setTyping({ who, typing }));
  },
  async clearAll() {
    await withConn((conn) => conn.reducers.clearThread({}));
  },
};

export function getThread(): ThreadBackend {
  return isCloud ? cloudThread : localThread;
}
