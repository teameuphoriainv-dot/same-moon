"use client";

import { useEffect, useRef, useState } from "react";
import { DISC, FACES, discFor, pieceFor } from "@/lib/art/pieces";
import type { useBoard } from "@/lib/useBoard";
import { PixelSprite } from "../PixelSprite";
import { displayName } from "@/lib/couple";

type Boards = ReturnType<typeof useBoard>;

const COLS = 7;
const ROWS = 6;

function ownerOf(bd: Boards, cell: string): string {
  if (cell === "a") return bd.board.first;
  if (cell === "b") return bd.board.second;
  return "";
}

export function TicTacToe({ bd }: { bd: Boards }) {
  const { board } = bd;
  return (
    <div className="ttt">
      {board.cells.split("").map((cell, i) => {
        const owner = ownerOf(bd, cell);
        const piece = owner ? pieceFor(owner) : null;
        const won = board.line.includes(i);
        return (
          <button
            key={i}
            className={`ttt-cell${won ? " is-won" : ""}`}
            disabled={!bd.myTurn || cell !== "."}
            onClick={() => bd.move(i)}
            aria-label={`Square ${i + 1}, ${owner ? displayName(owner) : "empty"}`}
          >
            {piece && (
              <PixelSprite rows={piece.rows} palette={piece.palette} width={60} className="piece" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function FourInARow({ bd }: { bd: Boards }) {
  const { board } = bd;
  const before = useRef(board.cells);
  const [fresh, setFresh] = useState<number | null>(null);

  // Whichever square just filled is the piece that falls.
  useEffect(() => {
    const was = before.current;
    before.current = board.cells;
    let landed: number | null = null;
    if (was.length === board.cells.length) {
      for (let i = 0; i < board.cells.length; i++) {
        if (was[i] === "." && board.cells[i] !== ".") landed = i;
      }
    }
    setFresh(landed);
  }, [board.cells]);

  return (
    <div className="four">
      {Array.from({ length: COLS }, (_, col) => (
        <button
          key={col}
          className="four-col"
          disabled={!bd.myTurn || board.cells[col] !== "."}
          onClick={() => bd.move(col)}
          aria-label={`Drop a piece in column ${col + 1}`}
        >
          {Array.from({ length: ROWS }, (_, row) => {
            const i = row * COLS + col;
            const owner = ownerOf(bd, board.cells[i] ?? ".");
            return (
              <span key={row} className={`four-cell${board.line.includes(i) ? " is-won" : ""}`}>
                {owner && (
                  <span
                    className={`four-disc${fresh === i ? " is-new" : ""}`}
                    style={{ "--fall": row + 1 } as React.CSSProperties}
                  >
                    <PixelSprite rows={DISC} palette={discFor(owner)} width={40} />
                  </span>
                )}
              </span>
            );
          })}
        </button>
      ))}
    </div>
  );
}

export function Pairs({ bd }: { bd: Boards }) {
  const { board } = bd;
  return (
    <div className="pairs">
      {board.faces.split("").map((letter, i) => {
        const face = FACES[letter];
        const owner = ownerOf(bd, board.cells[i] ?? ".");
        const classes = [
          "pair",
          face ? "is-up" : "",
          owner ? `is-kept by-${owner.toLowerCase()}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={i}
            className={classes}
            disabled={!bd.myTurn || Boolean(face)}
            onClick={() => bd.move(i)}
            aria-label={
              face
                ? `Card ${i + 1}, turned over${owner ? `, found by ${owner}` : ""}`
                : `Card ${i + 1}, face down`
            }
          >
            {face && <PixelSprite rows={face.rows} palette={face.palette} width={44} />}
          </button>
        );
      })}
    </div>
  );
}
