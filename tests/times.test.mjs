/**
 * How times are said, and who counts as here.
 *
 * Both take the clock as an argument, so every case below is exact. Nothing in
 * this file waits for anything.
 *
 *   node --test tests/times.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ago, clock, spell } from "../.test-build/ago.js";
import { QUIET_MS, isHere, presenceLabel } from "../.test-build/here.js";

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;
const NOW = new Date(2026, 8, 28, 22, 0, 0).getTime();

test("a gap is said the way a person would say it", () => {
  assert.equal(ago(NOW, NOW), "just now");
  assert.equal(ago(NOW - 59 * S, NOW), "just now");
  assert.equal(ago(NOW - 60 * S, NOW), "1m ago");
  assert.equal(ago(NOW - 59 * M, NOW), "59m ago");
  assert.equal(ago(NOW - H, NOW), "1h ago");
  assert.equal(ago(NOW - 23 * H, NOW), "23h ago");
  assert.equal(ago(NOW - D, NOW), "yesterday");
  assert.equal(ago(NOW - 2 * D, NOW), "2d ago");
  assert.equal(ago(NOW - 6 * D, NOW), "6d ago");
});

test("past a week it is a date, with the year only when it is a different one", () => {
  assert.equal(ago(new Date(2026, 8, 20, 9, 0).getTime(), NOW), "Sep 20");
  assert.equal(ago(new Date(2025, 11, 31, 9, 0).getTime(), NOW), "Dec 31, 2025");
});

test("a time in the future is never a negative gap", () => {
  // A phone whose clock runs slow sees the other one's check-in as ahead of it.
  assert.equal(ago(NOW + 5 * M, NOW), "just now");
});

test("the call clock counts up and only shows hours once there are some", () => {
  assert.equal(clock(0), "0:00");
  assert.equal(clock(7 * S), "0:07");
  assert.equal(clock(4 * M + 7 * S), "4:07");
  assert.equal(clock(59 * M + 59 * S), "59:59");
  assert.equal(clock(H + 2 * M + 45 * S), "1:02:45");
  assert.equal(clock(-5 * S), "0:00");
});

test("a call's length is said in words", () => {
  assert.equal(spell(20 * S), "under a minute");
  assert.equal(spell(M), "1 minute");
  assert.equal(spell(42 * M + 30 * S), "42 minutes");
  assert.equal(spell(H), "1 hour");
  assert.equal(spell(H + M), "1 hour 1 minute");
  assert.equal(spell(2 * H + 5 * M), "2 hours 5 minutes");
});

const row = (active, at) => ({ who: "Moon", active, place: "home", at });

test("here means checked in, and recently", () => {
  assert.equal(isHere(row(true, NOW - 10 * S), NOW), true);
  assert.equal(isHere(row(true, NOW - QUIET_MS + 1), NOW), true);
  assert.equal(isHere(null, NOW), false);
});

test("a phone that died without saying goodbye still goes quiet", () => {
  // The flag is still up, because nothing was there to take it down.
  assert.equal(isHere(row(true, NOW - QUIET_MS), NOW), false);
  assert.equal(isHere(row(true, NOW - 3 * H), NOW), false);
});

test("saying goodbye counts straight away", () => {
  assert.equal(isHere(row(false, NOW - 2 * S), NOW), false);
});

test("the line under their name", () => {
  assert.equal(presenceLabel(null, NOW), "", "nothing to say about someone who has never been here");
  assert.equal(presenceLabel(row(true, NOW - 5 * S), NOW), "Active now");
  assert.equal(presenceLabel(row(false, NOW - 5 * S), NOW), "Last active just now");
  assert.equal(presenceLabel(row(false, NOW - 12 * M), NOW), "Last active 12m ago");
  assert.equal(presenceLabel(row(true, NOW - 3 * H), NOW), "Last active 3h ago");
});
