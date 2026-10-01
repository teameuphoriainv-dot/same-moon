"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { partnerOf } from "./auth";
import { getStatus, watchStatus, type Status } from "./conn";
import { getThread, type ThreadBackend } from "./thread";
import type { Message, ThreadMessage } from "./types";

export const MAX_MESSAGE_LEN = 1000;

/** How long a `typing` flag from the other side survives without a refresh. */
const TYPING_TTL_MS = 6000;
/** Don't re-announce typing more than this often. */
const TYPING_PING_MS = 2000;
/** Silence for this long means they stopped. */
const TYPING_IDLE_MS = 3000;
/** A sent message with no echo by now is treated as not having landed. */
const SEND_TIMEOUT_MS = 12_000;

/**
 * A message this device has sent but the server has not echoed yet. It is
 * drawn immediately so the thread never swallows what you just typed while a
 * round trip finishes.
 */
interface Pending {
  uid: number;
  body: string;
  at: number;
  /** The newest id at the moment it was queued, so an old message with the
   *  same text cannot be mistaken for this one's echo. */
  afterId: number;
  failed: boolean;
}

let uidSeq = 0;

export function useMessages(who: string | null) {
  const backendRef = useRef<ThreadBackend | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [readBy, setReadBy] = useState<Record<string, number>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Pending[]>([]);
  const [status, setStatus] = useState<Status>(getStatus);

  // --- wiring ---------------------------------------------------------------

  useEffect(() => {
    const backend = getThread();
    backendRef.current = backend;
    const offMessages = backend.subscribeMessages(setMessages);
    const offMarks = backend.subscribeMarks(({ readBy: r, typing: t }) => {
      setReadBy(r);
      setTyping(t);
    });
    const offStatus = watchStatus(setStatus);
    return () => {
      offMessages();
      offMarks();
      offStatus();
    };
  }, []);

  // --- optimistic echoes ----------------------------------------------------

  // Retire a pending message once its real row arrives.
  useEffect(() => {
    setPending((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter(
        (p) =>
          !messages.some((m) => m.by === who && m.id > p.afterId && m.body === p.body),
      );
      return next.length === prev.length ? prev : next;
    });
  }, [messages, who]);

  // Give up waiting on one that never came back, so it can be shown as failed
  // rather than sitting there looking sent.
  useEffect(() => {
    const waiting = pending.filter((p) => !p.failed);
    if (waiting.length === 0) return;
    const oldest = Math.min(...waiting.map((p) => p.at));
    const due = oldest + SEND_TIMEOUT_MS - Date.now();
    const timer = setTimeout(
      () => {
        setPending((prev) =>
          prev.map((p) =>
            !p.failed && Date.now() - p.at >= SEND_TIMEOUT_MS ? { ...p, failed: true } : p,
          ),
        );
      },
      Math.max(250, due),
    );
    return () => clearTimeout(timer);
  }, [pending]);

  const thread = useMemo<ThreadMessage[]>(() => {
    const real = messages.map((m) => ({ ...m, mine: m.by === who, pending: false }));
    if (pending.length === 0) return real;
    const optimistic = pending.map((p) => ({
      id: -p.uid, // negative so it can never collide with a real row id
      body: p.body,
      by: who ?? "",
      at: p.at,
      edited: false,
      mine: true,
      pending: true,
    }));
    return [...real, ...optimistic];
  }, [messages, pending, who]);

  /** Ids of the sends that never landed, so the composer can offer a retry. */
  const failed = useMemo(() => pending.filter((p) => p.failed), [pending]);

  // --- read state -----------------------------------------------------------

  const lastId = messages.length ? messages[messages.length - 1].id : 0;

  const unread = useMemo(() => {
    if (!who) return 0;
    const seen = readBy[who] ?? 0;
    return messages.filter((m) => m.by !== who && m.id > seen).length;
  }, [who, messages, readBy]);

  /** How far the other one has read, for a read mark on your own messages. */
  const partnerSeen = who ? readBy[partnerOf(who)] ?? 0 : 0;

  const markAllRead = useCallback(() => {
    if (!who || lastId === 0) return;
    if ((readBy[who] ?? 0) >= lastId) return;
    void backendRef.current?.markRead(who, lastId);
  }, [who, lastId, readBy]);

  // --- typing ---------------------------------------------------------------

  const lastPing = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partner = who ? partnerOf(who) : "";
  const partnerFlag = Boolean(typing[partner]);

  // Expired on our own clock, so the two devices never have to agree on what
  // time it is. The server refreshes the row on every ping, so this keeps
  // moving for as long as they are actually still typing.
  const [seenAt, setSeenAt] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    if (partnerFlag) setSeenAt(Date.now());
  }, [partnerFlag, typing]);

  useEffect(() => {
    if (!partnerFlag) return;
    const t = setTimeout(() => tick((n) => n + 1), TYPING_TTL_MS);
    return () => clearTimeout(t);
  }, [partnerFlag, seenAt]);

  const partnerTyping = partnerFlag && Date.now() - seenAt < TYPING_TTL_MS;

  const stopTyping = useCallback(() => {
    if (!who) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    lastPing.current = 0;
    void backendRef.current?.setTyping(who, false);
  }, [who]);

  const notifyTyping = useCallback(() => {
    if (!who) return;
    const now = Date.now();
    if (now - lastPing.current > TYPING_PING_MS) {
      lastPing.current = now;
      void backendRef.current?.setTyping(who, true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [who, stopTyping]);

  useEffect(() => stopTyping, [stopTyping]);

  // --- sending --------------------------------------------------------------

  const send = useCallback(
    (text: string) => {
      const clean = text.trim().slice(0, MAX_MESSAGE_LEN);
      if (!clean || !who) return;
      stopTyping();
      setPending((prev) => [
        ...prev,
        {
          uid: (uidSeq += 1),
          body: clean,
          at: Date.now(),
          afterId: messages.length ? messages[messages.length - 1].id : 0,
          failed: false,
        },
      ]);
      void backendRef.current?.send(clean, who);
    },
    [who, stopTyping, messages],
  );

  /** Re-send one that timed out, and drop the failed copy. */
  const retry = useCallback(
    (uid: number) => {
      const item = pending.find((p) => p.uid === uid);
      if (!item || !who) return;
      setPending((prev) =>
        prev.map((p) =>
          p.uid === uid
            ? { ...p, failed: false, at: Date.now(), afterId: lastId }
            : p,
        ),
      );
      void backendRef.current?.send(item.body, who);
    },
    [pending, who, lastId],
  );

  const discard = useCallback((uid: number) => {
    setPending((prev) => prev.filter((p) => p.uid !== uid));
  }, []);

  const edit = useCallback((id: number, text: string) => {
    const clean = text.trim().slice(0, MAX_MESSAGE_LEN);
    if (!clean || id < 0) return; // a pending message has no row to edit yet
    void backendRef.current?.edit(id, clean);
  }, []);

  const remove = useCallback((id: number) => {
    if (id < 0) return;
    void backendRef.current?.remove(id);
  }, []);

  const clearAll = useCallback(() => {
    setPending([]);
    void backendRef.current?.clearAll();
  }, []);

  return {
    messages: thread,
    unread,
    partnerSeen,
    partnerTyping,
    status,
    failed,
    markAllRead,
    notifyTyping,
    send,
    retry,
    discard,
    edit,
    remove,
    clearAll,
  };
}
