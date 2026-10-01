import { useMemo } from "react";

/**
 * A circle drawn one pixel wide on a grid, in the same way as PixelMoon, so a
 * ring around the moon has the same stepped edge the moon has.
 */
export function PixelRing({ cells = 30, color }: { cells?: number; color: string }) {
  const rects = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    const centre = (cells - 1) / 2;
    const radius = cells / 2 - 1;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        if (Math.abs(Math.hypot(x - centre, y - centre) - radius) < 0.5) out.push({ x, y });
      }
    }
    return out;
  }, [cells]);

  return (
    <svg
      viewBox={`0 0 ${cells} ${cells}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill={color} />
      ))}
    </svg>
  );
}
