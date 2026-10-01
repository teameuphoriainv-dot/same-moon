"use client";

import { useEffect, useRef } from "react";
import { ROWS, paintLand, paintLive, shape, type Home, type Land } from "./land";
import { prefersStill } from "./seeded";

export type { Home } from "./land";

/** Screen pixels to one pixel of land. The same unit as every button edge. */
const SCALE = 4;
const FRAME_MS = 125;

/**
 * The land under the moon: two houses on two hills, one for each of them.
 *
 * A window is lit while that person has the site open, and there is smoke from
 * the chimney. When both of them are here at once a string of lights runs
 * across the valley from one house to the other.
 */
export function Horizon({ left, right }: { left: Home; right: Home }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const homes = useRef<[Home, Home]>([left, right]);
  const repaint = useRef<(() => void) | null>(null);

  useEffect(() => {
    homes.current = [left, right];
    repaint.current?.();
  }, [left, right]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = prefersStill();
    const backdrop = document.createElement("canvas");
    const back = backdrop.getContext("2d");
    if (!back) return;

    let land: Land = shape(1);
    let raf = 0;
    let last = 0;
    let frame = 0;

    const draw = () => paintLive(ctx, backdrop, land, homes.current, frame);

    const fit = () => {
      const w = Math.ceil(window.innerWidth / SCALE);
      if (canvas.width === w) return;
      canvas.width = w;
      canvas.height = ROWS;
      backdrop.width = w;
      backdrop.height = ROWS;
      canvas.style.width = `${w * SCALE}px`;
      canvas.style.height = `${ROWS * SCALE}px`;
      land = shape(w);
      paintLand(back, land);
      draw();
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      frame += 1;
      draw();
    };

    repaint.current = draw;
    fit();
    window.addEventListener("resize", fit);
    if (!still) raf = requestAnimationFrame(loop);

    return () => {
      repaint.current = null;
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="horizon" aria-hidden="true">
      <canvas ref={ref} className="horizon-land" />
      <span className={`horizon-name at-left${left.here ? " here" : ""}`}>{left.name}</span>
      <span className={`horizon-name at-right${right.here ? " here" : ""}`}>{right.name}</span>
    </div>
  );
}
