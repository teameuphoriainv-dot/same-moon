"use client";

import { loadDoor } from "./auth";
import { coalesce, isCloud, onReady, withConn } from "./conn";
import type { NewScrap, Scrap, ScrapKind } from "./types";

const KINDS = new Set(["photo", "doodle", "note"]);

/**
 * The storybook's pages. The rows live in the database, the photos themselves
 * live in file storage, and this is the only place that knows about both.
 */
export const scrapbook = {
  available: isCloud,

  watch(cb: (pages: Scrap[]) => void): () => void {
    if (!isCloud) return () => {};
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        // The arrangement and the seal live in a side table (see scrap.rs for
        // why), joined here so the rest of the client sees one page.
        const extras = new Map<bigint, { layout: string; sealedBy: string; sealedAt: number }>();
        for (const x of conn.db.scrap_layout.iter()) {
          extras.set(x.scrapId, {
            layout: x.layout,
            sealedBy: x.sealedBy,
            sealedAt: x.sealedAt ? Number(x.sealedAt.toMillis()) : 0,
          });
        }
        cb(
          [...conn.db.scrap.iter()]
            .filter((row) => KINDS.has(row.kind))
            .map((row) => ({
              ...(extras.get(row.id) ?? { layout: "", sealedBy: "", sealedAt: 0 }),
              id: Number(row.id),
              kind: row.kind as ScrapKind,
              url: row.url,
              thumb: row.thumb,
              art: row.art,
              caption: row.caption,
              day: row.day,
              charm: row.charm,
              w: row.w,
              h: row.h,
              by: row.by,
              at: Number(row.at.toMillis()),
            })),
        );
      });
      conn.db.scrap.onInsert(push);
      conn.db.scrap.onUpdate(push);
      conn.db.scrap.onDelete(push);
      conn.db.scrap_layout.onInsert(push);
      conn.db.scrap_layout.onUpdate(push);
      conn.db.scrap_layout.onDelete(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },

  async add(page: NewScrap, by: string) {
    // `withConn` answers null when there is no connection to send on. Saying
    // so matters here: a page that quietly never arrived looks like a bug.
    const sent = await withConn((conn) =>
      conn.reducers.addScrap({
        kind: page.kind,
        url: page.url ?? "",
        thumb: page.thumb ?? "",
        art: page.art ?? "",
        caption: page.caption,
        day: page.day,
        charm: page.charm,
        w: page.w ?? 0,
        h: page.h ?? 0,
        by,
      }),
    );
    if (sent === null) throw new Error("You are offline, so the page was not added. Try again in a moment.");
  },
  async edit(id: number, caption: string, day: string, charm: string) {
    await withConn((conn) => conn.reducers.editScrap({ id: BigInt(id), caption, day, charm }));
  },
  async remove(id: number) {
    await withConn((conn) => conn.reducers.removeScrap({ id: BigInt(id) }));
  },
  /** Save where things sit on a page. Refused by the module once it is sealed. */
  async setLayout(id: number, layout: string) {
    await withConn((conn) => conn.reducers.setLayout({ id: BigInt(id), layout }));
  },
  /** Seal a page with a kiss. There is no way back from this, by design. */
  async seal(id: number, by: string) {
    const sent = await withConn((conn) => conn.reducers.sealScrap({ id: BigInt(id), by }));
    if (sent === null) throw new Error("You are offline, so the page was not sealed. Try again in a moment.");
  },
};

/** Send a photo to storage and get back where it now lives. */
export async function uploadPhoto(blob: Blob, who: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/photos", {
      method: "POST",
      headers: { "content-type": "image/jpeg", "x-same-moon-code": loadDoor(), "x-same-moon-who": who },
      body: blob,
    });
  } catch {
    throw new Error("The photo could not be sent. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? "The photo could not be saved. Try again.");
  }
  return body.url;
}

/** Throw a stored photo away. Nothing depends on this working, so it never throws. */
export async function discardPhoto(url: string, who: string): Promise<void> {
  try {
    await fetch(`/api/photos?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
      headers: { "x-same-moon-code": loadDoor(), "x-same-moon-who": who },
    });
  } catch {
    /* an orphaned photo costs a few hundred kilobytes and nothing else */
  }
}
