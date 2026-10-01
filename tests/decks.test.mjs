/**
 * Exercises the prompt decks. Pure logic, so it runs without a browser: the
 * point is that every deck hands back a card the panel can actually draw, and
 * that drawing again never lands on the card already on the table.
 *
 *   node --test tests/decks.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ANSWER_NO, ANSWER_YES, CHICKENED, DECKS, DID_IT, draw } from "../.test-build/decks.js";

const KINDS = ["ama", "wyr", "nhie", "tod"];

test("every deck is declared", () => {
  assert.deepEqual(DECKS.map((d) => d.kind).sort(), [...KINDS].sort());
  for (const deck of DECKS) {
    assert.ok(deck.name.length > 0, `${deck.kind} needs a name`);
    assert.ok(deck.blurb.length > 0, `${deck.kind} needs a blurb`);
  }
  assert.equal(DECKS.filter((d) => d.turnBased).length, 1, "only truth or dare takes turns");
});

test("every draw is renderable", () => {
  for (const kind of KINDS) {
    for (let i = 0; i < 300; i += 1) {
      const card = draw(kind);
      assert.ok(card.prompt.trim().length > 0, `${kind} drew an empty prompt`);
      if (kind === "ama") assert.equal(card.options.length, 0);
      else assert.equal(card.options.length, 2, `${kind} should offer two choices`);
      // A choice the player taps has to be something they can be shown back.
      for (const option of card.options) assert.ok(option.trim().length > 0);
    }
  }
});

test("would you rather offers both halves of its own question", () => {
  for (let i = 0; i < 200; i += 1) {
    const { prompt, options } = draw("wyr");
    assert.ok(prompt.startsWith("Would you rather: "));
    for (const option of options) assert.ok(prompt.includes(option));
    assert.notEqual(options[0], options[1]);
  }
});

test("never have I ever answers are the two fixed ones", () => {
  for (let i = 0; i < 100; i += 1) {
    assert.deepEqual(draw("nhie").options, [ANSWER_YES, ANSWER_NO]);
  }
});

test("truth or dare is labelled and always resolvable", () => {
  const seen = new Set();
  for (let i = 0; i < 400; i += 1) {
    const { prompt, options } = draw("tod");
    const label = prompt.split(":")[0];
    assert.ok(label === "Truth" || label === "Dare", `unexpected label ${label}`);
    assert.deepEqual(options, [DID_IT, CHICKENED]);
    seen.add(label);
  }
  assert.deepEqual([...seen].sort(), ["Dare", "Truth"], "both kinds should come up");
});

test("drawing again never repeats the card on the table", () => {
  for (const kind of KINDS) {
    let previous = draw(kind).prompt;
    for (let i = 0; i < 400; i += 1) {
      const next = draw(kind, previous).prompt;
      assert.notEqual(next, previous, `${kind} dealt the same card twice in a row`);
      previous = next;
    }
  }
});

test("an unknown deck is inert rather than throwing", () => {
  assert.deepEqual(draw(""), { prompt: "", options: [] });
});
