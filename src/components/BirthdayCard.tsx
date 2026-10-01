"use client";

import { useEffect, useMemo, useState } from "react";
import { CANDLES, HONOREE, LETTER, SIGNED } from "@/lib/birthday";
import { longDate } from "@/lib/dates";
import { moonPhaseForDay } from "@/lib/moon";
import { PixelMoon } from "./PixelMoon";
import { CAKE, CANDLE_LIT, CANDLE_OUT, PARTY } from "@/lib/sprites";
import { PixelSprite } from "./PixelSprite";

type Stage = "candles" | "wish" | "letter";

const CAKE_WIDTH = 330;
/** Candle sprite is 5 x 12, so this keeps its own aspect without touching the cake grid. */
const CANDLE_WIDTH = 19;

interface BirthdayCardProps {
  day: string;
  /** The current streak, so the letter can say the real number. */
  streak: number;
  totalCalled: number;
  onClose: () => void;
}

export function BirthdayCard({ day, streak, totalCalled, onClose }: BirthdayCardProps) {
  const [out, setOut] = useState<number[]>([]);
  const [stage, setStage] = useState<Stage>("candles");

  const allOut = out.length === CANDLES.length;

  // A beat between the last candle and the wish prompt, so the snuff lands first.
  useEffect(() => {
    if (!allOut || stage !== "candles") return;
    const t = setTimeout(() => setStage("wish"), 900);
    return () => clearTimeout(t);
  }, [allOut, stage]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const burst = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const angle = (i / 34) * Math.PI * 2;
        return {
          dx: Math.cos(angle) * (90 + ((i * 53) % 130)),
          dy: Math.sin(angle) * (90 + ((i * 31) % 130)) - 30,
          delay: ((i * 17) % 20) / 100,
          color: ["#d8a94b", "#f2d287", "#c97b84", "#f4e9d4"][i % 4],
        };
      }),
    [],
  );

  const snuff = (i: number) => {
    setOut((prev) => (prev.includes(i) ? prev : [...prev, i]));
  };

  const revealed = out.map((i) => CANDLES[i]);

  return (
    <div className="bday-scrim" role="dialog" aria-modal="true" aria-label={`Happy birthday ${HONOREE}`}>
      <div className="bday-card">
        <button className="bday-close ghost-btn" onClick={onClose} aria-label="Close">
          Close
        </button>

        <div className="bday-crown">
          <PixelMoon size={78} phase={moonPhaseForDay(day)} cells={18} />
        </div>

        <p className="label label-brass bday-kicker">{longDate(day)}</p>
        <h2 className="bday-title">
          Happy Birthday,
          <br />
          {HONOREE}
        </h2>

        <div className="bday-cake-wrap">
          {stage !== "candles" && (
            <div className="bday-burst" aria-hidden="true">
              {burst.map((b, i) => (
                <span
                  key={i}
                  className="bday-mote"
                  style={
                    {
                      background: b.color,
                      animationDelay: `${b.delay}s`,
                      "--dx": `${b.dx}px`,
                      "--dy": `${b.dy}px`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}

          <div className="bday-cake" style={{ width: CAKE_WIDTH }}>
            <PixelSprite rows={CAKE} palette={PARTY} width={CAKE_WIDTH} />

            <div className="bday-candles">
              {CANDLES.map((c, i) => {
                const isOut = out.includes(i);
                return (
                  <button
                    key={i}
                    className={`bday-candle${isOut ? " is-out" : ""}`}
                    onClick={() => snuff(i)}
                    disabled={isOut}
                    aria-label={isOut ? `${c.title}, blown out` : `Blow out candle ${i + 1}`}
                  >
                    <PixelSprite
                      rows={isOut ? CANDLE_OUT : CANDLE_LIT}
                      palette={PARTY}
                      width={CANDLE_WIDTH}
                    />
                    {isOut && <span className="bday-smoke" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {stage === "candles" && (
          <p className="label bday-hint">
            {out.length === 0
              ? "Tap a candle to blow it out"
              : `${CANDLES.length - out.length} left`}
          </p>
        )}

        {revealed.length > 0 && (
          <ul className="bday-wishes">
            {revealed.map((c, i) => (
              <li key={c.title} className="bday-wish" style={{ animationDelay: `${i * 0.04}s` }}>
                <span className="label label-brass">{c.title}</span>
                <p className="bday-wish-line">{c.line}</p>
              </li>
            ))}
          </ul>
        )}

        {stage === "wish" && (
          <div className="bday-make-wish">
            <p className="bday-wish-prompt">All of them are out. Make a wish.</p>
            <button className="px-btn" onClick={() => setStage("letter")}>
              Wished
            </button>
          </div>
        )}

        {stage === "letter" && (
          <div className="bday-letter">
            {LETTER.map((p, i) => (
              <p key={i} className="bday-letter-line" style={{ animationDelay: `${i * 0.18}s` }}>
                {p}
              </p>
            ))}

            <div className="bday-stat">
              <p className="bday-stat-n">{streak}</p>
              <p className="label">
                {streak === 1 ? "night" : "nights"} in a row, and {totalCalled} called in all
              </p>
            </div>

            <p className="bday-signed">
              <span className="sprite-heart" aria-hidden="true" />
              {SIGNED}
            </p>

            <button className="px-btn" onClick={onClose}>
              Okay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
