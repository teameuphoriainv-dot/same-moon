/**
 * Covers the two things about the birthday decor that can silently break and
 * that reading the source will not reveal:
 *
 *   1. A sprite row of the wrong length, or a character with no palette entry,
 *      is a hole in the art. The renderer draws it without complaining.
 *   2. The birthday has to key off the local calendar, honouring the 5am
 *      rollover, exactly like every other day key on the site.
 *
 *   node --test tests/birthday.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { CANDLES, LETTER, isBirthday, birthdayNow, birthdayKey, parseBirthday, BIRTHDAY } from "../.test-build/birthday.js";

/** Any real date works; the site reads the couple's from NEXT_PUBLIC_BIRTHDAY. */
const SAMPLE = { month: 9, day: 20 };
import { PARTY, SHEET } from "../.test-build/sprites.js";

test("every sprite is a clean rectangle", () => {
  for (const [name, rows] of Object.entries(SHEET)) {
    assert.ok(rows.length > 0, `${name} is empty`);
    const w = rows[0].length;
    for (let y = 0; y < rows.length; y++) {
      assert.equal(rows[y].length, w, `${name} row ${y} is ${rows[y].length}, expected ${w}`);
    }
  }
});

test("every sprite character is transparent or in the palette", () => {
  // `c` is the swap slot the bunting fills in per flag, so it is legal too.
  const known = new Set([...Object.keys(PARTY), ".", "c"]);
  for (const [name, rows] of Object.entries(SHEET)) {
    for (let y = 0; y < rows.length; y++) {
      for (const ch of rows[y]) {
        assert.ok(known.has(ch), `${name} row ${y} uses unmapped character "${ch}"`);
      }
    }
  }
});

test("the two candle states line up pixel for pixel", () => {
  const lit = SHEET.CANDLE_LIT;
  const out = SHEET.CANDLE_OUT;
  assert.equal(lit.length, out.length, "candle states differ in height");
  assert.equal(lit[0].length, out[0].length, "candle states differ in width");
  // The wax has to stay put when the flame goes, or the candle jumps on tap.
  assert.equal(lit.at(-1), out.at(-1), "the candle base moved when it was snuffed");
});

test("the birthday is the local calendar day, not UTC", () => {
  assert.ok(isBirthday(birthdayKey(2026, SAMPLE), SAMPLE));
  assert.ok(isBirthday(birthdayKey(2030, SAMPLE), SAMPLE), "it has to come round every year");
  assert.equal(isBirthday("2026-09-19", SAMPLE), false);
  assert.equal(isBirthday("2026-09-21", SAMPLE), false);
  assert.equal(isBirthday("2026-10-20", SAMPLE), false, "the month has to match too");
});

test("birthdayKey pads to a real day key", () => {
  assert.match(birthdayKey(2026, SAMPLE), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(birthdayKey(2026, { month: 3, day: 7 }), "2026-03-07");
});

test("no birthday is set unless the couple sets one", () => {
  assert.equal(BIRTHDAY, null, "the test build has no NEXT_PUBLIC_BIRTHDAY, so the decor stays off");
  assert.equal(isBirthday("2026-09-20"), false);
  assert.equal(birthdayNow(new Date(2026, 8, 20, 12, 0)), null);
});

test("parseBirthday takes MM-DD and nothing else", () => {
  assert.deepEqual(parseBirthday("09-20"), { month: 9, day: 20 });
  assert.deepEqual(parseBirthday("3-7"), { month: 3, day: 7 });
  assert.equal(parseBirthday(""), null);
  assert.equal(parseBirthday(undefined), null);
  assert.equal(parseBirthday("13-01"), null);
  assert.equal(parseBirthday("2026-09-20"), null);
});

test("the card has something to say on every candle", () => {
  assert.ok(CANDLES.length >= 3, "a cake needs candles");
  for (const c of CANDLES) {
    assert.ok(c.title.trim().length > 0, "every candle needs a title");
    assert.ok(c.line.trim().length > 0, `candle "${c.title}" has no line`);
  }
  const titles = CANDLES.map((c) => c.title);
  assert.equal(new Set(titles).size, titles.length, "candle titles have to be unique, they are React keys");
  assert.ok(LETTER.length > 0, "the letter cannot be empty");
});

test("the decor is up for every hour of the birthday, rollover included", () => {
  const M = SAMPLE.month - 1;
  const D = SAMPLE.day;

  // The bug this pins: nights roll over at 5am, so from midnight until 5am on
  // the birthday `nightKey` still reports the day before. Keyed on that alone
  // the decor stayed dark for the first five hours of the day it exists for.
  for (const hour of [0, 1, 2, 3, 4, 5, 6, 12, 18, 23]) {
    const at = new Date(2026, M, D, hour, 30);
    assert.equal(
      birthdayNow(at, SAMPLE),
      birthdayKey(2026, SAMPLE),
      `decor should be up at ${hour}:30 on the birthday`,
    );
  }

  // It also has to survive past midnight into the small hours of the next day,
  // which is the whole reason the rollover was being consulted in the first place.
  assert.equal(birthdayNow(new Date(2026, M, D + 1, 2, 0), SAMPLE), birthdayKey(2026, SAMPLE));

  // And it has to be off on every other day, from both directions.
  assert.equal(birthdayNow(new Date(2026, M, D - 1, 12, 0), SAMPLE), null);
  assert.equal(birthdayNow(new Date(2026, M, D + 1, 12, 0), SAMPLE), null);
  assert.equal(birthdayNow(new Date(2026, M, D + 1, 5, 30), SAMPLE), null, "5am the day after is over");
});
