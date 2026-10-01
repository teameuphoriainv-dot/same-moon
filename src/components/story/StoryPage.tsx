"use client";

import { longDate } from "@/lib/dates";
import { isSealed, layoutOf, type Item, type Layout } from "@/lib/layout";
import type { Scrap } from "@/lib/types";
import { Drawing, KissMark, Photo, Sticker, Tape, TextScrap } from "./PageItems";
import { displayName } from "@/lib/couple";

interface Props {
  page: Scrap;
  number: number;
  /** The arrangement to draw. Without it, the page's own. */
  layout?: Layout;
  arranging?: boolean;
  selected?: string | null;
  editing?: string | null;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  onItemDown?: (e: React.PointerEvent, id: string) => void;
  onItemMove?: (e: React.PointerEvent) => void;
  onItemUp?: (e: React.PointerEvent) => void;
  onCanvasDown?: () => void;
  onTextChange?: (id: string, txt: string) => void;
  onTextDone?: (id: string) => void;
  onTextOpen?: (id: string) => void;
  /** A kiss that has just landed here and is not yet back from the server. */
  justSealed?: { by: string; at: number } | null;
}

function ItemBox({
  item,
  z,
  page,
  selected,
  editing,
  arranging,
  onDown,
  onMove,
  onUp,
  onTextChange,
  onTextDone,
  onTextOpen,
}: {
  item: Item;
  z: number;
  page: Scrap;
  selected: boolean;
  editing: boolean;
  arranging: boolean;
  onDown?: (e: React.PointerEvent, id: string) => void;
  onMove?: (e: React.PointerEvent) => void;
  onUp?: (e: React.PointerEvent) => void;
  onTextChange?: (id: string, txt: string) => void;
  onTextDone?: (id: string) => void;
  onTextOpen?: (id: string) => void;
}) {
  const style: React.CSSProperties = {
    left: `${item.x / 10}%`,
    top: `${item.y / 10}%`,
    width: `${item.s / 10}%`,
    transform: `translate(-50%, -50%) rotate(${item.r}deg)`,
    zIndex: z + 1,
  };

  let inner: React.ReactNode = null;
  if (item.t === "main") inner = page.kind === "doodle" ? <Drawing page={page} /> : <Photo page={page} />;
  if (item.t === "sticker" && item.k) inner = <Sticker k={item.k} />;
  if (item.t === "tape") inner = <Tape k={item.k} />;
  if (item.t === "text")
    inner = (
      <TextScrap
        item={item}
        editing={editing}
        onChange={(txt) => onTextChange?.(item.id, txt)}
        onDone={() => onTextDone?.(item.id)}
      />
    );

  return (
    <div
      className={`pg-item pg-${item.t}${selected ? " is-selected" : ""}`}
      style={style}
      data-item={item.id}
      onPointerDown={(e) => {
        if (!arranging) return;
        // Typing into a scrap is not the start of a drag.
        if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.stopPropagation();
        e.preventDefault();
        onDown?.(e, item.id);
      }}
      onPointerMove={arranging ? onMove : undefined}
      onPointerUp={arranging ? onUp : undefined}
      onPointerCancel={arranging ? onUp : undefined}
      onDoubleClick={() => arranging && item.t === "text" && onTextOpen?.(item.id)}
    >
      {inner}
    </div>
  );
}

/** One page of the book: paper, with everything stuck to it where it was left. */
export function StoryPage({
  page,
  number,
  layout,
  arranging = false,
  selected = null,
  editing = null,
  canvasRef,
  onItemDown,
  onItemMove,
  onItemUp,
  onCanvasDown,
  onTextChange,
  onTextDone,
  onTextOpen,
  justSealed = null,
}: Props) {
  const drawn = layout ?? layoutOf(page);
  // A kiss made on this phone keeps its landing animation even once the
  // server's copy of the seal arrives a moment later.
  const seal = isSealed(page)
    ? { by: page.sealedBy, at: page.sealedAt, fresh: justSealed !== null }
    : justSealed
      ? { ...justSealed, fresh: true }
      : null;
  const stop = (e: React.SyntheticEvent) => arranging && e.stopPropagation();

  return (
    <article
      className={`leaf leaf-${page.kind}${arranging ? " is-arranging" : ""}${seal ? " is-sealed" : ""}`}
      aria-label={`Page ${number}`}
    >
      <div
        className="leaf-canvas"
        ref={canvasRef}
        onPointerDown={() => arranging && onCanvasDown?.()}
        // A drag across the page must not turn it.
        onTouchStart={stop}
        onTouchEnd={stop}
      >
        {page.kind === "note" && (
          <div className="leaf-note-card">
            <p className="leaf-words">{page.caption}</p>
          </div>
        )}

        {drawn.items.map((item, z) => (
          <ItemBox
            key={item.id}
            item={item}
            z={z}
            page={page}
            selected={arranging && selected === item.id}
            editing={arranging && editing === item.id}
            arranging={arranging}
            onDown={onItemDown}
            onMove={onItemMove}
            onUp={onItemUp}
            onTextChange={onTextChange}
            onTextDone={onTextDone}
            onTextOpen={onTextOpen}
          />
        ))}

        {seal && <KissMark page={page} by={seal.by} at={seal.at} fresh={seal.fresh} />}
      </div>

      <footer className="leaf-foot">
        <span>{longDate(page.day)}</span>
        <span>
          {page.kind === "doodle" ? "Drawn together" : displayName(page.by)} &nbsp;&middot;&nbsp; {number}
        </span>
      </footer>
    </article>
  );
}
