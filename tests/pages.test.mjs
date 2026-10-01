/**
 * The storybook's arithmetic, the canvas's wire format, and the drawing ideas.
 *
 * The two `safe` checks matter most. A page's photo address and thumbnail come
 * out of a database that anyone who knows its name can write to, and they are
 * put straight into the page, so what they let through is a security boundary.
 *
 *   node --test tests/pages.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CHARMS,
  artRows,
  charmOf,
  decorFor,
  inOrder,
  plantFor,
  safePhoto,
  safeThumb,
} from "../.test-build/pages.js";
import { IDEAS, nextIdea } from "../.test-build/ideas.js";
import { encodeStrokes } from "../.test-build/strokes.js";

const page = (id, day) => ({ id, day, kind: "note", caption: "x" });

test("pages are read in the order they happened, not the order they were added", () => {
  const book = [page(1, "2026-09-10"), page(2, "2026-08-01"), page(3, "2026-09-10"), page(4, "2025-12-31")];
  assert.deepEqual(inOrder(book).map((p) => p.id), [4, 2, 1, 3]);
});

test("putting pages in order does not disturb the list it was given", () => {
  const book = [page(2, "2026-09-10"), page(1, "2026-08-01")];
  inOrder(book);
  assert.deepEqual(book.map((p) => p.id), [2, 1]);
});

test("a page is dressed the same way every time it is opened", () => {
  for (const id of [1, 2, 17, 999, 123456]) {
    assert.deepEqual(decorFor(id), decorFor(id), `page ${id} changed between two looks`);
  }
});

test("every page gets three stickers in three different corners", () => {
  for (let id = 1; id <= 200; id++) {
    const { stickers, tilt } = decorFor(id);
    assert.equal(stickers.length, 3);
    assert.equal(new Set(stickers.map((s) => s.slot)).size, 3, `page ${id} stacked two stickers`);
    assert.ok(Math.abs(tilt) <= 2, `page ${id} is tilted ${tilt}, which is too far`);
    for (const s of stickers) assert.ok(s.which >= 0 && s.which < 3 && s.size >= 24);
  }
});

test("pages do not all look alike", () => {
  const looks = new Set();
  for (let id = 1; id <= 60; id++) looks.add(JSON.stringify(decorFor(id)));
  assert.ok(looks.size > 20, `only ${looks.size} different looks in 60 pages`);
});

test("an unknown set of stickers falls back instead of breaking the page", () => {
  for (const c of CHARMS) assert.equal(charmOf(c), c);
  assert.equal(charmOf(""), "hearts");
  assert.equal(charmOf("constructor"), "hearts");
});

test("only an https address is drawn as a photo", () => {
  assert.equal(
    safePhoto("https://abc.public.blob.vercel-storage.com/book/a-Xy9.jpg"),
    "https://abc.public.blob.vercel-storage.com/book/a-Xy9.jpg",
  );
  for (const bad of [
    "",
    "http://plain.example/a.jpg",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://a.example/x.jpg\" onerror=\"alert(1)",
    "https://a.example/x.jpg') url('https://evil.example/",
    " https://a.example/x.jpg",
    "//a.example/x.jpg",
  ]) {
    assert.equal(safePhoto(bad), null, `let through: ${bad}`);
  }
});

test("only a small base64 image is drawn as a preview", () => {
  const good = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
  assert.equal(safeThumb(good), good);
  for (const bad of [
    "",
    "https://a.example/x.jpg",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/svg+xml;base64,PHN2Zz4=",
    'data:image/jpeg;base64,AAAA"); background:url("https://evil.example',
    "data:image/jpeg;base64,AAAA) url(https://evil.example",
    "data:image/jpeg;base64," + "A".repeat(17 * 1024),
  ]) {
    assert.equal(safeThumb(bad), null, `let through: ${bad.slice(0, 60)}`);
  }
});

test("a drawing is only drawn if it is a square of inks", () => {
  const rows = artRows("k..r" + "...." + "abcd" + "zzzz");
  assert.deepEqual(rows, ["k..r", "....", "abcd", "zzzz"]);
  assert.equal(artRows("k".repeat(1024)).length, 32);
  assert.equal(artRows(""), null);
  assert.equal(artRows("k".repeat(1000)), null, "1000 is not a square");
  assert.equal(artRows("K..."), null, "capitals are not inks");
  assert.equal(artRows("<b>."), null);
});

test("every page grows a plant, and always the same one", () => {
  const kinds = new Set();
  for (let id = 1; id <= 100; id++) {
    const plant = plantFor(id);
    assert.deepEqual(plant, plantFor(id));
    assert.ok(["flower", "sprout", "tall"].includes(plant.kind));
    assert.ok(plant.hue >= 0 && plant.hue < 4);
    kinds.add(plant.kind);
  }
  assert.equal(kinds.size, 3, "the garden should not be one plant over and over");
});

test("strokes are packed as two base 36 digits and an ink", () => {
  assert.equal(encodeStrokes(new Map([[0, "k"]])), "00k");
  assert.equal(encodeStrokes(new Map([[35, "b"]])), "0zb");
  assert.equal(encodeStrokes(new Map([[36, "r"]])), "10r");
  assert.equal(encodeStrokes(new Map([[1023, "."]])), "sf.", "the last pixel of a 32 by 32 sheet");
  assert.equal(encodeStrokes(new Map([[0, "k"], [1, "r"], [35, "b"]])), "00k01r0zb");
  assert.equal(encodeStrokes(new Map()), "");
});

test("every position on the sheet packs to exactly three characters", () => {
  for (let at = 0; at < 1024; at++) {
    const packed = encodeStrokes(new Map([[at, "k"]]));
    assert.equal(packed.length, 3, `pixel ${at} packed to "${packed}"`);
    assert.equal(parseInt(packed.slice(0, 2), 36), at);
  }
});

test("asking for another idea never gives the same one back", () => {
  assert.ok(IDEAS.length >= 8);
  assert.equal(new Set(IDEAS).size, IDEAS.length, "an idea is listed twice");
  for (const idea of IDEAS) {
    for (const roll of [0, 0.5, 0.999]) {
      const next = nextIdea(idea, () => roll);
      assert.notEqual(next, idea);
      assert.ok(IDEAS.includes(next));
    }
  }
  assert.ok(IDEAS.includes(nextIdea("", () => 0)), "a blank canvas still gets an idea");
});

test("no idea uses a dash, and every one ends like a sentence", () => {
  for (const idea of IDEAS) {
    assert.ok(!/[–—]/.test(idea), `"${idea}" has a dash in it`);
    assert.match(idea, /\.$/, `"${idea}" does not end with a full stop`);
    assert.ok(idea.length <= 120, `"${idea}" is too long for the server to keep`);
  }
});
