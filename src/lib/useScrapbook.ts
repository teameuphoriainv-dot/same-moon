"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { serializeLayout, type Layout } from "./layout";
import { inOrder } from "./pages";
import type { Prepared } from "./photo";
import { discardPhoto, scrapbook, uploadPhoto } from "./scrapbook";
import type { Scrap } from "./types";

export interface PageWords {
  caption: string;
  day: string;
  charm: string;
}

export function useScrapbook(who: string | null) {
  const [raw, setRaw] = useState<Scrap[]>([]);

  useEffect(() => scrapbook.watch(setRaw), []);

  const pages = useMemo(() => inOrder(raw), [raw]);

  /**
   * The photo goes to storage first and the page is written second. Done the
   * other way round, a failed upload would leave a page in the book pointing
   * at a picture that does not exist.
   */
  const addPhoto = useCallback(
    async (photo: Prepared, words: PageWords) => {
      if (!who) return;
      const url = await uploadPhoto(photo.blob, who);
      await scrapbook.add(
        { kind: "photo", url, thumb: photo.thumb, w: photo.w, h: photo.h, ...words },
        who,
      );
    },
    [who],
  );

  const addNote = useCallback(
    async (words: PageWords) => {
      if (!who) return;
      await scrapbook.add({ kind: "note", ...words }, who);
    },
    [who],
  );

  const addDoodle = useCallback(
    async (art: string, words: PageWords) => {
      if (!who) return;
      await scrapbook.add({ kind: "doodle", art, ...words }, who);
    },
    [who],
  );

  const edit = useCallback(async (id: number, words: PageWords) => {
    await scrapbook.edit(id, words.caption, words.day, words.charm);
  }, []);

  const remove = useCallback(
    async (page: Scrap) => {
      await scrapbook.remove(page.id);
      if (who && page.kind === "photo" && page.url) void discardPhoto(page.url, who);
    },
    [who],
  );

  /** Save an arrangement. Cheap enough to call on every drop. */
  const arrange = useCallback(async (id: number, layout: Layout) => {
    await scrapbook.setLayout(id, serializeLayout(layout));
  }, []);

  const seal = useCallback(
    async (id: number) => {
      if (!who) return;
      await scrapbook.seal(id, who);
    },
    [who],
  );

  return {
    available: scrapbook.available,
    arrange,
    seal,
    pages,
    /** The newest page by when it was added, which is not always the last one read. */
    newest: raw.reduce<Scrap | null>((top, p) => (!top || p.id > top.id ? p : top), null),
    addPhoto,
    addNote,
    addDoodle,
    edit,
    remove,
  };
}

export type Scrapbook = ReturnType<typeof useScrapbook>;
