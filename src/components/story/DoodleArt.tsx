import { DOODLE_INK, PAPER } from "@/lib/art/inks";
import { artRows } from "@/lib/pages";
import { PixelSprite } from "../PixelSprite";

/** A finished drawing, on its paper. Draws nothing if the drawing is malformed. */
export function DoodleArt({ art, width }: { art: string; width: number }) {
  const rows = artRows(art);
  if (!rows) return null;
  return (
    <PixelSprite
      rows={rows}
      palette={DOODLE_INK}
      width={width}
      style={{ background: PAPER, width: "100%", height: "auto" }}
    />
  );
}
