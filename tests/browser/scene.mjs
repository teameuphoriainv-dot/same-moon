import { launch, as, want, done } from "./lib.mjs";

// Counts pixels of a colour on the land, in the part of it around each house.
const read = (page) => page.evaluate(() => {
  const c = document.querySelector("canvas.horizon-land");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  const is = (i, r, g, b) => d[i] === r && d[i + 1] === g && d[i + 2] === b && d[i + 3] === 255;
  const out = { w: c.width, leftLit: 0, rightLit: 0, bulbs: 0, string: 0, roofLeft: 0, roofRight: 0 };
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    const left = x < c.width * 0.32, right = x > c.width * 0.68, middle = !left && !right;
    if (is(i, 255, 251, 240)) { if (left) out.leftLit++; if (right) out.rightLit++; }
    if (is(i, 111, 63, 72)) { if (left) out.roofLeft++; if (right) out.roofRight++; }
    if (middle && is(i, 43, 52, 80)) out.string++;
    if (middle && (is(i, 242, 210, 135) || is(i, 227, 163, 170) || is(i, 244, 233, 212) || is(i, 168, 217, 138))) out.bulbs++;
  }
  return { ...out, names: [...document.querySelectorAll(".horizon-name")].map((n) => `${n.textContent}:${n.classList.contains("here")}`) };
});

const browser = await launch();
const he = await as(browser, "Star");
await he.waitForTimeout(2500);
const alone = await read(he);
console.log("alone:", JSON.stringify(alone));
want("both houses are standing", alone.roofLeft > 20 && alone.roofRight > 20);
want("his own window is lit", alone.leftLit >= 1);
want("hers is dark while she is away", alone.rightLit === 0);
want("no lights are strung across for one", alone.string === 0);
want("his name is marked as here and hers is not", alone.names.join() === "Theo:true,Mira:false", alone.names.join());

const she = await as(browser, "Moon");
await he.waitForFunction(() => document.querySelector(".presence.here") !== null, null, { timeout: 15000 });
await he.waitForTimeout(800);
const both = await read(he);
console.log("both:", JSON.stringify(both));
want("her window lights when she arrives", both.rightLit >= 1);
want("and a string of lights runs between the houses", both.string > 20 && both.bulbs >= 4);
want("the line says she is active", (await he.textContent(".presence")) === "MiraActive now", await he.textContent(".presence"));

await she.context().close();
await he.waitForFunction(() => document.querySelector(".presence.here") === null, null, { timeout: 20000 });
await he.waitForTimeout(800);
const after = await read(he);
want("closing her tab is noticed within seconds, not minutes", true);
want("her window goes dark and the lights come down", after.rightLit === 0 && after.string === 0, JSON.stringify(after));
want("and the line says when she was last here", /^MiraLast active (just now|\dm ago)$/.test(await he.textContent(".presence")), await he.textContent(".presence"));

// the chat header carries it too
await he.click('.dock-btn[aria-label^="Open messages"]');
await he.waitForSelector(".chat-panel .presence");
want("the messages header says it too", /Last active/.test(await he.textContent(".chat-panel .presence")));

want("no console errors", he.errors.length === 0, JSON.stringify(he.errors.slice(0, 3)));
await browser.close();
done();
