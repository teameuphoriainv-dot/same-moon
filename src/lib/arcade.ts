"use client";

import { coalesce, isCloud, onReady, withConn } from "./conn";
import {
  BLANK_DOODLE,
  IDLE_BOARD,
  type BoardKind,
  type BoardState,
  type DoodleState,
  type Tally,
} from "./types";

export { encodeStrokes } from "./strokes";

/**
 * The board games and the shared canvas.
 *
 * Unlike the card decks, none of the rules live on this side. A phone asks to
 * play a square and the server decides whether it may, so two taps landing at
 * the same moment can never leave the two phones looking at different boards.
 */

const noop = () => () => {};

function list(raw: string): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

const KINDS = new Set(["ttt", "four", "pairs", "doodle"]);

export const boards = {
  available: isCloud,

  watch(cb: (state: { board: BoardState; tallies: Tally[] }) => void): () => void {
    if (!isCloud) return noop();
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        const row = [...conn.db.board.iter()][0];
        const board: BoardState = row
          ? {
              kind: (KINDS.has(row.kind) ? row.kind : "") as BoardKind,
              round: Number(row.round),
              cells: row.cells,
              faces: row.faces,
              turn: row.turn,
              first: row.first,
              second: row.second,
              winner: row.winner,
              line: list(row.line),
              moves: row.moves,
              open: list(row.open),
              scoreFirst: row.scoreFirst,
              scoreSecond: row.scoreSecond,
            }
          : IDLE_BOARD;
        const tallies: Tally[] = [...conn.db.board_tally.iter()].map((t) => ({
          kind: t.kind,
          who: t.who,
          wins: Number(t.wins),
        }));
        cb({ board, tallies });
      });
      conn.db.board.onInsert(push);
      conn.db.board.onUpdate(push);
      conn.db.board_tally.onInsert(push);
      conn.db.board_tally.onUpdate(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },

  async start(kind: BoardKind, who: string) {
    await withConn((conn) => conn.reducers.boardStart({ kind, who }));
  },
  async move(round: number, who: string, pos: number) {
    await withConn((conn) => conn.reducers.boardMove({ round: BigInt(round), who, pos }));
  },
  async settle(round: number, moves: number) {
    await withConn((conn) => conn.reducers.boardSettle({ round: BigInt(round), moves }));
  },
  async end() {
    await withConn((conn) => conn.reducers.boardEnd({}));
  },
};

export const doodles = {
  available: isCloud,

  watch(cb: (state: DoodleState) => void): () => void {
    if (!isCloud) return noop();
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        const row = [...conn.db.doodle.iter()][0];
        cb(
          row
            ? {
                size: row.size,
                cells: row.cells,
                sheet: Number(row.sheet),
                prompt: row.prompt,
                by: row.by,
              }
            : BLANK_DOODLE,
        );
      });
      conn.db.doodle.onInsert(push);
      conn.db.doodle.onUpdate(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },

  async paint(sheet: number, who: string, strokes: string) {
    await withConn((conn) => conn.reducers.doodlePaint({ sheet: BigInt(sheet), who, strokes }));
  },
  async clear(who: string) {
    await withConn((conn) => conn.reducers.doodleClear({ who }));
  },
  async prompt(prompt: string) {
    await withConn((conn) => conn.reducers.doodlePrompt({ prompt }));
  },
};
