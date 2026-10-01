"use client";

import { useMemo } from "react";
import { illumination } from "@/lib/moon";
import { bayer } from "@/components/scenes/seeded";

interface PixelMoonProps {
  size: number;
  phase: number;
  /** Cells across the disc. Lower is chunkier. */
  cells?: number;
}

const LIT = ["#fffbf0", "#f4e8cc", "#e2d2ae"];
const LIT_EDGE = "#cdbd98";
const RIM = "#fffbf0";
const MARIA = ["#c4b38f", "#a99878"];
const BRIGHT = "#fffbf0";
const DARK = ["#111a2e", "#0c1426"];
const DARK_MARIA = "#0a1222";
const EARTHSHINE = "#1b2540";
const HALO = "#f4e9d4";
/** Coverage and alpha of the three rings of glow, nearest first. */
const HALO_RINGS: [number, number, number][] = [
  [1.1, 0.9, 0.16],
  [1.21, 0.55, 0.1],
  [1.34, 0.28, 0.06],
];

/**
 * The seas, as ellipses in unit-disc coordinates: cx, cy, rx, ry. Laid out as
 * the Moon looks from the northern hemisphere, north up: Imbrium top left with
 * Serenitatis beside it, Tranquillitatis and Crisium to the east, Procellarum
 * the long one down the west, Nubium and Humorum below it.
 */
const SEAS: [number, number, number, number][] = [
  [-0.3, -0.4, 0.27, 0.24], // Imbrium
  [0.12, -0.36, 0.17, 0.16], // Serenitatis
  [0.36, -0.1, 0.19, 0.17], // Tranquillitatis
  [0.7, -0.3, 0.1, 0.09], // Crisium
  [0.54, 0.22, 0.12, 0.15], // Fecunditatis
  [0.36, 0.28, 0.09, 0.09], // Nectaris
  [-0.02, -0.1, 0.09, 0.07], // Vaporum
  [-0.6, -0.02, 0.19, 0.38], // Procellarum
  [-0.28, 0.32, 0.16, 0.13], // Nubium
  [-0.54, 0.42, 0.1, 0.09], // Humorum
];

/** The bright young craters: cx, cy, r. Tycho low in the south, Copernicus, Aristarchus. */
const CRATERS: [number, number, number][] = [
  [-0.12, 0.7, 0.06],
  [-0.3, -0.04, 0.045],
  [-0.66, -0.3, 0.035],
];

/** Stable per-cell noise so the surface never shimmers between renders. */
function hash(i: number, j: number): number {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** How deep inside the nearest sea a point is: 1 at the centre, 0 outside all. */
function seaDepth(px: number, py: number): number {
  let deepest = 0;
  for (const [cx, cy, rx, ry] of SEAS) {
    const d = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
    if (d < 1) deepest = Math.max(deepest, 1 - d);
  }
  return deepest;
}

interface Run {
  x: number;
  y: number;
  w: number;
  fill: string;
  alpha: number;
}

/** Push a cell, extending the last run of the row when it is the same colour. */
function put(out: Run[], x: number, y: number, fill: string, alpha: number) {
  const last = out[out.length - 1];
  if (last && last.y === y && last.x + last.w === x && last.fill === fill && last.alpha === alpha) {
    last.w += 1;
  } else {
    out.push({ x, y, w: 1, fill, alpha });
  }
}

export function PixelMoon({ size, phase, cells = 30 }: PixelMoonProps) {
  const runs = useMemo(() => {
    const k = Math.cos(2 * Math.PI * phase);
    const waxing = phase < 0.5;
    const sun = waxing ? 1 : -1;
    const lit = illumination(phase);
    const glow = 0.4 + 0.6 * lit;
    // Near full the light is straight on, so the whole limb catches it.
    const full = lit > 0.96;
    const out: Run[] = [];

    const toUnit = (i: number) => ((i + 0.5) / cells) * 2 - 1;
    const inDisc = (i: number, j: number) => {
      const px = toUnit(i);
      const py = toUnit(j);
      return px * px + py * py <= 1;
    };
    // Terminator: an ellipse whose width tracks the phase.
    const isLit = (px: number, py: number) => {
      const w = Math.sqrt(Math.max(0, 1 - py * py));
      return waxing ? px > k * w : px < -k * w;
    };

    // The halo first, so the disc sits on top of it.
    const pad = Math.ceil((HALO_RINGS[2][0] - 1) * (cells / 2)) + 1;
    for (let j = -pad; j < cells + pad; j++) {
      for (let i = -pad; i < cells + pad; i++) {
        const px = toUnit(i);
        const py = toUnit(j);
        const r = Math.sqrt(px * px + py * py);
        if (r <= 1 || r > HALO_RINGS[2][0]) continue;
        const ring = HALO_RINGS[r <= HALO_RINGS[0][0] ? 0 : r <= HALO_RINGS[1][0] ? 1 : 2];
        if (bayer(i, j) >= ring[1] * glow) continue;
        put(out, i, j, HALO, ring[2] * glow);
      }
    }

    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        if (!inDisc(i, j)) continue;
        const px = toUnit(i);
        const py = toUnit(j);
        const isLitCell = isLit(px, py);
        const n = hash(i, j);
        const sea = seaDepth(px, py);
        // The outermost cell of its row or column is the limb, one pixel wide
        // at any size.
        const limb = !inDisc(i - 1, j) || !inDisc(i + 1, j) || !inDisc(i, j - 1) || !inDisc(i, j + 1);

        let fill: string;
        if (!isLitCell) {
          // Earthshine: the dark side just visible, its seas darker still.
          if (limb) fill = EARTHSHINE;
          else if (sea > 0.15) fill = DARK_MARIA;
          else fill = DARK[n > 0.7 ? 0 : 1];
        } else {
          const toward = px * sun;
          // The cell beside the shadow is the terminator, where the light
          // comes in flat and everything is a shade darker.
          const step = 2 / cells;
          const atTerminator = !isLit(px - sun * step, py);
          if (limb && (full || toward > 0.25)) fill = RIM;
          else if (limb || atTerminator) fill = LIT_EDGE;
          else if (CRATERS.some(([cx, cy, r]) => (px - cx) ** 2 + (py - cy) ** 2 < r * r)) fill = BRIGHT;
          else if (sea > 0) fill = MARIA[sea > 0.45 ? (n > 0.2 ? 1 : 0) : n > 0.82 ? 1 : 0];
          else fill = LIT[n > 0.82 ? 2 : n > 0.4 ? 1 : 0];
        }
        put(out, i, j, fill, 1);
      }
    }
    return out;
  }, [phase, cells]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cells} ${cells}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {runs.map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
          fillOpacity={r.alpha === 1 ? undefined : r.alpha}
        />
      ))}
    </svg>
  );
}
