"use client";

import { useRef, useState } from "react";
import { isSealed } from "@/lib/layout";
import type { Scrap } from "@/lib/types";
import { useArrange } from "@/lib/useArrange";
import type { Scrapbook } from "@/lib/useScrapbook";
import { ArrangeTools } from "./ArrangeTools";
import { KissSeal } from "./KissSeal";
import { StoryPage } from "./StoryPage";

interface Props {
  who: string;
  page: Scrap;
  number: number;
  book: Scrapbook;
  turn: "next" | "prev";
  /** Open the sheet that changes the words, day and stickers. */
  onChange: (page: Scrap) => void;
  /** Somewhere on screen worth a burst of stardust. */
  onBurst: (x: number, y: number) => void;
}

/**
 * A page in the open book, with the tools that go under it. Each page keeps
 * its own arranging and sealing state, so turning to another page starts
 * clean.
 */
export function PageLeaf({ who, page, number, book, turn, onChange, onBurst }: Props) {
  const arr = useArrange(page, book.arrange);
  const canvas = useRef<HTMLDivElement | null>(null);
  const [removing, setRemoving] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [justSealed, setJustSealed] = useState<{ by: string; at: number } | null>(null);
  const sealed = isSealed(page);

  const kiss = () => {
    const at = Date.now();
    setJustSealed({ by: who, at });
    const box = canvas.current?.getBoundingClientRect();
    if (box) onBurst(box.left + box.width * 0.8, box.top + box.height * 0.84);
    void book.seal(page.id).catch(() => setJustSealed(null));
    // The tools give way to the mark, then the server's copy takes over.
    window.setTimeout(() => setSealing(false), 900);
  };

  return (
    <div className={`leaf-wrap turn-${turn}${arr.active ? " is-arranging" : ""}`}>
      <StoryPage
        page={page}
        number={number}
        layout={arr.layout}
        arranging={arr.active}
        selected={arr.selected}
        editing={arr.editing}
        canvasRef={canvas}
        onItemDown={(e, id) => arr.onItemDown(e, id, canvas.current)}
        onItemMove={arr.onItemMove}
        onItemUp={arr.onItemUp}
        onCanvasDown={() => arr.select(null)}
        onTextChange={arr.changeText}
        onTextDone={arr.finishText}
        onTextOpen={arr.editText}
        justSealed={justSealed}
      />

      <div className="leaf-tools">
        {sealed || justSealed ? (
          <span className="label leaf-sealed-note">This page is sealed. It stays exactly as it is.</span>
        ) : arr.active ? (
          <ArrangeTools arr={arr} />
        ) : sealing ? (
          <KissSeal onSeal={kiss} onCancel={() => setSealing(false)} />
        ) : removing ? (
          <>
            <span className="label">Remove this page for both of you?</span>
            <button
              className="ghost-btn"
              onClick={() => {
                setRemoving(false);
                void book.remove(page);
              }}
            >
              Remove
            </button>
            <button className="ghost-btn" onClick={() => setRemoving(false)}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <button className="ghost-btn" onClick={arr.begin}>
              Arrange
            </button>
            <button className="ghost-btn" onClick={() => onChange(page)}>
              Change
            </button>
            <button className="ghost-btn" onClick={() => setRemoving(true)}>
              Remove
            </button>
            <button className="ghost-btn seal-btn" onClick={() => setSealing(true)}>
              Seal with a kiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
