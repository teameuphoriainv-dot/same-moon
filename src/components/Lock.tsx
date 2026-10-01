"use client";

import { useEffect, useState } from "react";
import { MOON, STAR, loadDoor, saveDoor, tryDoor } from "@/lib/auth";
import { nameUs, useCouple } from "@/lib/couple";
import { moonPhase } from "@/lib/moon";
import { HONOREE } from "@/lib/birthday";
import { PixelMoon } from "./PixelMoon";
import { CAKE_MINI, PARTY } from "@/lib/sprites";
import { PixelSprite } from "./PixelSprite";

interface LockProps {
  onUnlock: (who: string) => void;
  /** Dresses the gate for a birthday, since this is the first thing they see. */
  birthday?: boolean;
}

/**
 * Three small steps, and most visits only see the last one.
 *
 * 1. The door word, checked by the server. Once per phone.
 * 2. Naming the two of them. Once per couple, by whoever gets there first.
 * 3. Which one are you. Once per phone.
 */
export function Lock({ onUnlock, birthday = false }: LockProps) {
  const couple = useCouple();
  const [inside, setInside] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [moonName, setMoonName] = useState("");
  const [starName, setStarName] = useState("");
  const [phase, setPhase] = useState(0.5);

  // Time-dependent and storage-dependent, so both wait for the client.
  useEffect(() => {
    setPhase(moonPhase());
    setInside(Boolean(loadDoor()));
  }, []);

  const knock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || busy) return;
    setBusy(true);
    const answer = await tryDoor(word);
    setBusy(false);
    if (answer === "open") {
      saveDoor(word.trim());
      setInside(true);
      setError("");
      return;
    }
    setError(answer === "unset" ? "This sky has no door word yet. Set SAME_MOON_DOOR on the server." : "That is not it. Try again.");
    setWord("");
  };

  const name = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moonName.trim() || !starName.trim() || busy) return;
    setBusy(true);
    await nameUs(moonName, starName);
    setBusy(false);
  };

  const step = !inside ? "door" : !couple.loaded ? "wait" : couple.named ? "pick" : "name";

  return (
    <div className="lock">
      <div className={`lock-card${birthday ? " is-birthday" : ""}`}>
        <PixelMoon size={128} phase={phase} cells={22} />

        {birthday && HONOREE ? (
          <div className="lock-bday">
            <PixelSprite rows={CAKE_MINI} palette={PARTY} width={44} />
            <p className="lock-bday-line">Happy Birthday, {HONOREE}</p>
          </div>
        ) : (
          <span className="sprite-heart lock-heart" aria-hidden="true" />
        )}

        <h1 className="section-title">Same Moon</h1>

        {step === "door" && (
          <form className="lock-step" onSubmit={knock}>
            <p className="label">Two people only</p>
            <input
              className={`px-input${error ? " wrong" : ""}`}
              type="password"
              value={word}
              autoFocus
              autoComplete="current-password"
              placeholder="DOOR WORD"
              aria-label="Door word"
              onChange={(e) => {
                setWord(e.target.value);
                setError("");
              }}
            />
            <button className="px-btn" type="submit" disabled={busy}>
              {busy ? "Checking" : "Come in"}
            </button>
          </form>
        )}

        {step === "wait" && <p className="label">Finding your sky</p>}

        {step === "name" && (
          <form className="lock-step" onSubmit={name}>
            <p className="label">Name the two of you. This happens once.</p>
            <input
              className="px-input"
              value={moonName}
              maxLength={24}
              autoFocus
              placeholder="THE MOON"
              aria-label="The moon's name"
              onChange={(e) => setMoonName(e.target.value)}
            />
            <input
              className="px-input"
              value={starName}
              maxLength={24}
              placeholder="THE STAR"
              aria-label="The star's name"
              onChange={(e) => setStarName(e.target.value)}
            />
            <button className="px-btn" type="submit" disabled={busy || !moonName.trim() || !starName.trim()}>
              {busy ? "Saving" : "Light the sky"}
            </button>
          </form>
        )}

        {step === "pick" && (
          <div className="lock-step">
            <p className="label">Which one are you?</p>
            <div className="lock-pick">
              <button className="px-btn" type="button" onClick={() => onUnlock(MOON)}>
                {couple.moonName}
              </button>
              <button className="px-btn" type="button" onClick={() => onUnlock(STAR)}>
                {couple.starName}
              </button>
            </div>
          </div>
        )}

        <p className="lock-error label">{error || " "}</p>
      </div>
    </div>
  );
}
