"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { partnerOf } from "@/lib/auth";
import { MAX_MESSAGE_LEN, type useMessages } from "@/lib/useMessages";
import type { Presence } from "@/lib/usePresence";
import type { ThreadMessage } from "@/lib/types";
import { PresenceChip } from "./PresenceChip";
import { displayName } from "@/lib/couple";

type Messaging = ReturnType<typeof useMessages>;

interface Props {
  who: string;
  chat: Messaging;
  presence: Presence;
  onClose: () => void;
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function dayLabel(at: number): string {
  const then = new Date(at);
  const now = new Date();
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  return sameDay ? "Today" : dayFormat.format(then);
}

/** How close to the bottom still counts as "following along". */
const STICK_PX = 80;
/** The composer stops growing here and starts scrolling instead. */
const COMPOSER_MAX_PX = 140;

function Bubble({
  message,
  seen,
  onEdit,
  onRemove,
  onRetry,
  onDiscard,
}: {
  message: ThreadMessage;
  seen: boolean;
  onEdit: (id: number, text: string) => void;
  onRemove: (id: number) => void;
  onRetry: (uid: number) => void;
  onDiscard: (uid: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);

  const commit = () => {
    const clean = draft.trim();
    if (clean && clean !== message.body) onEdit(message.id, clean);
    setEditing(false);
  };

  // A pending message carries the negative of its queue id, which is what the
  // retry and discard controls need back.
  const uid = -message.id;

  return (
    <li className={`bubble-row ${message.mine ? "mine" : "theirs"}`}>
      <div className={`bubble${message.pending ? " pending" : ""}`}>
        {editing ? (
          <div className="bubble-edit">
            <textarea
              className="bubble-edit-field"
              value={draft}
              maxLength={MAX_MESSAGE_LEN}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <div className="bubble-tools">
              <button className="ghost-btn" onClick={commit}>
                Save
              </button>
              <button className="ghost-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="bubble-text">{message.body}</p>
        )}

        <div className="bubble-meta">
          <span className="label">{timeFormat.format(new Date(message.at))}</span>
          {message.edited && <span className="label">edited</span>}
          {message.pending && <span className="label">sending</span>}
          {message.mine && !message.pending && seen && (
            <span className="label label-brass">read</span>
          )}
          {message.mine && !message.pending && !editing && (
            <>
              <button
                className="bubble-act"
                onClick={() => {
                  setDraft(message.body);
                  setEditing(true);
                }}
              >
                edit
              </button>
              <button className="bubble-act" onClick={() => onRemove(message.id)}>
                delete
              </button>
            </>
          )}
          {message.pending && (
            <>
              <button className="bubble-act" onClick={() => onRetry(uid)}>
                retry
              </button>
              <button className="bubble-act" onClick={() => onDiscard(uid)}>
                discard
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function MessageSheet({ who, chat, presence, onClose }: Props) {
  // Display only: every use below is text on screen.
  const partner = displayName(partnerOf(who));
  const listRef = useRef<HTMLUListElement | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // Reading it is what marks it read, so this runs whenever the thread moves
  // while the sheet is open.
  const { markAllRead } = chat;
  useEffect(() => {
    markAllRead();
  }, [markAllRead, chat.messages.length]);

  /**
   * Stay pinned to the newest message, but only while they are already at the
   * bottom. Scrolling up to read something older used to get yanked back down
   * by the next event, and the old scrollIntoView moved the whole page rather
   * than the thread.
   */
  const stick = useRef(true);
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, chat.partnerTyping]);

  // Grow the composer with the message instead of hiding it behind one line.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [draft]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    setDraft("");
    stick.current = true;
    chat.send(clean);
  };

  let lastDay = "";

  // Typing is the most useful thing to know, then whether they are around at
  // all. "Synced" is only said when there is nothing better to say.
  const subtitle =
    chat.status === "live"
      ? chat.partnerTyping
        ? "typing"
        : presence.label
          ? null
          : "synced"
      : chat.status === "connecting"
        ? "reconnecting"
        : "offline";

  return (
    <div className="scrim chat-scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
        <header className="chat-head">
          <div>
            <p className="serif chat-title">{partner}</p>
            {subtitle === null ? (
              <PresenceChip presence={presence} compact />
            ) : (
              <p className="label">{subtitle}</p>
            )}
          </div>
          <button className="ghost-btn" onClick={onClose} aria-label="Close messages">
            Close
          </button>
        </header>

        {chat.status !== "live" && (
          <p className="chat-offline label">
            {chat.status === "connecting"
              ? "Reconnecting. Anything you send will go out when it lands."
              : "Offline. Messages will wait here."}
          </p>
        )}

        <ul className="chat-thread" ref={listRef} onScroll={onScroll}>
          {chat.messages.length === 0 && (
            <li className="chat-empty label">Nothing here yet. Say something.</li>
          )}
          {chat.messages.map((m) => {
            const day = dayLabel(m.at);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <Fragment key={m.id}>
                {showDay && <li className="chat-day label">{day}</li>}
                <Bubble
                  message={m}
                  seen={chat.partnerSeen >= m.id}
                  onEdit={chat.edit}
                  onRemove={chat.remove}
                  onRetry={chat.retry}
                  onDiscard={chat.discard}
                />
              </Fragment>
            );
          })}
          {chat.partnerTyping && (
            <li className="bubble-row theirs">
              <div className="bubble typing">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </li>
          )}
        </ul>

        <form className="chat-composer" onSubmit={submit}>
          <textarea
            ref={fieldRef}
            className="chat-field"
            value={draft}
            maxLength={MAX_MESSAGE_LEN}
            rows={1}
            placeholder={`Message ${partner}`}
            aria-label={`Message ${partner}`}
            onChange={(e) => {
              setDraft(e.target.value);
              chat.notifyTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
          />
          <button className="px-btn" type="submit" disabled={!draft.trim()}>
            Send
          </button>
        </form>

        <footer className="chat-foot">
          {confirmClear ? (
            <>
              <span className="label">Erase every message for both of you?</span>
              <button
                className="ghost-btn"
                onClick={() => {
                  chat.clearAll();
                  setConfirmClear(false);
                }}
              >
                Erase
              </button>
              <button className="ghost-btn" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="ghost-btn" onClick={() => setConfirmClear(true)}>
              Clear thread
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
