"use client";

// Type-only at module scope: the SDK is not SSR-safe, so the value import
// happens lazily inside open(), which only ever runs in the browser.
import type { DbConnection } from "@/module_bindings";

const TOKEN_KEY = "same-moon:stdb-token";
/** Maincloud unless something points elsewhere, which is how a local
 *  SpacetimeDB can be driven without editing this file. */
const HOST = process.env.NEXT_PUBLIC_STDB_HOST || "wss://maincloud.spacetimedb.com";
const MODULE = process.env.NEXT_PUBLIC_STDB_MODULE;

export const isCloud = Boolean(MODULE);

/** The tables the site cannot stand up without. */
const CORE = [
  "SELECT * FROM night",
  "SELECT * FROM meta",
  "SELECT * FROM joke",
  "SELECT * FROM message",
  "SELECT * FROM read_marker",
  "SELECT * FROM presence",
  "SELECT * FROM call",
  "SELECT * FROM signal",
  "SELECT * FROM game",
  "SELECT * FROM game_answer",
  "SELECT * FROM game_score",
  "SELECT * FROM couple",
  "SELECT * FROM plus",
];

/**
 * Everything added since, subscribed on its own.
 *
 * A subscription succeeds or fails as a unit. If these shared one with the
 * tables above, a server that was one version behind would refuse the lot and
 * take the night grid down with it. Kept apart, the newer features go quiet
 * and everything that already worked carries on.
 */
const EXTRAS = [
  "SELECT * FROM pulse",
  "SELECT * FROM scrap",
  "SELECT * FROM scrap_layout",
  "SELECT * FROM board",
  "SELECT * FROM board_tally",
  "SELECT * FROM doodle",
];

export type Status = "offline" | "connecting" | "live";

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 15_000;

let conn: DbConnection | null = null;
let opening: Promise<DbConnection> | null = null;
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let status: Status = "offline";

/**
 * Called with each live connection, including every one after a reconnect.
 *
 * This is the whole point of the module. Row callbacks belong to the socket
 * they were registered on, so when the socket dies they die with it. Anything
 * that wants to stay subscribed registers here instead and gets handed the new
 * connection to re-bind against, which is what stops a dropped websocket from
 * silently freezing the app until a reload.
 */
const readyWatchers = new Set<(c: DbConnection) => void>();
const statusWatchers = new Set<(s: Status) => void>();

function setStatus(next: Status) {
  if (status === next) return;
  status = next;
  for (const watcher of statusWatchers) watcher(status);
}

export function getStatus(): Status {
  return status;
}

export function watchStatus(cb: (s: Status) => void): () => void {
  statusWatchers.add(cb);
  cb(status);
  return () => {
    statusWatchers.delete(cb);
  };
}

/**
 * Register interest in the connection. `cb` runs immediately if one is already
 * live, and again after every reconnect. Returns an unsubscribe.
 */
export function onReady(cb: (c: DbConnection) => void): () => void {
  readyWatchers.add(cb);
  if (conn) cb(conn);
  else void open();
  return () => {
    readyWatchers.delete(cb);
  };
}

function scheduleRetry() {
  if (retryTimer) return;
  const wait = Math.min(FIRST_RETRY_MS * 2 ** retries, MAX_RETRY_MS);
  retries += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void open();
  }, wait);
}

function teardown() {
  conn = null;
  opening = null;
  setStatus("offline");
  if (readyWatchers.size > 0) scheduleRetry();
}

/**
 * Open the connection, or hand back the one already opening. Failures are not
 * thrown at callers; they reconnect in the background and every `onReady`
 * watcher is re-run when they succeed, so the UI recovers on its own.
 */
export function open(): Promise<DbConnection> | null {
  if (!MODULE) return null;
  if (conn) return Promise.resolve(conn);
  if (opening) return opening;

  setStatus("connecting");
  opening = (async () => {
    const { DbConnection } = await import("@/module_bindings");
    return new Promise<DbConnection>((resolve, reject) => {
      const saved = window.localStorage.getItem(TOKEN_KEY) ?? undefined;
      DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(MODULE)
        .withToken(saved)
        .onConnect((c, _identity, token) => {
          window.localStorage.setItem(TOKEN_KEY, token);
          c.subscriptionBuilder()
            .onApplied(() => {
              conn = c;
              opening = null;
              retries = 0;
              setStatus("live");
              // Re-bind everyone. On a first connect this is the initial
              // subscribe; on a reconnect it is how they recover.
              for (const watcher of readyWatchers) watcher(c);
              resolve(c);
            })
            .subscribe(CORE);
          c.subscriptionBuilder()
            .onError((ctx) => {
              console.warn("[same-moon] the newer tables are not there yet", ctx.event);
            })
            .subscribe(EXTRAS);
        })
        .onDisconnect(() => {
          // The bug this exists to kill: without it the promise below stayed
          // resolved forever against a dead socket, so every later write went
          // nowhere and the app looked frozen until a reload.
          teardown();
        })
        .onConnectError((_ctx, err) => {
          console.warn("[same-moon] connection failed", err);
          teardown();
          reject(err);
        })
        .build();
    });
  })();

  // A rejection here is already handled by teardown/retry; swallow it so it
  // does not surface as an unhandled rejection.
  opening.catch(() => {});
  return opening;
}

/**
 * Run something against a live connection, or do nothing if there is not one.
 * Writes are fire-and-forget by nature here: the subscription is what confirms
 * them, not the return value.
 */
export async function withConn<T>(fn: (c: DbConnection) => T): Promise<T | null> {
  if (conn) return fn(conn);
  const p = open();
  if (!p) return null;
  try {
    return fn(await p);
  } catch {
    return null;
  }
}

/**
 * Collapse a burst of row callbacks into one update per tick.
 *
 * The SDK fires a callback per row, so the initial subscription alone lands
 * forty-odd nights as forty-odd separate events, each one previously rebuilding
 * and re-rendering the whole view. A microtask is enough: every row of a batch
 * is applied synchronously, so they have all landed by the time this runs.
 */
export function coalesce(fn: () => void): () => void {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      fn();
    });
  };
}
