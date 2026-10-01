"use client";

import { useEffect } from "react";
import { CARDS, DISC, discFor, pieceFor, pieceName } from "@/lib/art/pieces";
import { GLYPH } from "@/lib/art/palette";
import { STICKER_SHEET } from "@/lib/art/stickers";
import { INK } from "@/lib/art/palette";
import { DECKS } from "@/lib/decks";
import type { BoardKind } from "@/lib/types";
import type { useBoard } from "@/lib/useBoard";
import type { useGames } from "@/lib/useGames";
import type { Scrapbook } from "@/lib/useScrapbook";
import { Icon } from "../Icon";
import { PixelSprite } from "../PixelSprite";
import { FourInARow, Pairs, TicTacToe } from "./boards";
import { Deck } from "./Deck";
import { Doodle } from "./Doodle";
import { displayName } from "@/lib/couple";
import { MOON, STAR } from "@/lib/auth";

type Games = ReturnType<typeof useGames>;
type Boards = ReturnType<typeof useBoard>;

interface Props {
  who: string;
  gs: Games;
  bd: Boards;
  story: Scrapbook;
  onClose: () => void;
  /** True when this is riding inside the call rather than standing alone. */
  embedded?: boolean;
}

const PLAY: { kind: Exclude<BoardKind, "">; name: string; blurb: string }[] = [
  { kind: "ttt", name: "Tic-tac-toe", blurb: "Moons against stars. Three in a row wins." },
  { kind: "four", name: "Four in a row", blurb: "Drop a piece down a column. Line up four." },
  { kind: "pairs", name: "Pairs", blurb: "Turn over two cards. Find the ones that match." },
  { kind: "doodle", name: "Doodle", blurb: "One canvas, and both of you drawing on it." },
];

function Cover({ kind }: { kind: string }) {
  if (kind === "ttt") {
    const piece = pieceFor(STAR);
    return <PixelSprite rows={piece.rows} palette={piece.palette} width={36} />;
  }
  if (kind === "four") return <PixelSprite rows={DISC} palette={discFor(MOON)} width={34} />;
  if (kind === "pairs") return <PixelSprite rows={STICKER_SHEET.HEART} palette={INK} width={36} />;
  if (kind === "doodle") return <Icon name="pencil" size={34} />;
  return <PixelSprite rows={CARDS} palette={GLYPH} width={34} />;
}

/** What to call the state of the board, in a sentence. */
function status(bd: Boards): string {
  if (bd.board.kind === "doodle") return "Both of you can draw at once";
  if (bd.outcome === "won") return "You won";
  if (bd.outcome === "lost") return `${displayName(bd.partner)} won`;
  if (bd.outcome === "draw") return "Nobody won this one";
  if (bd.peeking) return "Not a match";
  return bd.myTurn ? "Your turn" : `${displayName(bd.partner)}'s turn`;
}

function Chooser({ gs, bd }: { gs: Games; bd: Boards }) {
  const busy = gs.busy || bd.busy;
  return (
    <div className="arc-menu">
      <p className="label label-brass">Play</p>
      <div className="arc-shelf">
        {PLAY.map((game) => (
          <button
            key={game.kind}
            className="arc-tile"
            disabled={busy}
            onClick={() => void bd.start(game.kind)}
          >
            <span className="arc-tile-art">
              <Cover kind={game.kind} />
            </span>
            <span className="arc-tile-name">{game.name}</span>
            <span className="label">{game.blurb}</span>
          </button>
        ))}
      </div>

      <p className="label label-brass">Talk</p>
      <div className="arc-shelf">
        {DECKS.map((deck) => (
          <button
            key={deck.kind}
            className="arc-tile"
            disabled={busy}
            onClick={() => void gs.start(deck.kind)}
          >
            <span className="arc-tile-art">
              <Cover kind="deck" />
            </span>
            <span className="arc-tile-name">{deck.name}</span>
            <span className="label">{deck.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Score({ bd, who }: { bd: Boards; who: string }) {
  const { kind } = bd.board;
  const mine = pieceFor(who);
  return (
    <div className="arc-score">
      {kind === "pairs" ? (
        <p className="label">
          Pairs found: you {who === bd.board.first ? bd.board.scoreFirst : bd.board.scoreSecond},{" "}
          {displayName(bd.partner)} {who === bd.board.first ? bd.board.scoreSecond : bd.board.scoreFirst}
        </p>
      ) : (
        <p className="label arc-you">
          {kind === "ttt" ? (
            <PixelSprite rows={mine.rows} palette={mine.palette} width={18} />
          ) : (
            <PixelSprite rows={DISC} palette={discFor(who)} width={18} />
          )}
          You are {kind === "ttt" ? pieceName(who) : who === MOON ? "rose" : "brass"}
        </p>
      )}
      <p className="label">
        Games won: you {bd.score.mine}, {displayName(bd.partner)} {bd.score.theirs}
        {bd.score.draws > 0 ? `, drawn ${bd.score.draws}` : ""}
      </p>
    </div>
  );
}

export function Arcade({ who, gs, bd, story, onClose, embedded = false }: Props) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const deck = DECKS.find((d) => d.kind === gs.game.kind);
  const game = PLAY.find((g) => g.kind === bd.board.kind);
  const available = gs.available && bd.available;

  const title = deck ? deck.name : game ? game.name : "Games";
  const line = deck
    ? `Round ${gs.game.round}${gs.turnBased ? `, ${displayName(gs.game.turn)}'s turn` : ""}`
    : game
      ? status(bd)
      : "Pick something to do together";

  const body = (
    <div
      className={`arcade${embedded ? " embedded" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="chat-head">
        <div>
          <p className="section-title arc-title">{title}</p>
          <p className={`label${game && bd.myTurn ? " label-brass" : ""}`} role="status">
            {line}
          </p>
        </div>
        <button className="ghost-btn" onClick={onClose} aria-label="Close games">
          Close
        </button>
      </header>

      {!available && (
        <p className="chat-offline label">
          Games need the shared server, and this device is not connected to one.
        </p>
      )}

      {available && !deck && !game && <Chooser gs={gs} bd={bd} />}

      {available && deck && (
        <>
          <Deck gs={gs} who={who} />
          <footer className="arc-foot">
            <button className="px-btn" disabled={gs.busy} onClick={() => void gs.next()}>
              Next card
            </button>
            <button className="ghost-btn" onClick={() => void gs.end()}>
              Put them away
            </button>
          </footer>
        </>
      )}

      {available && !deck && game && (
        <>
          {game.kind === "ttt" && <TicTacToe bd={bd} />}
          {game.kind === "four" && <FourInARow bd={bd} />}
          {game.kind === "pairs" && <Pairs bd={bd} />}
          {game.kind === "doodle" && <Doodle who={who} story={story} />}

          {game.kind !== "doodle" && <Score bd={bd} who={who} />}

          <footer className="arc-foot">
            {bd.over && (
              <button className="px-btn" disabled={bd.busy} onClick={() => void bd.start(game.kind)}>
                Play again
              </button>
            )}
            <button className="ghost-btn" onClick={() => void bd.end()}>
              {game.kind === "doodle" ? "Pick something else" : "Put it away"}
            </button>
          </footer>
        </>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="scrim chat-scrim" onClick={onClose} role="dialog" aria-modal="true">
      {body}
    </div>
  );
}
