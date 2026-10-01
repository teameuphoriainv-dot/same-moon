import { launch, as, want, done } from "./lib.mjs";

const browser = await launch();
const he = await as(browser, "Star");
const she = await as(browser, "Moon");
await he.waitForTimeout(1500);

const openGames = async (page) => { await page.click('.dock-btn[aria-label^="Open games"]'); await page.waitForSelector(".arcade"); };
const line = (page) => page.evaluate(() => document.querySelector(".arcade .chat-head .label")?.textContent ?? "");
const title = (page) => page.evaluate(() => document.querySelector(".arc-title")?.textContent ?? "");
const settle = (ms = 500) => he.waitForTimeout(ms);

await openGames(he);
await openGames(she);
// start from a clean table, whatever the last run left out
for (let i = 0; i < 2; i++) {
  const away = await he.$(".arc-foot .ghost-btn");
  if (away) { await away.click(); await settle(); }
}
await he.waitForSelector(".arc-menu");
await settle(600); // the panel slides in; measure it once it has stopped
want("eight things to choose from", (await he.$$(".arc-tile")).length === 8);
const fit = await he.evaluate(() => { const r = document.querySelector(".arcade").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.querySelector(".arcade").scrollWidth <= document.querySelector(".arcade").clientWidth; });
want("the panel fits a phone with no sideways scroll", fit);

// --- tic-tac-toe ---
await he.click(".arc-tile:nth-child(1)");
await he.waitForSelector(".ttt");
await she.waitForSelector(".ttt", { timeout: 10000 });
want("starting a game opens it on the other phone too", (await title(she)) === "Tic-tac-toe");
want("whoever starts goes first", (await line(he)) === "Your turn" && (await line(she)) === "Theo's turn", `${await line(he)} / ${await line(she)}`);
want("she cannot move out of turn", await she.evaluate(() => [...document.querySelectorAll(".ttt-cell")].every((c) => c.disabled)));
const tap = async (page, i) => { await page.click(`.ttt-cell:nth-child(${i + 1})`); await settle(450); };
await tap(he, 4); await tap(she, 0); await tap(he, 2); await tap(she, 1); await tap(he, 6);
want("three in a row wins", (await line(he)) === "You won" && (await line(she)) === "Theo won", `${await line(he)} / ${await line(she)}`);
want("the winning squares light up on both", (await he.$$(".ttt-cell.is-won")).length === 3 && (await she.$$(".ttt-cell.is-won")).length === 3);
const pieces = await she.evaluate(() => [...document.querySelectorAll(".ttt-cell")].map((c) => c.getAttribute("aria-label")));
want("each square says whose it is", pieces[4] === "Square 5, Theo" && pieces[0] === "Square 1, Mira", JSON.stringify(pieces));
const size = await he.evaluate(() => { const b = document.querySelector(".ttt").getBoundingClientRect(); const p = document.querySelector(".ttt-cell .piece").getBoundingClientRect(); return { board: Math.round(b.width), piece: Math.round(p.width), inView: b.bottom <= innerHeight }; });
want("the board is a sensible size", size.board > 250 && size.piece > 40 && size.inView, JSON.stringify(size));

await she.click(".arc-foot .px-btn");
await settle(600);
want("a rematch hands her the first move", (await line(she)) === "Your turn", await line(she));

// --- four in a row ---
await she.click(".arc-foot .ghost-btn"); await settle();
await she.waitForSelector(".arc-menu");
await she.click(".arc-tile:nth-child(2)");
await he.waitForSelector(".four", { timeout: 10000 });
const drop = async (page, col) => { await page.click(`.four-col:nth-child(${col + 1})`); await settle(450); };
for (const [p, c] of [[she, 0], [he, 1], [she, 0], [he, 1], [she, 0], [he, 1], [she, 0]]) await drop(p, c);
want("four stacked up wins", (await line(she)) === "You won", await line(she));
want("the four are lit", (await he.$$(".four-cell.is-won")).length === 4);
want("pieces are in the column they were dropped in", await he.evaluate(() => { const col = document.querySelectorAll(".four-col")[0]; return [...col.querySelectorAll(".four-cell")].filter((c) => c.querySelector(".four-disc")).length === 4; }));

// --- pairs ---
await he.click(".arc-foot .ghost-btn"); await settle();
await he.waitForSelector(".arc-menu");
await he.click(".arc-tile:nth-child(3)");
await she.waitForSelector(".pairs", { timeout: 10000 });
want("sixteen cards, all face down", (await she.$$(".pair")).length === 16 && (await she.$$(".pair.is-up")).length === 0);
await he.click(".pair:nth-child(1)"); await settle(450);
want("a turned card shows on both phones", (await she.$$(".pair.is-up")).length === 1 && (await he.$$(".pair.is-up svg")).length === 1);
await he.click(".pair:nth-child(2)"); await settle(450);
const after = await he.evaluate(() => ({ up: document.querySelectorAll(".pair.is-up").length, kept: document.querySelectorAll(".pair.is-kept").length, line: document.querySelector(".arcade .chat-head .label").textContent }));
console.log("after two cards:", JSON.stringify(after));
if (after.kept === 2) {
  want("a match is kept and he goes again", after.line === "Your turn", after.line);
} else {
  want("a miss says so", after.line === "Not a match", after.line);
  await settle(1900);
  want("the cards turn back by themselves and the turn passes", (await he.$$(".pair.is-up")).length === 0 && (await line(she)) === "Your turn", `${(await he.$$(".pair.is-up")).length} / ${await line(she)}`);
}

