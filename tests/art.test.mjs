/**
 * Every sprite on the site, checked the same way the birthday sheet is.
 *
 * A row one character short, or a character with no colour behind it, is a
 * hole in the art. The renderer draws it without complaint and nobody finds
 * out until it is on a phone, so it is caught here instead.
 *
 *   node --test tests/art.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { GLYPH, INK } from "../.test-build/art/palette.js";
import { ICONS } from "../.test-build/art/icons.js";
import {
  CLOUDS,
  DARK_WINDOW,
  HOUSE_CHIMNEY,
  HOUSE_EAVE,
  HOUSE_LAMP,
  HOUSE_STEP,
  HOUSE_WINDOW,
  HOUSES,
  LIT_WINDOW,
  NIGHT,
  SCENERY_INK,
  SCENERY_SHEET,
  TUFT,
  VILLAGE,
} from "../.test-build/art/scenery.js";
import { BLOOMS, PLANTS, STICKERS, STICKER_SHEET, TAPE } from "../.test-build/art/stickers.js";
import { DISC, FACES, PIECE_SHEET, discFor, pieceFor } from "../.test-build/art/pieces.js";
import { DOODLE_INK, INKS, PAPER } from "../.test-build/art/inks.js";
import { CHARMS } from "../.test-build/pages.js";
import { PARTY } from "../.test-build/sprites.js";

function rectangular(name, rows) {
  assert.ok(rows.length > 0, `${name} is empty`);
  const w = rows[0].length;
  assert.ok(w > 0, `${name} has no width`);
  for (let y = 0; y < rows.length; y++) {
    assert.equal(rows[y].length, w, `${name} row ${y} is ${rows[y].length} wide, expected ${w}`);
  }
}

function inPalette(name, rows, known) {
  for (let y = 0; y < rows.length; y++) {
    for (const ch of rows[y]) {
      assert.ok(ch === "." || known.has(ch), `${name} row ${y} uses "${ch}", which has no colour`);
    }
  }
}

const HEX = /^#[0-9a-f]{6}$/;

test("the shared palette is all real colours, and carries the birthday one", () => {
  for (const [key, hex] of Object.entries(INK)) {
    assert.equal(key.length, 1, `"${key}" is not a single character`);
    assert.match(hex, HEX, `INK.${key} is ${hex}`);
  }
  for (const [key, hex] of Object.entries(PARTY)) {
    assert.equal(INK[key], hex, `INK.${key} drifted from the birthday palette`);
  }
});

test("every icon is twelve by twelve and fully coloured", () => {
  const known = new Set(Object.keys(GLYPH));
  for (const [name, rows] of Object.entries(ICONS)) {
    rectangular(name, rows);
    assert.equal(rows.length, 12, `${name} is ${rows.length} tall`);
    assert.equal(rows[0].length, 12, `${name} is ${rows[0].length} wide`);
    inPalette(name, rows, known);
    assert.ok(rows.some((r) => r.includes("x")), `${name} has nothing that takes the text colour`);
  }
});

test("an icon and its switched-off twin are different pictures", () => {
  assert.notDeepEqual(ICONS.mic, ICONS.micOff);
  assert.notDeepEqual(ICONS.camera, ICONS.cameraOff);
  assert.notDeepEqual(ICONS.left, ICONS.right);
});

test("the scenery is clean", () => {
  for (const [name, rows] of Object.entries(SCENERY_SHEET)) {
    rectangular(name, rows);
    inPalette(name, rows, SCENERY_INK);
  }
  for (const hex of [...Object.values(NIGHT), ...Object.values(DARK_WINDOW), ...Object.values(LIT_WINDOW)]) {
    assert.match(hex, HEX);
  }
  // A swap that lit one window but not the other would look like a bug.
  for (const key of Object.keys(DARK_WINDOW)) assert.ok(key in NIGHT && key in LIT_WINDOW);
  for (const key of Object.keys(LIT_WINDOW)) assert.ok(key in NIGHT, `LIT_WINDOW.${key} has no unlit colour`);
});

test("the two houses are the same size, so one set of anchors fits both", () => {
  const [a, b] = HOUSES;
  assert.equal(a.length, b.length);
  assert.equal(a[0].length, b[0].length);
  assert.notDeepEqual(a, b, "the two houses are identical");
  assert.ok(a[0].length >= 22 && a[0].length <= 26, `a house is ${a[0].length} wide`);
});

test("the glow, the smoke, the lamp and the path are aimed at the right pixels of each house", () => {
  for (const house of HOUSES) {
    const { x, y, size } = HOUSE_WINDOW;
    let bright = 0;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const ch = house[y + dy][x + dx];
        assert.ok(ch === "y" || ch === "Y" || ch === "f", `the lit window would paint over "${ch}"`);
        if (ch === "Y") bright += 1;
      }
    }
    assert.ok(bright >= 1, "no pane is the bright one");
    // The frame is a cross through the middle row and column.
    assert.equal(house[y + 2][x], "f");
    assert.equal(house[y][x + 2], "f");
    assert.equal(house[HOUSE_CHIMNEY.y + 1][HOUSE_CHIMNEY.x], "c", "the smoke does not start at the chimney");
    assert.equal(house[HOUSE_LAMP.y][HOUSE_LAMP.x], "o", "the lamp glow is not on the lamp");
    assert.equal(house[HOUSE_STEP.y][HOUSE_STEP.x], "S", "the path does not start at the step");
    assert.ok(/^\.r?q+QQ\.$/.test(house[HOUSE_EAVE]), "the lights would not be tied to the eave");
    // Nothing above the chimney top, so the smoke is not drawn through roof.
    for (let dy = 0; dy < HOUSE_CHIMNEY.y; dy++) assert.equal(house[dy][HOUSE_CHIMNEY.x], ".");
  }
});

test("the grass, the hamlet and the clouds are drawn the way the scene expects", () => {
  // The two blades of grass swap in place, so they must be the same size.
  assert.equal(TUFT[0].length, TUFT[1].length);
  assert.equal(TUFT[0][0].length, TUFT[1][0].length);
  assert.notDeepEqual(TUFT[0], TUFT[1]);
  assert.equal(VILLAGE.length, 3);
  assert.ok(VILLAGE[0].some((r) => r.includes("w")), "nobody in the hamlet has a light on");
  for (const rows of CLOUDS) {
    assert.ok(rows[0].includes("C"), "a cloud with no moonlit top");
    assert.ok(rows[rows.length - 1].includes("u"), "a cloud with no shaded underside");
    assert.ok(!rows[0].includes("u") && !rows[rows.length - 1].includes("C"), "a cloud lit from below");
  }
});

test("the stickers and plants are clean", () => {
  const known = new Set(Object.keys(INK));
  for (const [name, rows] of Object.entries(STICKER_SHEET)) {
    rectangular(name, rows);
    inPalette(name, rows, known);
  }
  for (const rows of Object.values(PLANTS)) rectangular("plant", rows);
});

test("every set of stickers has three, a tape colour, and a name to pick it by", () => {
  for (const charm of CHARMS) {
    assert.equal(STICKERS[charm]?.length, 3, `${charm} does not have three stickers`);
    assert.ok(TAPE[charm], `${charm} has no tape`);
    for (const s of STICKERS[charm]) {
      rectangular(charm, s.rows);
      inPalette(charm, s.rows, new Set(Object.keys(s.palette)));
    }
  }
  assert.equal(BLOOMS.length, 4);
});

test("the game pieces are clean", () => {
  const known = new Set([...Object.keys(GLYPH), "h"]);
  for (const [name, rows] of Object.entries(PIECE_SHEET)) {
    rectangular(name, rows);
    inPalette(name, rows, known);
  }
  for (const name of ["Moon", "Star"]) {
    const disc = discFor(name);
    inPalette(`${name}'s disc`, DISC, new Set(Object.keys(disc)));
    const piece = pieceFor(name);
    rectangular(`${name}'s piece`, piece.rows);
  }
});

test("the two of them never share a piece", () => {
  assert.notDeepEqual(pieceFor("Moon").rows, pieceFor("Star").rows);
  assert.notDeepEqual(discFor("Moon"), discFor("Star"));
});

test("pairs has a face for every letter the server deals, and no two alike", () => {
  const letters = "ABCDEFGH".split("");
  assert.deepEqual(Object.keys(FACES).sort(), letters);
  const seen = new Set();
  for (const letter of letters) {
    const face = FACES[letter];
    rectangular(`face ${letter}`, face.rows);
    inPalette(`face ${letter}`, face.rows, new Set(Object.keys(face.palette)));
    seen.add(JSON.stringify(face));
  }
  assert.equal(seen.size, 8, "two cards that are not a pair look the same");
});

test("every ink is one lowercase letter, used once", () => {
  const keys = INKS.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, "two inks share a letter");
  for (const ink of INKS) {
    assert.match(ink.key, /^[a-z]$/, `"${ink.key}" is not a letter the server accepts`);
    assert.match(ink.hex, HEX);
    assert.ok(ink.name.length > 0);
    assert.equal(DOODLE_INK[ink.key], ink.hex);
  }
  assert.equal(new Set(INKS.map((i) => i.hex)).size, INKS.length, "two inks are the same colour");
  assert.match(PAPER, HEX);
  assert.ok(!INKS.some((i) => i.hex === PAPER), "an ink the colour of the paper cannot be seen");
});
