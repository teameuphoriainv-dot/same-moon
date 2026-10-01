"use client";

import { useState } from "react";
import { STICKER_SHEET } from "@/lib/art/stickers";
import { ROTATE_STEP, SIZE_STEP, type Arranger } from "@/lib/useArrange";
import { Icon } from "../Icon";
import { PixelSprite } from "../PixelSprite";
import { inkFor, SHEET_NAMES, SHEET_ORDER } from "./sheet";

/**
 * The tray under a page while it is being arranged: what can be done to the
 * thing that is picked up, and what can be added. Every control is a big
 * square a thumb can land on.
 */
export function ArrangeTools({ arr }: { arr: Arranger }) {
  const [sheet, setSheet] = useState(false);
  const picked = arr.selected ? arr.layout.items.find((i) => i.id === arr.selected) : undefined;

  return (
    <div className="arrange" role="toolbar" aria-label="Arrange this page">
      {picked ? (
        <div className="arrange-row arrange-item">
          <button className="tool-btn" onClick={() => arr.rotate(-ROTATE_STEP)} aria-label="Tilt left">
            <span className="tool-glyph">-15</span>
            <span className="tool-name">Tilt</span>
          </button>
          <button className="tool-btn" onClick={() => arr.rotate(ROTATE_STEP)} aria-label="Tilt right">
            <span className="tool-glyph">+15</span>
            <span className="tool-name">Tilt</span>
          </button>
          <button className="tool-btn" onClick={() => arr.grow(-SIZE_STEP)} aria-label="Smaller">
            <span className="tool-glyph">-</span>
            <span className="tool-name">Smaller</span>
          </button>
          <button className="tool-btn" onClick={() => arr.grow(SIZE_STEP)} aria-label="Bigger">
            <span className="tool-glyph">+</span>
            <span className="tool-name">Bigger</span>
          </button>
          <button className="tool-btn" onClick={arr.toFront} aria-label="Bring to the front">
            <span className="tool-glyph"><Icon name="pin" size={18} /></span>
            <span className="tool-name">On top</span>
          </button>
          {picked.t === "text" && (
            <button className="tool-btn" onClick={() => arr.editText(picked.id)} aria-label="Change the words">
              <span className="tool-glyph"><Icon name="pencil" size={18} /></span>
              <span className="tool-name">Words</span>
            </button>
          )}
          {picked.t !== "main" && (
            <button className="tool-btn is-danger" onClick={arr.remove} aria-label="Take it off the page">
              <span className="tool-glyph"><Icon name="trash" size={18} /></span>
              <span className="tool-name">Remove</span>
            </button>
          )}
        </div>
      ) : (
        <p className="label arrange-hint">Drag anything. Tap it for more.</p>
      )}

      {sheet && (
        <div className="arrange-sheet" role="group" aria-label="Stickers">
          {SHEET_ORDER.map((k) => (
            <button
              key={k}
              className="sheet-btn"
              aria-label={SHEET_NAMES[k] ?? k}
              disabled={arr.full}
              onClick={() => {
                arr.addSticker(k);
                setSheet(false);
              }}
            >
              <PixelSprite rows={STICKER_SHEET[k]} palette={inkFor(k)} width={34} />
            </button>
          ))}
        </div>
      )}

      <div className="arrange-row arrange-tray">
        <button
          className={`tool-btn${sheet ? " is-on" : ""}`}
          aria-pressed={sheet}
          onClick={() => setSheet((v) => !v)}
          disabled={arr.full}
        >
          <span className="tool-glyph">
            <PixelSprite rows={STICKER_SHEET.HEART} palette={inkFor("HEART")} width={18} />
          </span>
          <span className="tool-name">Sticker</span>
        </button>
        <button className="tool-btn" onClick={arr.addTape} disabled={arr.full}>
          <span className="tool-glyph tool-tape" aria-hidden="true" />
          <span className="tool-name">Tape</span>
        </button>
        <button className="tool-btn" onClick={arr.addText} disabled={arr.full}>
          <span className="tool-glyph tool-text">Aa</span>
          <span className="tool-name">Text</span>
        </button>
        <button className="tool-btn" onClick={arr.undoOnce} disabled={!arr.canUndo} aria-label="Undo the last change">
          <span className="tool-glyph"><Icon name="swap" size={18} /></span>
          <span className="tool-name">Undo</span>
        </button>
        <button className="px-btn arrange-done" onClick={arr.done}>
          Done
        </button>
      </div>
      {arr.full && <p className="label arrange-hint">This page is as full as a page gets.</p>}
    </div>
  );
}
