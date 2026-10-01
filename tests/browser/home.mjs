import { launch, as, want, done } from "./lib.mjs";

const browser = await launch();
for (const [label, viewport] of [["phone", { width: 390, height: 844 }], ["desk", { width: 1440, height: 900 }]]) {
  console.log(`-- ${label} --`);
  const page = await as(browser, "Star", viewport);
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; };
    const sky = document.querySelector("canvas.sky");
    const land = document.querySelector("canvas.horizon-land");
    const lit = (c) => { if (!c) return -1; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
    return {
      vw: window.innerWidth,
      scrollW: document.documentElement.scrollWidth,
      moon: box(".hero-moon svg"), count: box(".count"), horizon: box(".horizon"), dock: box(".dock"), log: box(".log-row .px-btn"),
      countText: document.querySelector(".count")?.textContent,
      presence: document.querySelector(".presence")?.textContent ?? null,
      sky: sky ? { w: sky.width, h: sky.height, css: sky.style.width, lit: lit(sky) } : null,
      land: land ? { w: land.width, h: land.height, css: land.style.width, lit: lit(land) } : null,
      dockButtons: [...document.querySelectorAll(".dock .dock-btn")].map((b) => b.getAttribute("aria-label")),
    };
  });
  console.log(JSON.stringify(m));
  want("no sideways scroll", m.scrollW <= m.vw, `${m.scrollW} > ${m.vw}`);
  want("the moon is fully on screen", m.moon && m.moon.x >= 0 && m.moon.r <= m.vw, JSON.stringify(m.moon));
  want("the count is fully on screen", m.count && m.count.x >= 0 && m.count.r <= m.vw, JSON.stringify(m.count));
  want("the count shows the streak", Number(m.countText) > 0, m.countText);
  want("the sky is drawn", m.sky && m.sky.lit > 50, JSON.stringify(m.sky));
  want("the land is drawn", m.land && m.land.lit > 500, JSON.stringify(m.land));
  want("the land spans the screen", m.horizon && m.horizon.x <= 0 && m.horizon.r >= m.vw - 1, JSON.stringify(m.horizon));
  want("the dock has its buttons", m.dockButtons.length >= 3, JSON.stringify(m.dockButtons));
  want("the dock is on screen", m.dock && m.dock.x >= 0 && m.dock.r <= m.vw && m.dock.b <= viewport.height, JSON.stringify(m.dock));
  want("no console errors", page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)));
  await page.context().close();
}
await browser.close();
done();
