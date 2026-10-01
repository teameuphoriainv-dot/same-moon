import { INK } from "@/lib/art/palette";
import { KISS_PRINT } from "@/lib/art/stickers";
import { isSealed } from "@/lib/layout";
import { safeThumb } from "@/lib/pages";
import type { Scrap } from "@/lib/types";
import { PixelSprite } from "../PixelSprite";
import { DoodleArt } from "./DoodleArt";

/** The kiss in the corner of a sealed page's thumbnail. */
function SealBadge({ page }: { page: Scrap }) {
  if (!isSealed(page)) return null;
  return (
    <span className="thumb-seal" title={`Sealed with a kiss by ${page.sealedBy}`}>
      <PixelSprite rows={KISS_PRINT} palette={INK} width={22} />
    </span>
  );
}

/** A page, small. Used on the front page and in the view of every page at once. */
export function PageThumb({ page }: { page: Scrap }) {
  if (page.kind === "doodle") {
    return (
      <span className="thumb thumb-doodle">
        <DoodleArt art={page.art} width={96} />
        <SealBadge page={page} />
      </span>
    );
  }
  if (page.kind === "note") {
    return (
      <span className="thumb thumb-note">
        <span>{page.caption}</span>
        <SealBadge page={page} />
      </span>
    );
  }
  const thumb = safeThumb(page.thumb);
  return (
    <span
      className="thumb thumb-photo"
      style={thumb ? { backgroundImage: `url("${thumb}")` } : undefined}
    >
      <SealBadge page={page} />
    </span>
  );
}
