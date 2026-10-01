import { BLOOMS, PLANTS } from "@/lib/art/stickers";
import { INK } from "@/lib/art/palette";
import { plantFor } from "@/lib/pages";
import type { Scrap } from "@/lib/types";
import { PixelSprite } from "../PixelSprite";

/** Past this many the row would wrap forever, so the rest are counted instead. */
const MOST = 48;

/**
 * One plant for every page in the book. It is the book's growth made visible:
 * add a page and something new comes up.
 */
export function Garden({ pages }: { pages: Scrap[] }) {
  if (pages.length === 0) return null;
  const shown = pages.slice(-MOST);
  const hidden = pages.length - shown.length;

  return (
    <div className="garden" aria-hidden="true">
      <div className="garden-row">
        {shown.map((page) => {
          const plant = plantFor(page.id);
          const rows = PLANTS[plant.kind];
          return (
            <span key={page.id} className="garden-plant">
              <PixelSprite
                rows={rows}
                palette={plant.kind === "sprout" ? INK : BLOOMS[plant.hue % BLOOMS.length]}
                width={rows[0].length * 3}
              />
            </span>
          );
        })}
      </div>
      {hidden > 0 && <p className="label garden-more">and {hidden} more</p>}
    </div>
  );
}
