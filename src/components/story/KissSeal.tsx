"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { INK } from "@/lib/art/palette";
import { STICKER_SHEET } from "@/lib/art/stickers";
import { PixelSprite } from "../PixelSprite";

/** How long the lips have to be held. Long enough to mean it. */
export const HOLD_MS = 1100;

/**
 * A pixel ring that fills clockwise from the top as a hold goes on. Same
 * stepped edge as PixelRing, drawn cell by cell so it can be part-way full.
 */
function HoldRing({ progress, cells = 28 }: { progress: number; cells?: number }) {
  const ring = useMemo(() => {
    const out: { x: number; y: number; a: number }[] = [];
    const centre = (cells - 1) / 2;
    const radius = cells / 2 - 1;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        if (Math.abs(Math.hypot(x - centre, y - centre) - radius) < 0.5) {
          // Angle from twelve o'clock, going clockwise.
          const a = (Math.atan2(x - centre, centre - y) + Math.PI * 2) % (Math.PI * 2);
          out.push({ x, y, a });
        }
      }
    }
    return out.sort((p, q) => p.a - q.a);
  }, [cells]);
  const lit = Math.round(progress * ring.length);

  return (
    <svg viewBox={`0 0 ${cells} ${cells}`} shapeRendering="crispEdges" aria-hidden="true" className="kiss-ring">
      {ring.map((r, i) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={i < lit ? "var(--brass-bright)" : "var(--moon-ghost)"} />
      ))}
    </svg>
  );
}

interface Props {
  /** Fired once the hold completes. The lips have already printed by then. */
  onSeal: () => void;
  onCancel: () => void;
}

/**
 * Press and hold the lips to seal a page. Letting go early cancels; there is
 * no way to seal by accident, because this is the one thing in the book that
 * cannot be undone.
 */
export function KissSeal({ onSeal, onCancel }: Props) {
  const [progress, setProgress] = useState(0);
  const [kissed, setKissed] = useState(false);
  const frame = useRef<number | null>(null);
  const started = useRef(0);
  const sealed = useRef(false);

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  const release = () => {
    if (sealed.current) return;
    stop();
    setProgress(0);
  };

  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (sealed.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    started.current = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started.current) / HOLD_MS);
      setProgress(p);
      if (p < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      sealed.current = true;
      setKissed(true);
      onSeal();
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);

  return (
    <div className="kiss-seal">
      <p className="kiss-warn">Sealing is forever. Neither of you can change or remove this page after a kiss.</p>
      <div className="kiss-row">
        <button
          type="button"
          className={`kiss-lips${kissed ? " is-kissed" : ""}`}
          style={{ "--p": progress } as React.CSSProperties}
          aria-label="Press and hold to seal this page with a kiss"
          onPointerDown={press}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onContextMenu={(e) => e.preventDefault()}
        >
          <HoldRing progress={progress} />
          <span className="kiss-lips-art">
            <PixelSprite rows={STICKER_SHEET.LIPS} palette={INK} width={52} />
          </span>
        </button>
        <span className="label kiss-hint" aria-live="polite">
          {kissed ? "Sealed" : progress > 0 ? "Keep holding" : "Hold the lips"}
        </span>
        <button type="button" className="ghost-btn" onClick={onCancel} disabled={kissed}>
          Not yet
        </button>
      </div>
    </div>
  );
}
