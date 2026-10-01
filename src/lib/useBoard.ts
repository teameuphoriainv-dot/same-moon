"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { boards } from "./arcade";
import { partnerOf } from "./auth";
import { IDLE_BOARD, type BoardKind, type BoardState, type Tally } from "./types";

/** How long two cards that did not match stay face up before they turn back. */
const PEEK_MS = 1300;

export type Outcome = "" | "won" | "lost" | "draw";

export function useBoard(who: string | null) {
  const [board, setBoard] = useState<BoardState>(IDLE_BOARD);
  const [tallies, setTallies] = useState<Tally[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      boards.watch((next) => {
        setBoard(next.board);
        setTallies(next.tallies);
      }),
    [],
  );

  const partner = who ? partnerOf(who) : "";
  const playing = Boolean(board.kind);
  const over = Boolean(board.winner);

  /** Two cards are up and did not match. Nobody moves until they go back. */
  const peeking = board.kind === "pairs" && board.open.length >= 2 && !over;
  const myTurn = playing && !over && !peeking && board.turn === who;

  // Both phones ask for the cards to be turned back. The server only does it
  // once, so it does not matter which of them gets there first.
  useEffect(() => {
    if (!peeking) return;
    const timer = setTimeout(() => void boards.settle(board.round, board.moves), PEEK_MS);
    return () => clearTimeout(timer);
  }, [peeking, board.round, board.moves]);

  const outcome: Outcome = !over
    ? ""
    : board.winner === "draw"
      ? "draw"
      : board.winner === who
        ? "won"
        : "lost";

  /** The running score for whichever game is out. */
  const score = useMemo(() => {
    const of = (name: string) =>
      tallies.find((t) => t.kind === board.kind && t.who === name)?.wins ?? 0;
    return { mine: of(who ?? ""), theirs: of(partner), draws: of("draw") };
  }, [tallies, board.kind, who, partner]);

  const start = useCallback(
    async (kind: BoardKind) => {
      if (!who || !kind) return;
      setBusy(true);
      try {
        await boards.start(kind, who);
      } finally {
        setBusy(false);
      }
    },
    [who],
  );

  const move = useCallback(
    (pos: number) => {
      if (!who || !playing || over) return;
      void boards.move(board.round, who, pos);
    },
    [who, playing, over, board.round],
  );

  const end = useCallback(async () => {
    await boards.end();
  }, []);

  return {
    available: boards.available,
    board,
    playing,
    over,
    peeking,
    myTurn,
    /** "a" if this person opened the match, "b" otherwise. */
    myPiece: who === board.first ? "a" : "b",
    outcome,
    score,
    partner,
    busy,
    start,
    move,
    end,
  };
}
