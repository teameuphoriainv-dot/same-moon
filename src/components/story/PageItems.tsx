"use client";

import { useState } from "react";
import { INK } from "@/lib/art/palette";
import { KISS_PRINT, STICKER_SHEET } from "@/lib/art/stickers";
import { dayKey, shortDate } from "@/lib/dates";
import { MAX_TEXT, type Item, type TapeTint } from "@/lib/layout";
import { safePhoto, safeThumb } from "@/lib/pages";
import type { Scrap } from "@/lib/types";
import { PixelSprite } from "../PixelSprite";
import { DoodleArt } from "./DoodleArt";
import { inkFor, TAPE_CLIP, TAPE_COLOURS, tornClip } from "./sheet";
import { displayName } from "@/lib/couple";

/** Fills its item box. The sprite's own aspect ratio sets the height. */
const FILL: React.CSSProperties = { width: "100%", height: "auto" };

/** The photo, on its white border, with the caption written underneath. */
export function Photo({ page }: { page: Scrap }) {
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const url = safePhoto(page.url);
  const thumb = safeThumb(page.thumb);
  const ratio = page.w > 0 && page.h > 0 ? page.w / page.h : 4 / 3;

  return (
    <figure className="photo-card" style={{ "--ratio": ratio } as React.CSSProperties}>
      {/* The tiny copy is drawn blocky on purpose. It reads as a pixel sketch
          of the photo, and the real one steps in over the top of it. */}
      <div className="leaf-frame" style={thumb ? { backgroundImage: `url("${thumb}")` } : undefined}>
        {url && !broken ? (
          // Stored photos, already sized for the page, so a plain img is right.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={page.caption || "A photo in the storybook"}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={ready ? "is-ready" : ""}
            // A photo already in the cache can finish before `onLoad` is
            // listening, and would then stay hidden behind its own preview.
            ref={(img) => {
              if (img?.complete && img.naturalWidth > 0) setReady(true);
            }}
            onLoad={() => setReady(true)}
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="leaf-missing">This photo did not load.</span>
        )}
      </div>
      {page.caption && <figcaption className="leaf-words">{page.caption}</figcaption>}
    </figure>
  );
}

export function Drawing({ page }: { page: Scrap }) {
  return (
    <figure className="photo-card is-drawing" style={{ "--ratio": 1 } as React.CSSProperties}>
      <div className="leaf-frame">
        <DoodleArt art={page.art} width={320} />
      </div>
      {page.caption && <figcaption className="leaf-words">{page.caption}</figcaption>}
    </figure>
  );
}

export function Sticker({ k }: { k: string }) {
  const rows = STICKER_SHEET[k];
  if (!rows) return null;
  return (
    <span className="pg-sticker-art">
      <PixelSprite rows={rows} palette={inkFor(k)} width={64} style={FILL} />
    </span>
  );
}

export function Tape({ k }: { k?: string }) {
  const tint = TAPE_COLOURS[(k as TapeTint) ?? "plain"] ?? TAPE_COLOURS.plain;
  return (
    <span
      className="pg-tape-strip"
      style={{ "--tint": tint, clipPath: TAPE_CLIP } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}

interface TextProps {
  item: Item;
  editing: boolean;
  onChange?: (txt: string) => void;
  onDone?: () => void;
}

/** A scrap of torn paper with a few words on it. */
export function TextScrap({ item, editing, onChange, onDone }: TextProps) {
  return (
    <span className="pg-text-scrap" style={{ clipPath: tornClip(item.id) }}>
      {editing ? (
        <textarea
          className="pg-text-input"
          value={item.txt ?? ""}
          maxLength={MAX_TEXT}
          rows={2}
          autoFocus
          placeholder="Say something"
          aria-label="Words for this scrap"
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onDone}
          onKeyDown={(e) => {
            if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <span className="pg-text-words">{item.txt}</span>
      )}
    </span>
  );
}

/** The kiss a sealed page carries, where it landed, with who and when. */
export function KissMark({
  page,
  by,
  at,
  fresh,
}: {
  page: Pick<Scrap, "id">;
  by: string;
  at: number;
  fresh: boolean;
}) {
  // Lower right, turned a little, the same way every time for this page.
  const tilt = -22 + (page.id % 7) * 6;
  const when = at > 0 ? shortDate(dayKey(new Date(at))) : shortDate(dayKey(new Date()));
  return (
    <span
      className={`pg-kiss${fresh ? " is-fresh" : ""}`}
      style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
    >
      <PixelSprite rows={KISS_PRINT} palette={INK} width={64} style={FILL} />
      <span className="label pg-kiss-label">
        Sealed with a kiss by {displayName(by)}, {when}
      </span>
    </span>
  );
}
