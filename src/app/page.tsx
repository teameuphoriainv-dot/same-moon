"use client";

import { useEffect, useState } from "react";
import { Lock } from "@/components/Lock";
import { MilestoneLadder } from "@/components/MilestoneLadder";
import { NightGrid } from "@/components/NightGrid";
import { NightSheet } from "@/components/NightSheet";
import { PixelMoon } from "@/components/PixelMoon";
import { Plates } from "@/components/Plates";
import { JokeLibrary } from "@/components/JokeLibrary";
import { MessageSheet } from "@/components/MessageSheet";
import { CallPanel } from "@/components/CallPanel";
import { Arcade } from "@/components/arcade/Arcade";
import { Popup } from "@/components/Popup";
import { AfterCall } from "@/components/AfterCall";
import { Dock, DockButton } from "@/components/Dock";
import { PresenceChip } from "@/components/PresenceChip";
import { SkyScene } from "@/components/scenes/SkyScene";
import { Horizon } from "@/components/scenes/Horizon";
import { StorySection } from "@/components/story/StorySection";
import { Storybook, type Opening } from "@/components/story/Storybook";
import { BirthdayLayer } from "@/components/BirthdayLayer";
import { BirthdayCard } from "@/components/BirthdayCard";
import { PixelSprite } from "@/components/PixelSprite";
import { CAKE_MINI, HAT, PARTY } from "@/lib/sprites";
import { Stardust, type Burst } from "@/components/Stardust";
import { MOON, STAR, clearWho, installId, loadWho, partnerOf, saveWho } from "@/lib/auth";
import { unlockPlus, useCouple, useNameOf } from "@/lib/couple";
import { hasPlusEntitlement, initPurchases } from "@/lib/purchases";
import { longDate, nightKey } from "@/lib/dates";
import { moonPhase, phaseName } from "@/lib/moon";
import { cloudedAvailable, computeStats } from "@/lib/streak";
import { useBook } from "@/lib/useBook";
import { useMessages } from "@/lib/useMessages";
import { useCall } from "@/lib/useCall";
import { useGames } from "@/lib/useGames";
import { useBoard } from "@/lib/useBoard";
import { useBirthday } from "@/lib/useBirthday";
import { usePresence } from "@/lib/usePresence";
import { unlockAudio } from "@/lib/ringtone";
import { useScrapbook } from "@/lib/useScrapbook";
import { HONOREE } from "@/lib/birthday";
import type { Book, NightKind, Place } from "@/lib/types";

/**
 * The streak after adding one night. Marking a gap can join two runs, so this
 * has to be computed rather than assumed to be current + 1.
 */
