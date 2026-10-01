/** Deterministic PRNG, so a scene is the same on every render and every phone. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** True when the visitor has asked for less movement. */
export function prefersStill(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A 4 x 4 ordered dither. `bayer(x, y)` is 0 to 1 and the same for the same
 * pixel every time, so a soft edge can be drawn as a fixed pattern of whole
 * pixels instead of a blur: paint the pixel when its coverage beats this.
 */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** Stamp an ASCII sprite onto a canvas, one pixel per character. */
export function stamp(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  palette: Record<string, string>,
  left: number,
  top: number,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const fill = palette[row[x]];
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(left + x, top + y, 1, 1);
    }
  }
}
