/**
 * Arranging a page and sealing it with a kiss. Leaves one sealed page behind,
 * because a sealed page cannot be removed: republish the probe module before
 * running story.mjs after this.
 */
import { launch, as, want, done } from "./lib.mjs";

const browser = await launch();
const me = await as(browser, "Star");
const her = await as(browser, "Moon", { width: 1280, height: 860 });
await me.waitForTimeout(1500);

const tool = (name) => `.leaf-tools button[aria-label="${name}"], .leaf-tools button:has-text("${name}")`;
const box = async (page, sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
const placed = (page, sel) => page.$eval(sel, (el) => ({ left: el.style.left, top: el.style.top, width: el.style.width, transform: el.style.transform }));

// --- a note to arrange ---
await me.click(".story .px-btn");
await me.waitForSelector(".story-scrim .leaf-cover");
await me.click(".story-nav .px-btn");
await me.waitForSelector(".story-panel");
await me.click(".story-choice:nth-child(2)");
await me.fill(".story-words", "Arrange me.");
await me.click(".story-panel .px-btn[type=submit]");
await me.waitForSelector(".leaf-note .leaf-canvas", { timeout: 15000 });
want("a note page is a canvas with the words on a card", (await me.textContent(".leaf-note-card .leaf-words")) === "Arrange me.");
want("a fresh page comes dressed with three stickers", (await me.$$(".pg-item.pg-sticker")).length === 3, String((await me.$$(".pg-item.pg-sticker")).length));
want("a note has no photo item", (await me.$(".pg-main")) === null);
want("nothing is stuck on until arranging", (await me.$(".leaf.is-arranging")) === null);

// --- arranging: drag ---
await me.click(tool("Arrange"));
await me.waitForSelector(".leaf-wrap.is-arranging .arrange");
const itemSel = `.leaf-canvas .pg-item[data-item]`;
const ids = await me.$$eval(itemSel, (els) => els.map((e) => e.dataset.item));
const target = `.pg-item[data-item="${ids[0]}"]`;
const before = await placed(me, target);
const at = await box(me, target);
await me.mouse.move(at.x, at.y);
await me.mouse.down();
await me.mouse.move(at.x + 40, at.y + 30, { steps: 4 });
await me.mouse.move(at.x + 90, at.y + 70, { steps: 6 });
await me.mouse.up();
const after = await placed(me, target);
want("dragging moves the sticker", before.left !== after.left && before.top !== after.top, JSON.stringify({ before, after }));
want("it is picked up while dragged", (await me.$(`${target}.is-selected`)) !== null);

// the other phone gets the move without doing anything
await her.click(".story-cover");
await her.waitForSelector(".story-scrim .book.is-spread");
await her.waitForFunction(([sel, left]) => document.querySelector(sel)?.style.left === left, [target, after.left], { timeout: 15000 });
want("the move lands on the other phone", true);
want("the other phone is not in arrange mode", (await her.$(".leaf.is-arranging")) === null);

// --- the toolbar on a picked-up item ---
const canvasBefore = await placed(me, target);
await me.click(tool("Tilt right"));
const tilted = await placed(me, target);
const deg = (t) => Number(/rotate\((-?[\d.]+)deg\)/.exec(t.transform)?.[1]);
want("tilt turns it by fifteen degrees", deg(tilted) - deg(canvasBefore) === 15, `${deg(canvasBefore)} -> ${deg(tilted)}`);
await me.click(tool("Bigger"));
const bigger = await placed(me, target);
want("bigger widens it by four percent", Math.abs(parseFloat(bigger.width) - parseFloat(tilted.width) - 4) < 0.01, `${tilted.width} -> ${bigger.width}`);
await me.click(tool("Undo the last change"));
const undone = await placed(me, target);
want("undo takes back the last change", undone.width === tilted.width, `${undone.width} vs ${tilted.width}`);

// --- the tray: sticker, tape, text ---
await me.click(tool("Sticker"));
await me.waitForSelector(".arrange-sheet");
const onSheet = await me.$$eval(".arrange-sheet .sheet-btn", (els) => els.map((e) => e.getAttribute("aria-label")));
want("the sheet offers every sticker, lips included", onSheet.length >= 16 && onSheet.includes("Lips"), onSheet.join(","));
await me.click('.arrange-sheet .sheet-btn[aria-label="Lips"]');
want("tapping one drops it on the page", (await me.$$(".pg-item.pg-sticker")).length === 4);
want("the sheet closes after a pick", (await me.$(".arrange-sheet")) === null);
want("the new sticker is picked up", (await me.$(".pg-item.pg-sticker.is-selected")) !== null);
await me.click(tool("Take it off the page"));
want("remove takes it off again", (await me.$$(".pg-item.pg-sticker")).length === 3);

await me.click(tool("Tape"));
want("tape drops a strip", (await me.$$(".pg-item.pg-tape")).length === 1);
const tapeClip = await me.$eval(".pg-tape-strip", (el) => el.style.clipPath);
want("the tape has stepped ends", tapeClip.startsWith("polygon("), tapeClip.slice(0, 40));

await me.click(tool("Text"));
await me.waitForSelector(".pg-text-input");
want("text opens a scrap to type on, focused", await me.$eval(".pg-text-input", (el) => document.activeElement === el));
await me.keyboard.type("hello moon");
await me.keyboard.press("Enter");
await me.waitForSelector(".pg-text-words");
want("the words stay on the scrap", (await me.textContent(".pg-text-words")) === "hello moon");

await me.click(tool("Done"));
want("done leaves arrange mode", (await me.$(".leaf.is-arranging")) === null);
await her.waitForFunction(() => document.querySelector(".pg-text-words")?.textContent === "hello moon", null, { timeout: 15000 });
want("the scrap of text reaches the other phone", true);
want("so does the tape", (await her.$$(".pg-item.pg-tape")).length === 1);

// --- sealing with a kiss ---
await me.click(tool("Seal with a kiss"));
await me.waitForSelector(".kiss-seal");
want("the warning is plain", (await me.textContent(".kiss-warn")) === "Sealing is forever. Neither of you can change or remove this page after a kiss.");
const lips = await box(me, ".kiss-lips");
await me.mouse.move(lips.x, lips.y);
await me.mouse.down();
await me.waitForTimeout(400);
await me.mouse.up();
await me.waitForTimeout(200);
want("letting go early does not seal", (await me.$(".pg-kiss")) === null && (await me.textContent(".kiss-hint")) === "Hold the lips");

await me.mouse.down();
await me.waitForTimeout(1500);
await me.mouse.up();
await me.waitForSelector(".pg-kiss", { timeout: 5000 });
want("holding on seals the page with a kiss", true);
await me.waitForSelector(".leaf-sealed-note", { timeout: 15000 });
want("a sealed page has no tools", (await me.$(tool("Arrange"))) === null && (await me.$(tool("Remove"))) === null && (await me.$(tool("Change"))) === null);

await her.waitForSelector(".pg-kiss-label", { timeout: 15000 });
const label = await her.textContent(".pg-kiss-label");
want("the other phone sees who sealed it", /^Sealed with a kiss by Theo, [A-Z][a-z]{2} \d{1,2}$/.test(label), label);
want("the other phone loses the tools too", (await her.$(tool("Arrange"))) === null);
want("the cover counts the seal", /1 page so far, 1 sealed/.test(await her.textContent(".leaf-cover .label")), await her.textContent(".leaf-cover .label"));
await her.click(".story-head-tools .ghost-btn:last-child");
await her.waitForFunction(() => /1 page, 1 sealed/.test(document.querySelector(".story .section-head .label")?.textContent ?? ""), null, { timeout: 15000 });
want("the front page says how many are sealed", true);
want("the thumbnail wears the kiss", (await her.$(".story-recent .thumb-seal")) !== null);

const errs = [...me.errors, ...her.errors].filter((e) => !/status of 4\d\d/.test(e));
want("no console errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
await browser.close();
done();
