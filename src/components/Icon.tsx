import { ICONS, type IconName } from "@/lib/art/icons";
import { GLYPH } from "@/lib/art/palette";
import { PixelSprite } from "./PixelSprite";

/** A button glyph. It takes its colour from the text around it. */
export function Icon({
  name,
  size = 24,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return <PixelSprite rows={ICONS[name]} palette={GLYPH} width={size} className={className} />;
}
