"use client";

import { coalesce, isCloud, onReady, withConn } from "./conn";
import {
  IDLE_CALL,
  IDLE_GAME,
  type CallState,
  type CallStatus,
  type GameAnswer,
  type GameKind,
  type GamePhase,
  type GameState,
  type Score,
  type SignalRow,
} from "./types";

/**
 * The realtime surfaces that only exist when there is a server: ringing the
 * other phone, passing the WebRTC handshake between them, and keeping a game
 * in step. None of it has a sensible single-device fallback, so when no module
 * is configured these are inert and the UI hides the buttons.
 */

const noop = () => () => {};

// --- calls ------------------------------------------------------------------

function asStatus(value: string): CallStatus {
  return value === "ringing" || value === "live" ? value : "idle";
}

export const calls = {
  available: isCloud,

  watch(cb: (state: CallState) => void): () => void {
    if (!isCloud) return noop();
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        const row = [...conn.db.call.iter()][0];
        cb(
          row
            ? {
                status: asStatus(row.status),
                caller: row.caller,
                at: Number(row.at.toMillis()),
              }
            : IDLE_CALL,
        );
      });
      conn.db.call.onInsert(push);
      conn.db.call.onUpdate(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },

  /**
   * Watch the handshake mailbox. Rows from `me` are filtered out here rather
   * than in the caller, because a peer that answers its own offer wedges the
   * connection in a way that is miserable to debug.
   */
  watchSignals(me: string, cb: (rows: SignalRow[]) => void): () => void {
    if (!isCloud) return noop();
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        cb(
          [...conn.db.signal.iter()]
            .filter((r) => r.from !== me)
            .map((r) => ({
              id: Number(r.id),
              from: r.from,
              kind: r.kind as SignalRow["kind"],
              payload: r.payload,
            }))
            .sort((a, b) => a.id - b.id),
        );
      });
      conn.db.signal.onInsert(push);
      conn.db.signal.onDelete(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },

  async ring(who: string) {
    await withConn((conn) => conn.reducers.ring({ who }));
  },
  async accept(who: string) {
    await withConn((conn) => conn.reducers.acceptCall({ who }));
  },
  async hangUp() {
    await withConn((conn) => conn.reducers.hangUp({}));
  },
  async signal(from: string, kind: SignalRow["kind"], payload: string) {
    await withConn((conn) => conn.reducers.sendSignal({ from, kind, payload }));
  },
};

// --- games ------------------------------------------------------------------

function parseOptions(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export const games = {
  available: isCloud,

  watch(
    cb: (state: { game: GameState; answers: GameAnswer[]; scores: Score[] }) => void,
  ): () => void {
    if (!isCloud) return noop();
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        const row = [...conn.db.game.iter()][0];
        const game: GameState = row
          ? {
              kind: row.kind as GameKind,
              round: Number(row.round),
              prompt: row.prompt,
              options: parseOptions(row.options),
              phase: (row.phase === "revealed" ? "revealed" : "answering") as GamePhase,
              turn: row.turn,
            }
          : IDLE_GAME;
        const answers: GameAnswer[] = [...conn.db.game_answer.iter()].map((a) => ({
          who: a.who,
          round: Number(a.round),
          answer: a.answer,
        }));
        const scores: Score[] = [...conn.db.game_score.iter()].map((s) => ({
          who: s.who,
          matches: Number(s.matches),
          rounds: Number(s.rounds),
        }));
        cb({ game, answers, scores });
      });
      conn.db.game.onInsert(push);
      conn.db.game.onUpdate(push);
      conn.db.game_answer.onInsert(push);
      conn.db.game_answer.onUpdate(push);
      conn.db.game_answer.onDelete(push);
      conn.db.game_score.onInsert(push);
      conn.db.game_score.onUpdate(push);
      conn.db.game_score.onDelete(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },

  async start(kind: GameKind, prompt: string, options: string[], turn: string) {
    await withConn((conn) =>
      conn.reducers.startGame({
        kind,
        prompt,
        options: options.length ? JSON.stringify(options) : "",
        turn,
      }),
    );
  },
  async next(prompt: string, options: string[], turn: string) {
    await withConn((conn) =>
      conn.reducers.nextRound({
        prompt,
        options: options.length ? JSON.stringify(options) : "",
        turn,
      }),
    );
  },
  async answer(round: number, who: string, answer: string) {
    await withConn((conn) =>
      conn.reducers.submitAnswer({ round: BigInt(round), who, answer }),
    );
  },
  async reveal() {
    await withConn((conn) => conn.reducers.revealRound({}));
  },
  async end() {
    await withConn((conn) => conn.reducers.endGame({}));
  },
};
