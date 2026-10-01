/**
 * An ASCII sprite renderer, in the same spirit as PixelMoon: everything sits on
 * an integer grid with crispEdges, so nothing ever blurs or resamples.
 *
 * Rows are strings, one character per pixel. A character not in the palette is
 * transparent, which is what "." is used for everywhere.
 *
 * Neighbouring pixels of one colour are drawn as a single rect. It looks
 * exactly the same and a sprite costs a fraction of the nodes, which matters
 * now that a page of the storybook can carry a dozen of them.
 */

import type { Palette } from "@/lib/art/palette";

interface PixelSpriteProps {
  rows: readonly string[];
  palette: Palette;
  /** Rendered width in CSS pixels. Height follows the sprite's aspect ratio. */
  width: number;
  className?: string;
  style?: React.CSSProperties;
}

interface Run {
  x: number;
  y: number;
  w: number;
  fill: string;
}

export function runsOf(rows: readonly string[], palette: Palette): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      const fill = palette[row[x]];
      if (!fill) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && palette[row[end]] === fill) end += 1;
      runs.push({ x, y, w: end - x, fill });
      x = end;
    }
  }
  return runs;
}

export function PixelSprite({ rows, palette, width, className, style }: PixelSpriteProps) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;

  return (
    <svg
      width={width}
      height={Math.round((width / w) * h)}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
      style={{ display: "block", ...style }}
    >
      {runsOf(rows, palette).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
