/**
 * The scrapbook's arrangement format.
 *
 * `parseLayout` is a security boundary: the JSON comes out of a table anyone
 * who knows the database name can write to, and every item in it ends up as
 * an element on the page. What it lets through has to be exactly the shapes
 * the page knows how to draw, and nothing else.
 *
 *   node --test tests/layout.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ITEMS,
  MAX_LAYOUT_BYTES,
  MAX_TEXT,
  defaultLayout,
  isSealed,
  layoutOf,
  newItemId,
  parseLayout,
  serializeLayout,
} from "../.test-build/layout.js";

const page = (over = {}) => ({
  id: 7,
  kind: "photo",
  charm: "hearts",
  w: 1600,
  h: 1200,
  layout: "",
  sealedBy: "",
  ...over,
});

test("a page that was never arranged still gets a full layout, the same one every time", () => {
  const a = defaultLayout(page());
  const b = defaultLayout(page());
  assert.deepEqual(a, b);
  assert.equal(a.items.filter((i) => i.t === "main").length, 1);
  assert.equal(a.items.filter((i) => i.t === "tape").length, 2);
  assert.ok(a.items.filter((i) => i.t === "sticker").length >= 2);
});

test("different pages are dressed differently", () => {
  const a = serializeLayout(defaultLayout(page({ id: 1 })));
  const b = serializeLayout(defaultLayout(page({ id: 2 })));
  assert.notEqual(a, b);
});

test("a note has no photo to anchor, so no main item and no tape", () => {
  const l = defaultLayout(page({ kind: "note", w: 0, h: 0 }));
  assert.equal(l.items.some((i) => i.t === "main" || i.t === "tape"), false);
});

test("what is written can be read back unchanged", () => {
  const l = defaultLayout(page());
  l.items.push({ id: "t1", t: "text", x: 300, y: 700, r: -4, s: 400, txt: "the lake" });
  const back = parseLayout(serializeLayout(l));
  assert.deepEqual(back, { v: 1, items: l.items });
});

test("garbage is not a layout", () => {
  assert.equal(parseLayout(""), null);
  assert.equal(parseLayout("not json"), null);
  assert.equal(parseLayout("[1,2]"), null);
  assert.equal(parseLayout('{"v":1}'), null);
  assert.equal(parseLayout("{" + "x".repeat(MAX_LAYOUT_BYTES) + "}"), null);
});

test("items the page cannot draw are dropped one by one, not the whole page", () => {
  const raw = JSON.stringify({
    v: 1,
    items: [
      { id: "ok", t: "sticker", k: "HEART", x: 100, y: 100, r: 0, s: 100 },
      { id: "bad-kind", t: "iframe", x: 1, y: 1, r: 0, s: 1 },
      { id: "bad-sticker", t: "sticker", k: "__proto__", x: 1, y: 1, r: 0, s: 1 },
      { id: "no-words", t: "text", txt: "   ", x: 1, y: 1, r: 0, s: 1 },
      { id: "ok", t: "sticker", k: "STAR", x: 1, y: 1, r: 0, s: 1 },
      { id: "<script>", t: "sticker", k: "STAR", x: 1, y: 1, r: 0, s: 1 },
      { id: "m1", t: "main", x: 500, y: 500, r: 0, s: 700 },
      { id: "m2", t: "main", x: 500, y: 500, r: 0, s: 700 },
      "nope",
      null,
    ],
  });
  const l = parseLayout(raw);
  assert.deepEqual(
    l.items.map((i) => i.id),
    ["ok", "m1"],
  );
});

test("numbers are clamped to the page and text is cut to length", () => {
  const raw = JSON.stringify({
    v: 1,
    items: [
      { id: "a", t: "text", txt: "x".repeat(MAX_TEXT + 50), x: -40, y: 5000, r: 720, s: 1 },
      { id: "b", t: "tape", k: "neon", x: "left", y: null, r: NaN, s: 9e9 },
    ],
  });
  const [a, b] = parseLayout(raw).items;
  assert.equal(a.txt.length, MAX_TEXT);
  assert.deepEqual([a.x, a.y, a.r, a.s], [0, 1000, 180, 40]);
  assert.equal(b.k, "plain", "an unknown tape tint falls back to plain");
  assert.deepEqual([b.x, b.y, b.r, b.s], [500, 500, 0, 1000]);
});

test("a page cannot hold more than the limit", () => {
  const items = Array.from({ length: MAX_ITEMS + 10 }, (_, i) => ({
    id: `s${i}`,
    t: "sticker",
    k: "HEART",
    x: 500,
    y: 500,
    r: 0,
    s: 100,
  }));
  assert.equal(parseLayout(JSON.stringify({ v: 1, items })).items.length, MAX_ITEMS);
  assert.equal(JSON.parse(serializeLayout({ v: 1, items })).items.length, MAX_ITEMS);
});

test("serialising rounds so the row stays small", () => {
  const out = serializeLayout({ v: 1, items: [{ id: "a", t: "sticker", k: "HEART", x: 123.456, y: 1.5, r: -0.4, s: 99.9 }] });
  assert.equal(out, '{"v":1,"items":[{"id":"a","t":"sticker","x":123,"y":2,"r":0,"s":100,"k":"HEART"}]}');
  assert.ok(serializeLayout(defaultLayout(page())).length < MAX_LAYOUT_BYTES / 4);
});

test("a stored arrangement wins over the default, and a broken one falls back to it", () => {
  const own = serializeLayout({ v: 1, items: [{ id: "x", t: "sticker", k: "MOON", x: 1, y: 1, r: 0, s: 80 }] });
  assert.equal(layoutOf(page({ layout: own })).items[0].k, "MOON");
  assert.deepEqual(layoutOf(page({ layout: "{{" })), defaultLayout(page()));
});

test("item ids do not repeat in a burst", () => {
  const ids = new Set(Array.from({ length: 200 }, () => newItemId()));
  assert.equal(ids.size, 200);
});

test("a page is sealed the moment someone's name is on it", () => {
  assert.equal(isSealed(page()), false);
  assert.equal(isSealed(page({ sealedBy: "Moon" })), true);
});
