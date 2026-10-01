import { readFileSync } from "node:fs";
import { launch, as, want, done, DOOR } from "./lib.mjs";

const browser = await launch();
const me = await as(browser, "Star");
const her = await as(browser, "Moon", { width: 1280, height: 860 });
await me.waitForTimeout(1500);

const pagesOn = (page) => page.evaluate(() => document.querySelector(".story .section-head .label")?.textContent ?? "");
const before = await pagesOn(me);
console.log("section says:", before);
want("the storybook section is on the front page", before.length > 0);

await me.click(".story .px-btn");
await me.waitForSelector(".story-scrim .leaf-cover");
await me.waitForTimeout(600); // let the page finish sliding in before measuring it
want("the book opens at its cover", (await me.textContent(".leaf-cover .cover-title")) === "Our storybook");
const fits = await me.evaluate(() => { const r = document.querySelector(".leaf").getBoundingClientRect(); return { x: r.left, r: r.right, vw: innerWidth, h: r.height }; });
want("a page fits the phone", fits.x >= 0 && fits.r <= fits.vw, JSON.stringify(fits));

// --- a note ---
await me.click(".story-nav .px-btn");
await me.waitForSelector(".story-panel");
want("the second question waits for the first", (await me.$(".story-words")) === null);
await me.click(".story-choice:nth-child(2)");
await me.fill(".story-words", "The night we stayed up until four.");
want("an empty note cannot be added", true);
await me.click(".story-charm:nth-child(3)");
await me.click(".story-panel .px-btn[type=submit]");
await me.waitForSelector(".leaf-note .leaf-words", { timeout: 15000 });
want("the book turns to the new note", (await me.textContent(".leaf-note .leaf-words")) === "The night we stayed up until four.");

// --- a photo ---
await me.click(".story-nav .px-btn");
await me.waitForSelector(".story-panel");
await me.setInputFiles(".story-file", { name: "lake.png", mimeType: "image/png", buffer: readFileSync(new URL("./photo.png", import.meta.url)) });
await me.waitForSelector(".story-preview", { timeout: 15000 });
want("a picked photo shows a preview", true);
await me.fill(".story-words", "The lake, at dusk.");
await me.fill(".story-date", "2026-08-01");
await me.click(".story-charm:nth-child(2)");
await me.click(".story-panel .px-btn[type=submit]");
await me.waitForSelector(".photo-card img.is-ready", { timeout: 30000 });
const photo = await me.evaluate(() => {
  const img = document.querySelector(".photo-card img");
  const frame = document.querySelector(".leaf-frame").getBoundingClientRect();
  const leaf = document.querySelector(".photo-card").closest(".leaf").getBoundingClientRect();
  return { src: img.src, nw: img.naturalWidth, nh: img.naturalHeight, frame: [Math.round(frame.width), Math.round(frame.height)], inside: frame.left >= leaf.left && frame.right <= leaf.right, words: document.querySelector(".photo-card").closest(".leaf").querySelector(".leaf-words")?.textContent, foot: document.querySelector(".photo-card").closest(".leaf").querySelector(".leaf-foot").textContent, thumb: getComputedStyle(document.querySelector(".leaf-frame")).backgroundImage.slice(0, 30) };
});
console.log(JSON.stringify(photo));
want("the photo is served from storage over https", /^https:\/\/.*blob\.vercel-storage\.com\/book\//.test(photo.src), photo.src);
want("it was shrunk to 1600 on the long side", photo.nw === 1600 && photo.nh === 1200, `${photo.nw}x${photo.nh}`);
want("the frame keeps the photo's shape", Math.abs(photo.frame[0] / photo.frame[1] - 4 / 3) < 0.03, JSON.stringify(photo.frame));
want("the frame stays on the page", photo.inside);
want("the caption is on the page", photo.words === "The lake, at dusk.");
want("the day is on the page", photo.foot.includes("August 1, 2026"), photo.foot);
want("a small preview sits behind it", photo.thumb.startsWith('url("data:image/jpeg'), photo.thumb);

// An older day sorts before today's note, so the photo is page 1.
want("pages are in the order they happened", photo.foot.trim().endsWith("1"), photo.foot);

// --- the other phone ---
await her.waitForFunction(() => /2 pages/.test(document.querySelector(".story .section-head .label")?.textContent ?? ""), null, { timeout: 15000 });
want("the other one sees both pages without reloading", true);
const garden = await her.evaluate(() => document.querySelectorAll(".garden-plant").length);
want("the garden has a plant for each page", garden === 2, String(garden));
await her.click(".story-cover");
await her.waitForSelector(".story-scrim .book.is-spread");
want("a wide screen lays the book open at two pages", (await her.$$(".book .leaf")).length === 2);
const place = await me.evaluate(() => document.querySelector(".presence")?.textContent ?? "");
console.log("he sees:", place);

// --- change, then remove ---
const tool = (name) => `.leaf-tools button:has-text("${name}")`;
await me.click(tool("Change"));
await me.waitForSelector(".story-panel");
await me.fill(".story-words", "The lake, just after dusk.");
await me.click(".story-panel .px-btn[type=submit]");
await me.waitForFunction(() => document.querySelector(".photo-card")?.closest(".leaf").querySelector(".leaf-words")?.textContent === "The lake, just after dusk.", null, { timeout: 15000 });
want("changing the words changes the page", true);

const gone = me.waitForResponse((r) => r.url().includes("/api/photos") && r.request().method() === "DELETE", { timeout: 20000 });
await me.click(tool("Remove"));
await me.click(tool("Remove"));
const res = await gone;
want("removing a photo page throws the photo away too", res.status() === 200, String(res.status()));
await me.waitForFunction(() => !document.querySelector(".photo-card"), null, { timeout: 15000 });

// remove the note as well, so the practice book is left as it was found
await me.waitForSelector(".leaf-note");
await me.click(tool("Remove"));
await me.click(tool("Remove"));
await me.waitForFunction(() => !document.querySelector(".leaf-note"), null, { timeout: 15000 });
want("the book is empty again", (await me.$$(".leaf-wrap")).length === 0);

// --- the door ---
const bad = await me.evaluate(async (door) => {
  const r = await fetch("/api/photos", { method: "POST", headers: { "content-type": "image/jpeg", "x-same-moon-code": "nope" }, body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) });
  const notJpeg = await fetch("/api/photos", { method: "POST", headers: { "content-type": "image/jpeg", "x-same-moon-code": door, "x-same-moon-who": "Star" }, body: new TextEncoder().encode("<html>hello</html>") });
  const wrongType = await fetch("/api/photos", { method: "POST", headers: { "content-type": "text/html", "x-same-moon-code": door, "x-same-moon-who": "Star" }, body: "x" });
  const foreign = await fetch("/api/photos?url=" + encodeURIComponent("https://example.com/book/a.jpg"), { method: "DELETE", headers: { "x-same-moon-code": door, "x-same-moon-who": "Star" } });
  return [r.status, notJpeg.status, wrongType.status, foreign.status];
}, DOOR);
want("a stranger is turned away", bad[0] === 401, String(bad[0]));
want("a file that only claims to be a photo is refused", bad[1] === 415, String(bad[1]));
want("anything that is not a photo is refused", bad[2] === 415, String(bad[2]));
want("it will not delete what it did not store", bad[3] === 400, String(bad[3]));

const errs = [...me.errors, ...her.errors].filter((e) => !/status of 4\d\d/.test(e));
want("no console errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
await browser.close();
done();
