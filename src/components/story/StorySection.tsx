"use client";

import { isSealed } from "@/lib/layout";
import type { Scrapbook } from "@/lib/useScrapbook";
import { PixelMoon } from "../PixelMoon";
import { Garden } from "./Garden";
import { PageThumb } from "./PageThumb";
import type { Opening } from "./Storybook";
import { displayName } from "@/lib/couple";
import { MOON, STAR } from "@/lib/auth";

function count(n: number, sealed: number): string {
  if (n === 0) return "Empty so far";
  const pages = n === 1 ? "1 page" : `${n} pages`;
  return sealed > 0 ? `${pages}, ${sealed} sealed` : pages;
}

/** The book as it sits on the front page: closed, with the newest pages beside it. */
export function StorySection({
  book,
  onOpen,
}: {
  book: Scrapbook;
  onOpen: (opening: Opening) => void;
}) {
  const recent = [...book.pages].sort((a, b) => b.id - a.id).slice(0, 3);

  return (
    <section className="section story">
      <div className="section-head">
        <h2 className="section-title">The storybook</h2>
        <span className="label">{book.available ? count(book.pages.length, book.pages.filter(isSealed).length) : "Not connected"}</span>
      </div>

      {!book.available ? (
        <p className="label joke-empty">
          The storybook is kept on the shared server, and this device is not connected to one.
        </p>
      ) : (
        <div className="story-body">
          <button className="story-cover" onClick={() => onOpen({})} aria-label="Open the storybook">
            <PixelMoon size={72} phase={0.5} cells={16} />
            <span className="cover-title">Our storybook</span>
            <span className="cover-names">
              {displayName(MOON)}
              <span className="sprite-heart" aria-hidden="true" />
              {displayName(STAR)}
            </span>
          </button>

          <div className="story-side">
            <p className="story-line">
              {book.pages.length === 0
                ? "A book for the two of you to fill. Add a photo or a note and it has its first page."
                : "Every page is something the two of you did. Add one and the book gets a page longer."}
            </p>

            {recent.length > 0 && (
              <div className="story-recent">
                {recent.map((page) => (
                  <button
                    key={page.id}
                    className="story-recent-card"
                    onClick={() => onOpen({ pageId: page.id })}
                    aria-label="Open this page"
                  >
                    <PageThumb page={page} />
                  </button>
                ))}
              </div>
            )}

            <div className="story-actions">
              <button className="px-btn" onClick={() => onOpen({})}>
                Open the book
              </button>
              <button className="ghost-btn" onClick={() => onOpen({ adding: true })}>
                Add a page
              </button>
            </div>
          </div>
        </div>
      )}

      <Garden pages={book.pages} />
    </section>
  );
}