// --- the canvas ---
await he.click(".arc-foot .ghost-btn"); await settle();
await he.waitForSelector(".arc-menu");
await he.click(".arc-tile:nth-child(4)");
await she.waitForSelector(".doodle-sheet", { timeout: 10000 });
await he.waitForSelector(".doodle-sheet", { timeout: 10000 });
want("opening the canvas brings her along", (await title(she)) === "Doodle");
const wipe = async () => { const b = await he.$('.doodle-tools .ghost-btn:has-text("Wipe it clean"):not([disabled])'); if (b) { await b.click(); await he.click('.doodle-tools .ghost-btn:has-text("Wipe")'); await settle(600); } };
await wipe();
const inked = (page) => page.evaluate(() => { const c = document.querySelector(".doodle-sheet"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (!(d[i] === 247 && d[i + 1] === 240 && d[i + 2] === 223)) n++; return n; });
want("the canvas starts bare", (await inked(he)) === 0 && (await inked(she)) === 0, `${await inked(he)} / ${await inked(she)}`);
const box = await he.evaluate(() => { const r = document.querySelector(".doodle-sheet").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
await he.mouse.move(box.x + box.w * 0.2, box.y + box.h * 0.2);
await he.mouse.down();
await he.mouse.move(box.x + box.w * 0.8, box.y + box.h * 0.8, { steps: 4 });
await he.mouse.up();
const mine = await inked(he);
want("a drag leaves an unbroken line", mine >= 38, String(mine));
await settle(900);
want("she sees the same line", (await inked(she)) === mine, `${await inked(she)} vs ${mine}`);
// she draws too, in another colour
await she.click(".doodle-ink:nth-child(4)");
const hers = await she.evaluate(() => { const r = document.querySelector(".doodle-sheet").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
await she.mouse.move(hers.x + hers.w * 0.8, hers.y + hers.h * 0.2);
await she.mouse.down();
await she.mouse.move(hers.x + hers.w * 0.6, hers.y + hers.h * 0.4, { steps: 3 });
await she.mouse.up();
await settle(900);
want("both drawings are on both canvases", (await inked(he)) === (await inked(she)) && (await inked(he)) > mine, `${await inked(he)} / ${await inked(she)}`);
await he.click('.doodle-tools .ghost-btn:has-text("idea")'); await settle(600);
const idea = await she.evaluate(() => document.querySelector(".doodle-idea")?.textContent ?? "");
want("an idea shows for both", idea.length > 8, idea);
await he.click(".doodle-pin .px-btn");
await he.waitForFunction(() => /Pinned/.test(document.querySelector(".doodle-pin .label")?.textContent ?? ""), null, { timeout: 15000 });
want("the drawing is pinned", true);
await wipe();
want("wiping clears it for both", (await inked(she)) === 0, String(await inked(she)));
await he.click(".arc-foot .ghost-btn"); await settle();

// --- a talking game still works, and clears the board ---
await he.waitForSelector(".arc-menu");
await he.click(".arc-shelf:nth-of-type(2) .arc-tile:nth-child(2)");
await she.waitForSelector(".deck-card", { timeout: 10000 });
want("a card is dealt to both", (await she.textContent(".deck-card-words")).length > 10);
await he.click(".deck-option:nth-child(1)");
await she.click(".deck-option:nth-child(1)");
await he.waitForSelector(".deck-answers", { timeout: 10000 });
want("both answers show once both are in", (await he.$$(".deck-answer")).length === 2);
await he.click(".arc-foot .ghost-btn"); await settle();
await he.click(".arcade .chat-head .ghost-btn");

// the pinned drawing is a page in the book now; open it, check it, and remove it
await he.waitForSelector(".story-recent-card .thumb-doodle", { timeout: 10000 });
await he.click(".story-recent-card:has(.thumb-doodle)");
await he.waitForSelector(".leaf-doodle .photo-card svg");
const drawn = await he.evaluate(() => ({ rects: document.querySelectorAll(".leaf-doodle .photo-card svg rect").length, foot: document.querySelector(".leaf-doodle .leaf-foot").textContent, words: document.querySelector(".leaf-doodle .leaf-words")?.textContent ?? "" }));
want("the pinned drawing is a page in the book", drawn.rects > 10 && /Drawn together/.test(drawn.foot), JSON.stringify(drawn));
want("the idea it was drawn from is its caption", drawn.words === idea, drawn.words);
await he.click(".leaf-tools .ghost-btn:nth-child(2)");
await he.click(".leaf-tools .ghost-btn:nth-child(2)");
await he.waitForFunction(() => !document.querySelector(".leaf-doodle"), null, { timeout: 10000 });

const errs = [...he.errors, ...she.errors];
want("no console errors", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
await browser.close();
done();
