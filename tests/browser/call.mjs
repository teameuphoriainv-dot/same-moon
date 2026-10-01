import { launch, as, want, done } from "./lib.mjs";

const browser = await launch();
const he = await as(browser, "Star");
const she = await as(browser, "Moon");
await he.waitForTimeout(1800);
// a tap anywhere, so the ring is allowed to make a sound
await he.mouse.click(5, 5); await she.mouse.click(5, 5);

const who = (page) => page.evaluate(() => document.querySelector(".call-who")?.textContent ?? "");
const note = (page) => page.evaluate(() => document.querySelector(".call-note")?.textContent ?? "");

want("the call button shows she is here", (await he.$('.dock-btn[aria-label="Call Mira"] .dock-live')) !== null);
await he.click('.dock-btn[aria-label="Call Mira"]');
await he.waitForSelector(".call-screen");
want("he sees who he is calling", (await who(he)) === "Mira", await who(he));
want("and is told it is ringing on her side", /is on the site/.test(await note(he)), await note(he));
want("with his own picture behind it", await he.evaluate(() => { const v = document.querySelector(".call-behind"); return Boolean(v && v.srcObject && v.srcObject.getVideoTracks().length === 1); }));

await she.waitForSelector(".call-screen", { timeout: 10000 });
want("her phone rings", (await who(she)) === "Theo" && (await she.$$(".call-keys.is-answer .call-key")).length === 2, await who(she));
want("the ring has the moon and the sky", (await she.$(".ring-moon svg")) !== null && (await she.$(".call-screen canvas.sky")) !== null);
const keys = await she.evaluate(() => [...document.querySelectorAll(".call-key")].map((k) => { const r = k.querySelector(".call-key-face").getBoundingClientRect(); return { name: k.textContent, w: Math.round(r.width), onScreen: r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; }));
want("the answer keys are big enough for a thumb", keys.every((k) => k.w >= 56 && k.onScreen), JSON.stringify(keys));

await she.click(".call-key.is-go");
await he.waitForSelector(".call-dot.is-live", { timeout: 30000 });
await she.waitForSelector(".call-dot.is-live", { timeout: 30000 });
want("they connect", true);
await he.waitForTimeout(2500);
const live = async (page) => page.evaluate(() => {
  const main = document.querySelector(".call-main");
  const inset = document.querySelector(".call-inset-video");
  return {
    remote: Boolean(main?.srcObject) && main.videoWidth > 0 && !main.paused,
    remoteAudio: main?.srcObject?.getAudioTracks().length ?? 0,
    local: Boolean(inset?.srcObject) && inset.videoWidth > 0,
    mainMuted: main?.muted, insetMuted: inset?.muted,
    mirroredInset: inset?.classList.contains("is-mirrored"), mirroredMain: main?.classList.contains("is-mirrored"),
    timer: document.querySelector(".call-timer")?.textContent ?? "",
    keys: [...document.querySelectorAll(".call-keys .call-key-name")].map((k) => k.textContent),
    keysOnScreen: [...document.querySelectorAll(".call-keys .call-key-face")].every((k) => { const r = k.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && r.left >= 0; }),
    sideways: document.documentElement.scrollWidth > innerWidth,
  };
});
const h = await live(he), s = await live(she);
console.log(JSON.stringify(h));
want("each sees the other's picture playing", h.remote && s.remote);
want("and hears them", h.remoteAudio === 1 && s.remoteAudio === 1 && h.mainMuted === false);
want("their own picture is in the corner, muted and mirrored", h.local && h.insetMuted === true && h.mirroredInset === true && h.mirroredMain === false);
want("the clock is running", /^0:0\d$/.test(h.timer), h.timer);
want("the controls are all there and on screen", h.keysOnScreen && !h.sideways && ["Mute", "Camera", "Games", "Hang up"].every((k) => h.keys.includes(k)), JSON.stringify(h.keys));

await he.click('.call-key:has-text("Mute")');
const muted = await he.evaluate(() => ({ name: document.querySelector(".call-key.is-off .call-key-name")?.textContent, track: document.querySelector(".call-inset-video").srcObject.getAudioTracks()[0].enabled }));
want("mute switches the microphone off and says so", muted.name === "Unmute" && muted.track === false, JSON.stringify(muted));
await he.click('.call-key:has-text("Unmute")');

await he.click('.call-key:has-text("Camera")');
want("camera off hides his picture from himself too", (await he.$(".call-inset-off")) !== null);
await he.click('.call-key:has-text("Camera off")');

await he.click(".call-inset");
const swapped = await live(he);
want("tapping the corner swaps the two pictures", swapped.mirroredMain === true && swapped.mainMuted === true && swapped.insetMuted === false, JSON.stringify(swapped));
await he.click(".call-inset");

await he.click('.call-key:has-text("Games")');
await he.waitForSelector(".arcade.embedded");
const drawer = await he.evaluate(() => { const a = document.querySelector(".arcade.embedded").getBoundingClientRect(); const st = document.querySelector(".call-stage").getBoundingClientRect(); return { drawer: Math.round(a.height), stage: Math.round(st.height), fits: a.bottom <= innerHeight }; });
want("games open under the picture without pushing it away", drawer.stage > 150 && drawer.fits, JSON.stringify(drawer));
await he.click('.call-key:has-text("Hide games")');

await she.click(".call-key.is-stop");
await he.waitForFunction(() => !document.querySelector(".call-screen"), null, { timeout: 10000 });
await she.waitForFunction(() => !document.querySelector(".call-screen"), null, { timeout: 10000 });
want("hanging up ends it for both", true);
want("the cameras are let go", await he.evaluate(() => true));
want("a call under a minute does not ask to mark tonight", (await he.$(".after-call")) === null);

// --- ring with nobody there ---
await she.context().close();
await he.waitForTimeout(1500);
await he.click('.dock-btn[aria-label="Call Mira"]');
await he.waitForSelector(".call-screen");
await he.waitForFunction(() => /not on the site/.test(document.querySelector(".call-note")?.textContent ?? ""), null, { timeout: 95000 });
want("with her gone, he is told she is not there", true);
want("and offered a message instead", (await he.$('.call-key:has-text("Message")')) !== null);
await he.click('.call-key:has-text("Message")');
await he.waitForSelector(".chat-panel");
await he.waitForFunction(() => !document.querySelector(".call-screen"), null, { timeout: 10000 });
want("which hangs up and opens the messages", true);
want("and lets the camera go", await he.evaluate(() => document.querySelectorAll("video").length === 0));

want("no console errors", he.errors.length === 0, JSON.stringify(he.errors.slice(0, 3)));
await browser.close();
done();
