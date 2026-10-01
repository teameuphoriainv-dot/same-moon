"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shortDate } from "@/lib/dates";
import { isSealed } from "@/lib/layout";
import type { Scrap } from "@/lib/types";
import type { Scrapbook } from "@/lib/useScrapbook";
import { Icon } from "../Icon";
import { PixelMoon } from "../PixelMoon";
import { Stardust, type Burst } from "../Stardust";
import { AddPage } from "./AddPage";
import { PageLeaf } from "./PageLeaf";
import { PageThumb } from "./PageThumb";
import { displayName } from "@/lib/couple";
import { MOON, STAR } from "@/lib/auth";

type Leaf =
  | { kind: "cover" }
  | { kind: "page"; page: Scrap; number: number }
  | { kind: "blank" };

export interface Opening {
  /** Open at this page. Without it the book opens at the cover. */
  pageId?: number;
  /** Open with the "add a page" sheet already up. */
  adding?: boolean;
  /** Open ready to pin this drawing. */
  art?: string;
}

interface Props {
  who: string;
  book: Scrapbook;
  opening: Opening;
  onClose: () => void;
}

const SWIPE_PX = 48;

/** Wide enough to lay the book open at two pages. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 980px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return wide;
}

function pagesLabel(n: number, sealed = 0): string {
  if (n === 0) return "No pages yet";
  const pages = n === 1 ? "1 page so far" : `${n} pages so far`;
  return sealed > 0 ? `${pages}, ${sealed} sealed` : pages;
}

export function Storybook({ who, book, opening, onClose }: Props) {
  const { pages } = book;
  const sealedCount = pages.filter(isSealed).length;
  const wide = useWide();
  const per = wide ? 2 : 1;

  const leaves = useMemo<Leaf[]>(
    () => [
      { kind: "cover" },
      ...pages.map((page, i) => ({ kind: "page" as const, page, number: i + 1 })),
      { kind: "blank" },
    ],
    [pages],
  );

  const indexOf = useCallback(
    (id: number) => {
      const i = pages.findIndex((p) => p.id === id);
      return i < 0 ? 0 : i + 1;
    },
    [pages],
  );

  const [at, setAt] = useState(() => (opening.pageId ? indexOf(opening.pageId) : 0));
  const [turn, setTurn] = useState<"next" | "prev">("next");
  const [all, setAll] = useState(false);
  const [panel, setPanel] = useState<
    { mode: "add"; art: string | null } | { mode: "edit"; page: Scrap } | null
  >(opening.adding || opening.art ? { mode: "add", art: opening.art ?? null } : null);
  const [burst, setBurst] = useState<Burst | null>(null);

  // A spread starts on an even leaf, so the cover always sits on the left.
  const first = Math.min(wide ? at - (at % 2) : at, leaves.length - 1);
  const showing = leaves.slice(first, first + per);

  const go = useCallback(
    (to: number) => {
      const clamped = Math.max(0, Math.min(leaves.length - 1, to));
      setTurn(clamped >= first ? "next" : "prev");
      setAt(clamped);
    },
    [leaves.length, first],
  );

  const canBack = first > 0;
  const canOn = first + per < leaves.length;

  // --- landing on a page that was just added ---------------------------------

  const known = useRef<Set<number> | null>(null);
  const expecting = useRef(false);
  useEffect(() => {
    const ids = new Set(pages.map((p) => p.id));
    if (known.current && expecting.current) {
      const fresh = pages.find((p) => !known.current?.has(p.id) && p.by === who);
      if (fresh) {
        expecting.current = false;
        setTurn("next");
        setAt(indexOf(fresh.id));
        setAll(false);
        setBurst({ id: Date.now(), x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }
    }
    known.current = ids;
  }, [pages, who, indexOf]);

  // --- keys and swipes --------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(first + per);
      if (e.key === "ArrowLeft") go(first - per);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, onClose, go, first, per]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touch.current;
    touch.current = null;
    if (!from) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    // Mostly sideways, or it is somebody scrolling the page.
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? first + per : first - per);
  };

  const where =
    showing[0]?.kind === "cover" && per === 1
      ? "The cover"
      : showing.some((l) => l.kind === "page")
        ? `Page ${showing
            .filter((l): l is Extract<Leaf, { kind: "page" }> => l.kind === "page")
            .map((l) => l.number)
            .join(" and ")} of ${pages.length}`
        : pagesLabel(pages.length);

  return (
    <div className="story-scrim" role="dialog" aria-modal="true" aria-label="The storybook">
      <Stardust burst={burst} />

      <header className="story-head">
        <div>
          <p className="section-title">The storybook</p>
          <p className="label">{all ? pagesLabel(pages.length) : where}</p>
        </div>
        <div className="story-head-tools">
          {pages.length > 1 && (
            <button className="ghost-btn" onClick={() => setAll((v) => !v)} aria-pressed={all}>
              {all ? "Back to reading" : "All pages"}
            </button>
          )}
          <button className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </header>

      {all ? (
        <ul className="story-all">
          {pages.map((page, i) => (
            <li key={page.id}>
              <button
                className="story-all-card"
                onClick={() => {
                  go(i + 1);
                  setAll(false);
                }}
                aria-label={`Open page ${i + 1}`}
              >
                <PageThumb page={page} />
                <span className="label">{shortDate(page.day)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="story-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className={`book${per === 2 ? " is-spread" : ""}`} key={`${first}-${per}`}>
            {showing.map((leaf) => {
              if (leaf.kind === "cover") {
                return (
                  <article key="cover" className={`leaf leaf-cover turn-${turn}`}>
                    <PixelMoon size={96} phase={0.5} cells={18} />
                    <h2 className="cover-title">Our storybook</h2>
                    <p className="cover-names">
                      {displayName(MOON)}
                      <span className="sprite-heart" aria-hidden="true" />
                      {displayName(STAR)}
                    </p>
                    <p className="label">{pagesLabel(pages.length, sealedCount)}</p>
                    <p className="cover-for">For the two of us.</p>
                  </article>
                );
              }
              if (leaf.kind === "blank") {
                return (
                  <article key="blank" className={`leaf leaf-blank turn-${turn}`}>
                    <p className="leaf-words">
                      {pages.length === 0
                        ? "Nothing in here yet. The first page is yours to add."
                        : "The next page is blank."}
                    </p>
                    <button className="px-btn" onClick={() => setPanel({ mode: "add", art: null })}>
                      Add a page
                    </button>
                  </article>
                );
              }
              return (
                <PageLeaf
                  key={leaf.page.id}
                  who={who}
                  page={leaf.page}
                  number={leaf.number}
                  book={book}
                  turn={turn}
                  onChange={(page) => setPanel({ mode: "edit", page })}
                  onBurst={(x, y) => setBurst({ id: Date.now(), x, y })}
                />
              );
            })}
          </div>
        </div>
      )}

      <nav className="story-nav" aria-label="Turn the pages">
        <button
          className="ghost-btn story-turn"
          onClick={() => go(first - per)}
          disabled={all || !canBack}
          aria-label="Turn back"
        >
          <Icon name="left" size={20} />
        </button>
        <button className="px-btn" onClick={() => setPanel({ mode: "add", art: null })}>
          Add a page
        </button>
        <button
          className="ghost-btn story-turn"
          onClick={() => go(first + per)}
          disabled={all || !canOn}
          aria-label="Turn the page"
        >
          <Icon name="right" size={20} />
        </button>
      </nav>

      {panel && (
        <AddPage
          book={book}
          editing={panel.mode === "edit" ? panel.page : null}
          art={panel.mode === "add" ? panel.art : null}
          onClose={() => setPanel(null)}
          onAdded={() => {
            if (panel.mode === "add") expecting.current = true;
            setPanel(null);
          }}
        />
      )}
    </div>
  );
}
