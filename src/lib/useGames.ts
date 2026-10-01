"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { partnerOf } from "./auth";
import { draw } from "./decks";
import { games } from "./live";
import {
  IDLE_GAME,
  type GameAnswer,
  type GameKind,
  type GameState,
  type Score,
} from "./types";

export function useGames(who: string | null) {
  const [game, setGame] = useState<GameState>(IDLE_GAME);
  const [answers, setAnswers] = useState<GameAnswer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      games.watch((next) => {
        setGame(next.game);
        setAnswers(next.answers);
        setScores(next.scores);
      }),
    [],
  );

  const partner = who ? partnerOf(who) : "";

  const round = useMemo(
    () => answers.filter((a) => a.round === game.round),
    [answers, game.round],
  );

  const myAnswer = round.find((a) => a.who === who)?.answer ?? null;
  const revealed = game.phase === "revealed";

  /**
   * Their answer is withheld until the round reveals. Filtering it here rather
   * than in the panel means it is never in the rendered markup early, so there
   * is nothing to peek at.
   */
  const theirAnswer = revealed ? round.find((a) => a.who === partner)?.answer ?? null : null;

  /** Truth or dare is one person at a time; everything else is both at once. */
  const turnBased = game.kind === "tod";
  const myTurn = !turnBased || game.turn === who;
  const waitingOnThem = Boolean(myAnswer) && !revealed;

  const matched =
    revealed && myAnswer !== null && theirAnswer !== null && myAnswer === theirAnswer;

  const myScore = scores.find((s) => s.who === who) ?? null;

  const start = useCallback(
    async (kind: GameKind) => {
      if (!who || !kind) return;
      setBusy(true);
      try {
        const card = draw(kind);
        // Whoever opens the game goes first when it takes turns.
        await games.start(kind, card.prompt, card.options, kind === "tod" ? who : "");
      } finally {
        setBusy(false);
      }
    },
    [who],
  );

  const next = useCallback(async () => {
    if (!game.kind) return;
    setBusy(true);
    try {
      const card = draw(game.kind, game.prompt);
      // Pass the turn over, so neither of them gets two dares in a row.
      const turn = game.kind === "tod" ? partnerOf(game.turn || partner) : "";
      await games.next(card.prompt, card.options, turn);
    } finally {
      setBusy(false);
    }
  }, [game.kind, game.prompt, game.turn, partner]);

  const answer = useCallback(
    async (text: string) => {
      if (!who || !game.kind || !text.trim()) return;
      await games.answer(game.round, who, text);
      // Only one of them acts in truth or dare, so there is no second answer
      // coming to trigger the reveal.
      if (game.kind === "tod") await games.reveal();
    },
    [who, game.kind, game.round],
  );

  const reveal = useCallback(async () => {
    await games.reveal();
  }, []);

  const end = useCallback(async () => {
    await games.end();
  }, []);

  return {
    available: games.available,
    game,
    playing: Boolean(game.kind),
    myAnswer,
    theirAnswer,
    revealed,
    matched,
    waitingOnThem,
    myTurn,
    turnBased,
    scores,
    myScore,
    busy,
    partner,
    start,
    next,
    answer,
    reveal,
    end,
  };
}