function streakAfter(book: Book, day: string): number {
  return computeStats({
    ...book,
    startedOn: book.startedOn || day,
    nights: { ...book.nights, [day]: { day, kind: "called" } },
  }).current;
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value <= 0) {
      setN(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

export default function Page() {
  const { book, stats, ready, mode, clearNight, setNight, addJoke, removeJoke } = useBook();
  const [now, setNow] = useState<Date | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [copied, setCopied] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ count: number; day: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState<Opening | null>(null);
  const chat = useMessages(who);
  const call = useCall(who);
  const gs = useGames(who);
  const bd = useBoard(who);
  const bday = useBirthday();
  const story = useScrapbook(who);
  const nameOf = useNameOf();
  const couple = useCouple();

  // Where on the site this person is, which the other one gets to see.
  const place: Place =
    call.phase !== "idle"
      ? "call"
      : chatOpen
        ? "messages"
        : gamesOpen
          ? "games"
          : bookOpen
            ? "book"
            : "home";
  const presence = usePresence(who, place);

  useEffect(() => {
    setNow(new Date());
    setWho(loadWho());
    setAuthChecked(true);
  }, []);

  // RevenueCat starts once we know who is holding the phone. If this phone
  // already owns Plus (bought earlier, or restored), it turns Plus on for both.
  useEffect(() => {
    if (!who) return;
    let live = true;
    void (async () => {
      await initPurchases(installId());
      if (live && !couple.plus && (await hasPlusEntitlement())) await unlockPlus(who);
    })();
    return () => {
      live = false;
    };
  }, [who, couple.plus]);

  // A browser stays silent until the page has been touched. The first tap
  // anywhere is what lets a later call actually ring.
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  const tonight = nightKey();
  const phase = now ? moonPhase(now) : 0.5;
  const cloudedLeft = cloudedAvailable(stats);
  const live = ready && now !== null;

  const markTonight = (e: React.MouseEvent) => {
    setNight(tonight, {
      kind: "called",
      by: who ?? undefined,
      at: new Date().toISOString(),
    });
    setBurst({ id: Date.now(), x: e.clientX, y: e.clientY });
    setCelebrate({ count: streakAfter(book, tonight), day: tonight });
  };

  const savePicked = (kind: NightKind, note: string) => {
    if (!picked) return;
    setNight(picked, {
      kind,
      note: note.trim() || undefined,
      by: who ?? undefined,
      at: new Date().toISOString(),
    });
    const isNew = !book.nights[picked];
    setPicked(null);
    if (kind === "called" && isNew) {
      setCelebrate({ count: streakAfter(book, picked), day: picked });
    }
  };

  const share = async () => {
    const url = new URL(window.location.href);
    if (mode === "cloud") {
      const room = window.localStorage.getItem("same-moon:room");
      if (room) url.searchParams.set("room", room);
    }
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Nothing renders until localStorage has been read, so the lock never flashes.
  if (!authChecked) return null;

  if (!who) {
    return (
      <>
        <SkyScene />
        {bday.on && <BirthdayLayer />}
        <Lock
          birthday={bday.on}
          onUnlock={(name) => {
            saveWho(name);
            setWho(name);
          }}
        />
      </>
    );
  }

  return (
    <>
      <SkyScene />
      {bday.on && <BirthdayLayer />}
      <Stardust burst={burst} />

      <main className="shell" style={{ position: "relative", zIndex: 1 }}>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-eyebrow reveal d1">
              <span className="dot" />
              <span className="label label-brass">{live ? phaseName(phase) : " "}</span>
              <span className="label">{live ? longDate(tonight) : " "}</span>
            </div>

            <PresenceChip presence={presence} />

            {bday.on && (
              <button className="bday-banner reveal d1" onClick={bday.openCard}>
                <PixelSprite rows={CAKE_MINI} palette={PARTY} width={34} />
                <span>Happy Birthday, {HONOREE}</span>
              </button>
            )}

            <h1 className="count reveal d2">{live ? <CountUp value={stats.current} /> : 0}</h1>
          </div>

          <div className="hero-moon">
            {bday.on && (
              <div className="bday-hat" aria-hidden="true">
                <PixelSprite rows={HAT} palette={PARTY} width={84} />
              </div>
            )}
            <PixelMoon size={330} phase={phase} />
          </div>
        </section>

        {/* Your own window is lit whenever you are looking at it. */}
        <Horizon
          left={{ name: nameOf(STAR), here: who === STAR || presence.here }}
          right={{ name: nameOf(MOON), here: who === MOON || presence.here }}
        />

        <div className="log-row reveal d3">
          {stats.loggedTonight ? (
            <button className="px-btn done" onClick={() => setPicked(tonight)}>
              Tonight is marked
            </button>
          ) : (
            <button className="px-btn" onClick={markTonight}>
              Mark tonight
            </button>
          )}
        </div>

        <StorySection book={story} onOpen={setBookOpen} />

        <MilestoneLadder current={stats.current} />

        <NightGrid book={book} onPick={setPicked} />

        <JokeLibrary
          jokes={book.jokes}
          who={who}
          onAdd={addJoke}
          onRemove={removeJoke}
        />

        <Plates />

        <div className="tally">
          <div>
            <p className="v">{stats.longest}</p>
            <p className="k label">Longest run</p>
          </div>
          <div>
            <p className="v">{stats.totalCalled}</p>
            <p className="k label">Nights called</p>
          </div>
          <div>
            <p className="v">{stats.daysSinceStart}</p>
            <p className="k label">Days counting</p>
          </div>
          <div>
            <p className="v">{cloudedLeft}</p>
            <p className="k label">Clouded banked</p>
          </div>
        </div>

        <footer className="colophon">
          <span className="label" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span className="sprite-heart" />
            {nameOf(who)} &nbsp;·&nbsp; {mode === "cloud" ? "Synced" : "This device only"}
          </span>
          <span style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button className="ghost-btn" onClick={share}>
              {copied ? "Link copied" : `Send ${nameOf(partnerOf(who))} the link`}
            </button>
            <button
              className="ghost-btn"
              onClick={() => {
                clearWho();
                setWho(null);
              }}
            >
              Lock
            </button>
          </span>
        </footer>
      </main>

      {!chatOpen && !gamesOpen && !bookOpen && call.phase === "idle" && (
        <Dock>
          <DockButton
            icon="message"
            label="Messages"
            hint={chat.unread > 0 ? `Open messages, ${chat.unread} unread` : "Open messages"}
            badge={chat.unread}
            onClick={() => setChatOpen(true)}
          />
          {call.available && (
            <DockButton
              icon="phone"
              label="Call"
              hint={`Call ${nameOf(partnerOf(who))}`}
              live={presence.here}
              onClick={() => void call.start()}
            />
          )}
          {gs.available && (
            <DockButton
              icon="games"
              label="Games"
              hint={gs.playing || bd.playing ? "Open games, one is running" : "Open games"}
              live={gs.playing || bd.playing}
              onClick={() => setGamesOpen(true)}
            />
          )}
          {story.available && (
            <DockButton
              icon="book"
              label="Book"
              hint="Open the storybook"
              onClick={() => setBookOpen({})}
            />
          )}
          {bday.on && !bday.cardOpen && (
            <button
              className="dock-btn bday-dock"
              onClick={bday.openCard}
              aria-label={`Happy birthday, ${HONOREE}`}
            >
              <PixelSprite rows={CAKE_MINI} palette={PARTY} width={30} />
            </button>
          )}
        </Dock>
      )}

      {chatOpen && (
        <MessageSheet
          who={who}
          chat={chat}
          presence={presence}
          onClose={() => setChatOpen(false)}
        />
      )}

      {gamesOpen && call.phase === "idle" && (
        <Arcade
          who={who}
          gs={gs}
          bd={bd}
          story={story}
          onClose={() => setGamesOpen(false)}
        />
      )}

      {bookOpen && call.phase === "idle" && (
        <Storybook who={who} book={story} opening={bookOpen} onClose={() => setBookOpen(null)} />
      )}

      {/* Rendered unconditionally: this is what rings when they call. */}
      <CallPanel
        who={who}
        call={call}
        gs={gs}
        bd={bd}
        story={story}
        presence={presence}
        onMessage={() => setChatOpen(true)}
      />

      {/* Under a minute is a call that did not really happen. */}
      {call.finished && call.phase === "idle" && call.finished.ms >= 60_000 && !stats.loggedTonight && (
        <AfterCall
          ms={call.finished.ms}
          partner={nameOf(partnerOf(who))}
          onMark={(e) => {
            call.clearFinished();
            markTonight(e);
          }}
          onClose={call.clearFinished}
        />
      )}

      {bday.on && bday.cardOpen && bday.day && (
        <BirthdayCard
          day={bday.day}
          streak={stats.current}
          totalCalled={stats.totalCalled}
          onClose={bday.closeCard}
        />
      )}

      {celebrate && (
        <Popup
          count={celebrate.count}
          day={celebrate.day}
          jokes={book.jokes.map((j) => j.text)}
          onClose={() => setCelebrate(null)}
        />
      )}

      {picked && (
        <NightSheet
          day={picked}
          night={book.nights[picked]}
          cloudedLeft={cloudedLeft}
          onSave={savePicked}
          onClear={() => {
            clearNight(picked);
            setPicked(null);
          }}
          onClose={() => setPicked(null)}
        />
      )}
    </>
  );
}
