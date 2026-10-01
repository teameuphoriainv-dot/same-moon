"use client";

import { useEffect, useState } from "react";
import type { useGames } from "@/lib/useGames";
import { displayName } from "@/lib/couple";

type Games = ReturnType<typeof useGames>;

/** The open-ended deck needs somewhere to write. */
function WrittenAnswer({ gs }: { gs: Games }) {
  const [draft, setDraft] = useState("");

  // A new card means a blank sheet.
  useEffect(() => {
    setDraft("");
  }, [gs.game.round]);

  if (gs.myAnswer) return null;

  return (
    <form
      className="deck-write"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) void gs.answer(draft);
      }}
    >
      <textarea
        className="chat-field"
        value={draft}
        rows={3}
        maxLength={500}
        placeholder="Your answer"
        aria-label="Your answer"
        onChange={(e) => setDraft(e.target.value)}
      />
      <button className="px-btn" type="submit" disabled={!draft.trim()}>
        Lock it in
      </button>
    </form>
  );
}

function Options({ gs }: { gs: Games }) {
  if (gs.myAnswer) return null;
  return (
    <div className="deck-options">
      {gs.game.options.map((option) => (
        <button key={option} className="px-btn deck-option" onClick={() => void gs.answer(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function Reveal({ gs, who }: { gs: Games; who: string }) {
  if (!gs.revealed) {
    return gs.myAnswer ? (
      <p className="deck-waiting label">
        Locked in. Waiting on {displayName(gs.partner)}.
        <button className="ghost-btn" onClick={() => void gs.reveal()}>
          Show anyway
        </button>
      </p>
    ) : null;
  }

  // Only one of them acts in a turn-based round, so a two column comparison
  // would just be somebody's name over the words "no answer".
  if (gs.turnBased) {
    const actor = gs.game.turn;
    const result = (actor === who ? gs.myAnswer : gs.theirAnswer) ?? "no answer";
    return (
      <div className="deck-reveal">
        <div className="deck-answer">
          <p className="label">{actor}</p>
          <p className="deck-answer-text">{result}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deck-reveal">
      {gs.matched && <p className="label label-brass">You both said the same thing.</p>}
      <div className="deck-answers">
        <div className="deck-answer">
          <p className="label">{displayName(who)}</p>
          <p className="deck-answer-text">{gs.myAnswer ?? "no answer"}</p>
        </div>
        <div className="deck-answer">
          <p className="label">{displayName(gs.partner)}</p>
          <p className="deck-answer-text">{gs.theirAnswer ?? "no answer"}</p>
        </div>
      </div>
    </div>
  );
}

/** One of the four talking games: a card is dealt, and they answer it. */
export function Deck({ gs, who }: { gs: Games; who: string }) {
  const theirTurn = gs.turnBased && !gs.myTurn;

  return (
    <div className="deck">
      {/* Keyed on the round, so every new card is dealt rather than swapped. */}
      <div className="deck-card" key={gs.game.round}>
        <span className="label deck-card-round">Card {gs.game.round}</span>
        <p className="deck-card-words">{gs.game.prompt}</p>
      </div>

      {theirTurn ? (
        <p className="deck-waiting label">
          {displayName(gs.game.turn)} is up.{gs.revealed ? "" : " Watch."}
        </p>
      ) : gs.game.options.length > 0 ? (
        <Options gs={gs} />
      ) : (
        <WrittenAnswer gs={gs} />
      )}

      <Reveal gs={gs} who={who} />

      {gs.myScore && gs.myScore.rounds > 0 && (
        <p className="label">
          Matched {gs.myScore.matches} of {gs.myScore.rounds}
        </p>
      )}
    </div>
  );
}
