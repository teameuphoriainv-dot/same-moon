"use client";

import { useEffect, useRef, useState } from "react";
import { DOODLE_INK, INKS, PAPER } from "@/lib/art/inks";
import { dayKey } from "@/lib/dates";
import { nextIdea } from "@/lib/ideas";
import { useDoodle } from "@/lib/useDoodle";
import type { Scrapbook } from "@/lib/useScrapbook";
import { Icon } from "../Icon";

interface Point {
  x: number;
  y: number;
}

/** Bare canvas. Painting with it is how the eraser works. */
const BARE = ".";

export function Doodle({ who, story }: { who: string; story: Scrapbook }) {
  const d = useDoodle(who);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const last = useRef<Point | null>(null);
  const [ink, setInk] = useState("k");
  const [thick, setThick] = useState(true);
  const [wiping, setWiping] = useState(false);
  const [pin, setPin] = useState<"" | "busy" | "done" | "failed">("");

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    if (el.width !== d.size) {
      el.width = d.size;
      el.height = d.size;
    }
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, d.size, d.size);
    for (let i = 0; i < d.cells.length; i++) {
      const hex = DOODLE_INK[d.cells[i]];
      if (!hex) continue;
      ctx.fillStyle = hex;
      ctx.fillRect(i % d.size, Math.floor(i / d.size), 1, 1);
    }
  }, [d.cells, d.size]);

  // A pin says it is done for a moment, then the button is a button again.
  useEffect(() => {
    if (pin !== "done" && pin !== "failed") return;
    const timer = setTimeout(() => setPin(""), 3200);
    return () => clearTimeout(timer);
  }, [pin]);

  const pointAt = (e: React.PointerEvent): Point => {
    const box = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.max(0, Math.min(d.size - 1, n));
    return {
      x: clamp(Math.floor(((e.clientX - box.left) / box.width) * d.size)),
      y: clamp(Math.floor(((e.clientY - box.top) / box.height) * d.size)),
    };
  };

  /** Walk the line between two points, so a quick drag leaves no gaps. */
  const stroke = (from: Point, to: Point) => {
    const pixels = new Set<number>();
    const reach = thick ? [0, 1] : [0];
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(from.x + ((to.x - from.x) * s) / steps);
      const y = Math.round(from.y + ((to.y - from.y) * s) / steps);
      for (const dy of reach) {
        for (const dx of reach) {
          const px = x + dx;
          const py = y + dy;
          if (px < d.size && py < d.size) pixels.add(py * d.size + px);
        }
      }
    }
    d.paint([...pixels], ink);
  };

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointAt(e);
    last.current = p;
    stroke(p, p);
  };
  const move = (e: React.PointerEvent) => {
    const from = last.current;
    if (!from) return;
    const p = pointAt(e);
    if (p.x === from.x && p.y === from.y) return;
    stroke(from, p);
    last.current = p;
  };
  const up = () => {
    last.current = null;
  };

  const pinIt = async () => {
    if (!d.drawn || pin === "busy") return;
    setPin("busy");
    try {
      await story.addDoodle(d.cells, {
        caption: d.prompt,
        day: dayKey(new Date()),
        charm: "stars",
      });
      setPin("done");
    } catch {
      setPin("failed");
    }
  };

  return (
    <div className="doodle">
      {d.prompt && <p className="doodle-idea">{d.prompt}</p>}

      <canvas
        ref={canvas}
        className="doodle-sheet"
        role="img"
        aria-label="The canvas you are both drawing on"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />

      <div className="doodle-inks" role="group" aria-label="Colour">
        {INKS.map((i) => (
          <button
            key={i.key}
            className={`doodle-ink${ink === i.key ? " is-on" : ""}`}
            style={{ background: i.hex }}
            aria-label={i.name}
            aria-pressed={ink === i.key}
            onClick={() => setInk(i.key)}
          />
        ))}
        <button
          className={`doodle-ink doodle-rub${ink === BARE ? " is-on" : ""}`}
          aria-label="Eraser"
          aria-pressed={ink === BARE}
          onClick={() => setInk(BARE)}
        >
          <Icon name="eraser" size={18} />
        </button>
      </div>

      <div className="doodle-tools">
        <button className="ghost-btn" onClick={() => setThick((v) => !v)} aria-pressed={thick}>
          {thick ? "Thick line" : "Thin line"}
        </button>
        <button className="ghost-btn" onClick={() => d.setPrompt(nextIdea(d.prompt))}>
          {d.prompt ? "Another idea" : "Give us an idea"}
        </button>
        {wiping ? (
          <>
            <span className="label">Wipe it for both of you?</span>
            <button
              className="ghost-btn"
              onClick={() => {
                d.clear();
                setWiping(false);
              }}
            >
              Wipe
            </button>
            <button className="ghost-btn" onClick={() => setWiping(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="ghost-btn" onClick={() => setWiping(true)} disabled={!d.drawn}>
            Wipe it clean
          </button>
        )}
      </div>

      <div className="doodle-pin">
        <button
          className="px-btn"
          onClick={() => void pinIt()}
          disabled={!d.drawn || pin === "busy" || !story.available}
        >
          {pin === "busy" ? "Pinning" : "Pin it in the storybook"}
        </button>
        <p className="label" role="status">
          {pin === "done" && "Pinned. It has its own page now."}
          {pin === "failed" && "That did not pin. Try again."}
        </p>
      </div>
    </div>
  );
}
