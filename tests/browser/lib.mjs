/**
 * Shared by the browser runs in this folder.
 *
 * These drive the real site in two signed-in browsers at once, one as each of
 * them, and check what is on screen: a call that actually connects, a photo
 * that actually uploads, a move on one phone showing up on the other. They
 * read the page and never take a picture of it.
 *
 * They must never be pointed at the live database. Each one rings phones,
 * wipes the canvas and adds and removes pages. Run them against a copy:
 *
 *   spacetime start --listen-addr 127.0.0.1:3055 --in-memory &
 *   spacetime server add smtest --url http://127.0.0.1:3055 --no-fingerprint
 *   (cd spacetime && spacetime publish -y --server smtest samemoon-probe)
 *
 *   export SM_DIST_DIR=.next-probe
 *   export NEXT_PUBLIC_STDB_HOST=ws://127.0.0.1:3055
 *   export NEXT_PUBLIC_STDB_MODULE=samemoon-probe
 *   npx next build && SAME_MOON_DOOR=probe-door npx next start -p 8941 &
 *
 *   npm i --no-save playwright-core@1.49.1
 *   SM_URL=http://localhost:8941 node tests/browser/call.mjs
 *
 * `next build` adds the second build folder to tsconfig.json. Put that back
 * afterwards. The photo run uploads to real storage and deletes what it added.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

export const URL = process.env.SM_URL;
if (!URL) {
  console.error("Set SM_URL to a copy of the site that is NOT on the live database.");
  process.exit(2);
}

/**
 * Refuse to run against the live database, whatever the environment says.
 *
 * NEXT_PUBLIC_* values are baked into the bundle at build time. A build made
 * without them quietly carries the live module name from .env.local, and a
 * run against that bundle rings real phones and writes real pages. This
 * happened once. So the served scripts are searched for the live name before
 * a single browser opens, and the run stops if it is there.
 */
async function refuseLive() {
  let live = "";
  try {
    live = readFileSync(".stdb-name", "utf8").trim();
  } catch {
    return; // no live name on this machine, nothing to collide with
  }
  if (!live) return;
  const html = await (await fetch(URL)).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new globalThis.URL(m[1], URL).href);
  for (const src of scripts) {
    const body = await (await fetch(src)).text();
    if (body.includes(live)) {
      console.error(`The site at ${URL} was built against the LIVE database (${src}).`);
      console.error("Rebuild it with NEXT_PUBLIC_STDB_HOST and NEXT_PUBLIC_STDB_MODULE set to the probe.");
      process.exit(3);
    }
  }
}
await refuseLive();

/** The probe server has to be started with the same SAME_MOON_DOOR. */
export const DOOR = process.env.SM_DOOR ?? "probe-door";

// Every suite expects the probe couple to be Mira (the moon) and Theo (the star).
try {
  execFileSync("spacetime", ["call", "--server", "smtest", process.env.SM_MODULE ?? "samemoon-probe", "name_us", '"Mira"', '"Theo"'], { stdio: "ignore" });
} catch {
  console.error("Could not name the probe couple. Is the smtest server up and the probe module published?");
  process.exit(2);
}

export async function launch(extraArgs = []) {
  return chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      ...extraArgs,
    ],
  });
}

/** A signed-in page for one of them. Console errors are collected on page.errors. */
export async function as(browser, who, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, permissions: ["camera", "microphone"] });
  await context.addInitScript(([name, door]) => {
    window.localStorage.setItem("same-moon:who", name);
    window.localStorage.setItem("same-moon:door", door);
  }, [who, DOOR]);
  const page = await context.newPage();
  page.errors = [];
  // A failed request is recorded with its address, which the console message
  // leaves out. Hot-reload files going missing mid-edit are the dev server, not the site.
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) page.errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/\/_next\/|hot-update|\/api\/photos/.test(r.url())) page.errors.push(`${r.status()} ${r.url()}`);
  });
  page.on("pageerror", (e) => page.errors.push(String(e)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".count", { timeout: 30000 });
  return page;
}

let pass = 0, fail = 0;
export function want(what, ok, detail = "") {
  if (ok) { pass += 1; console.log(`  ok   ${what}`); }
  else { fail += 1; console.log(`  FAIL ${what} ${detail}`); }
}
export function done() {
  console.log(`passed: ${pass}   failed: ${fail}`);
  process.exit(fail ? 1 : 0);
}
