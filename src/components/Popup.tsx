"use client";

import { useEffect, useRef, useState } from "react";
import { justHit } from "@/lib/milestones";
import { moonPhaseForDay } from "@/lib/moon";
import { PixelMoon } from "./PixelMoon";
import { displayName } from "@/lib/couple";
import { MOON, STAR } from "@/lib/auth";

/**
 * Shown only until they fill the inside-joke library, which replaces these.
 * One word each, because it is rendered large.
 */
const DEFAULT_WORDS = ["selp", "again", "nice", "yes", "good", "logged"];

const CURSOR_KEY = "same-moon:joke-cursor";

/**
 * Walks the library in order rather than picking at random, so every joke gets
 * its turn and the same one never lands twice in a row.
 */
function nextJoke(pool: string[]): string {
  if (pool.length === 0) return "";
  if (typeof window === "undefined") return pool[0];
  const raw = Number(window.localStorage.getItem(CURSOR_KEY));
  const i = (Number.isFinite(raw) && raw >= 0 ? raw : 0) % pool.length;
  window.localStorage.setItem(CURSOR_KEY, String(i + 1));
  return pool[i];
}

interface PopupProps {
  count: number;
  day: string;
  /** Their inside jokes. Takes over from the defaults as soon as there is one. */
  jokes: string[];
  onClose: () => void;
}

export function Popup({ count, day, jokes, onClose }: PopupProps) {
  const milestone = justHit(count);
  const [word, setWord] = useState("");
  const picked = useRef(false);

  // Chosen once per popup, in an effect so StrictMode's double render in dev
  // cannot advance the cursor twice.
  useEffect(() => {
    if (picked.current) return;
    picked.current = true;
    setWord(nextJoke(jokes.length > 0 ? jokes : DEFAULT_WORDS));
  }, [jokes]);

  useEffect(() => {
    const t = setTimeout(onClose, milestone ? 6500 : 4500);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose, milestone]);

  return (
    <div className="pop" onClick={onClose} role="dialog" aria-modal="true">
      {/* Hearts drift up behind the card. */}
      <div className="pop-hearts" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className="sprite-heart pop-float"
            style={{
              left: `${8 + i * 10.5}%`,
              animationDelay: `${i * 0.16}s`,
              // Varied speed instead of scale: the drift keyframes own transform.
              animationDuration: `${3 + ((i * 37) % 16) / 10}s`,
            }}
          />
        ))}
      </div>

      <div className="pop-card" onClick={(e) => e.stopPropagation()}>
        <PixelMoon size={92} phase={moonPhaseForDay(day)} cells={18} />

        <p className="pop-names">
          {displayName(MOON)}
          <span className="sprite-heart pop-amp" aria-hidden="true" />
          {displayName(STAR)}
        </p>

        <p className="pop-count">{count}</p>
        <p className="label">{count === 1 ? "night" : "nights"} in a row</p>

        {/* The joke shows every time, milestone or not. */}
        <p className="pop-line">{word}</p>

        {milestone && <p className="pop-milestone label">{milestone.name}</p>}

        <button className="px-btn" onClick={onClose}>
          {milestone ? "Nice" : "Okay"}
        </button>
      </div>
    </div>
  );
}
