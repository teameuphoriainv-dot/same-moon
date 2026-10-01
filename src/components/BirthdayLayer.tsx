"use client";

import { useMemo } from "react";
import { BALLOON, FLAG, GIFT, PARTY, type Palette } from "@/lib/sprites";
import { PixelSprite } from "./PixelSprite";

/** Deterministic PRNG, same trick as the sky, so decor never reshuffles on re-render. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const FLAG_COLORS = ["#d8a94b", "#c97b84", "#f4e9d4", "#f2d287", "#8e4f58"];

const BALLOON_COLORS = [
  { b: "#c97b84", w: "#e3a3aa" },
  { b: "#d8a94b", w: "#f2d287" },
  { b: "#f4e9d4", w: "#fffbf0" },
  { b: "#8e4f58", w: "#c97b84" },
  { b: "#f2d287", w: "#fffbf0" },
];

const CONFETTI_COLORS = ["#d8a94b", "#f2d287", "#c97b84", "#e3a3aa", "#f4e9d4"];

const FLAG_COUNT = 15;

/**
 * Everything ambient about the birthday: bunting along the top, balloons
 * drifting up, confetti coming down. Pointer-events are off end to end, so it
 * can sit above the page without ever swallowing a tap.
 */
export function BirthdayLayer() {
  const balloons = useMemo(() => {
    const rand = seeded(20260920);
    return Array.from({ length: 11 }, (_, i) => {
      const c = BALLOON_COLORS[i % BALLOON_COLORS.length];
      return {
        left: 3 + rand() * 92,
        width: 30 + rand() * 30,
        delay: rand() * 26,
        duration: 22 + rand() * 18,
        sway: 6 + rand() * 16,
        palette: { ...PARTY, b: c.b, w: c.w } as Palette,
      };
    });
  }, []);

  const confetti = useMemo(() => {
    const rand = seeded(97531);
    return Array.from({ length: 46 }, () => ({
      left: rand() * 100,
      size: 4 + Math.floor(rand() * 3) * 2,
      delay: rand() * 14,
      duration: 9 + rand() * 11,
      drift: (rand() - 0.5) * 120,
      spin: rand() > 0.5 ? 1 : -1,
      color: CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)],
    }));
  }, []);

  return (
    <div className="bday-layer" aria-hidden="true">
      <div className="bday-bunting">
        <div className="bday-string" />
        {Array.from({ length: FLAG_COUNT }, (_, i) => (
          <div
            key={i}
            className="bday-flag"
            style={{
              left: `${(i / (FLAG_COUNT - 1)) * 100}%`,
              animationDelay: `${(i % 5) * 0.22}s`,
            }}
          >
            {i === Math.floor(FLAG_COUNT / 2) ? (
              <PixelSprite rows={GIFT} palette={PARTY} width={30} />
            ) : (
              <PixelSprite
                rows={FLAG}
                palette={{ ...PARTY, c: FLAG_COLORS[i % FLAG_COLORS.length] }}
                width={32}
              />
            )}
          </div>
        ))}
      </div>

      <div className="bday-balloons">
        {balloons.map((b, i) => (
          <div
            key={i}
            className="bday-balloon"
            style={
              {
                left: `${b.left}%`,
                animationDelay: `${b.delay}s`,
                animationDuration: `${b.duration}s`,
                "--sway": `${b.sway}px`,
              } as React.CSSProperties
            }
          >
            <PixelSprite rows={BALLOON} palette={b.palette} width={b.width} />
          </div>
        ))}
      </div>

      <div className="bday-confetti">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="bday-bit"
            style={
              {
                left: `${c.left}%`,
                width: c.size,
                height: c.size,
                background: c.color,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
                "--drift": `${c.drift}px`,
                "--spin": `${c.spin * 360}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
