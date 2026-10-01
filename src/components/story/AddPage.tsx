"use client";

import { useEffect, useRef, useState } from "react";
import { STICKERS } from "@/lib/art/stickers";
import { dayKey } from "@/lib/dates";
import { CHARMS, CHARM_NAMES, charmOf, type Charm } from "@/lib/pages";
import { preparePhoto, type Prepared } from "@/lib/photo";
import type { Scrap } from "@/lib/types";
import type { Scrapbook } from "@/lib/useScrapbook";
import { PixelSprite } from "../PixelSprite";
import { DoodleArt } from "./DoodleArt";
import { MOON, loadWho, partnerOf } from "@/lib/auth";
import { displayName, unlockPlus, useCouple } from "@/lib/couple";
import { PlusSheet } from "@/components/PlusSheet";

const PHOTO_WORDS = 280;
const NOTE_WORDS = 600;

interface Props {
  book: Scrapbook;
  /** Set when changing a page that already exists. */
  editing?: Scrap | null;
  /** Set when pinning a drawing from the shared canvas. */
  art?: string | null;
  onClose: () => void;
  /** Called once the page has been sent. */
  onAdded: () => void;
}

/**
 * Adding a page, one question at a time. The next question only appears once
 * the one before it has an answer, so there is never more on screen than the
 * thing being asked.
 */
export function AddPage({ book, editing = null, art = null, onClose, onAdded }: Props) {
  const today = dayKey(new Date());
  const [kind, setKind] = useState<"photo" | "note" | null>(null);
  const [photo, setPhoto] = useState<Prepared | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [caption, setCaption] = useState(editing?.caption ?? "");
  const [day, setDay] = useState(editing?.day ?? today);
  const [charm, setCharm] = useState<Charm>(charmOf(editing?.charm ?? "hearts"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);
  // Photos are Plus. Either of them buying it unlocks photos for both.
  const couple = useCouple();
  const [plusOpen, setPlusOpen] = useState(false);
  const me = loadWho() ?? MOON;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busy && !plusOpen && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, busy, plusOpen]);

  // The preview is a handle on memory, and has to be given back.
  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      setPhoto(await preparePhoto(file));
      setKind("photo");
    } catch (err) {
      setPhoto(null);
      setError(err instanceof Error ? err.message : "That photo could not be opened.");
    } finally {
      setPreparing(false);
      if (picker.current) picker.current.value = "";
    }
  };

  const what: "photo" | "note" | "doodle" = editing ? editing.kind : art ? "doodle" : (kind ?? "photo");
  const answered = Boolean(editing || art || (kind === "photo" && photo) || kind === "note");
  const needsWords = what === "note";
  const dayOk = /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today;
  const ready = answered && dayOk && (!needsWords || caption.trim().length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const words = { caption: caption.trim(), day, charm };
    try {
      if (editing) await book.edit(editing.id, words);
      else if (art) await book.addDoodle(art, words);
      else if (kind === "photo" && photo) await book.addPhoto(photo, words);
      else await book.addNote(words);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work. Try again.");
      setBusy(false);
    }
  };

  const title = editing ? "Change this page" : art ? "Pin this drawing" : "Add a page";
  let step = 0;

  return (
    <>
    <div
      className="scrim story-panel-scrim"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form className="sheet story-panel" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="chat-head">
          <p className="section-title story-panel-title">{title}</p>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>

        {!editing && !art && (
          <fieldset className="story-step">
            <legend className="label label-brass">{(step += 1)}. What is it?</legend>
            <div className="story-choices">
              <button
                type="button"
                className={`story-choice${kind === "photo" ? " is-on" : ""}`}
                onClick={() => (couple.plus ? picker.current?.click() : setPlusOpen(true))}
                disabled={preparing || busy}
              >
                <span className="story-choice-name">A photo</span>
                <span className="label">
                  {!couple.plus
                    ? "With Same Moon Plus"
                    : preparing
                      ? "Getting it ready"
                      : photo
                        ? "Pick a different one"
                        : "From your camera or library"}
                </span>
              </button>
              <button
                type="button"
                className={`story-choice${kind === "note" ? " is-on" : ""}`}
                onClick={() => {
                  setKind("note");
                  setError(null);
                }}
                disabled={preparing || busy}
              >
                <span className="story-choice-name">A note</span>
                <span className="label">Just words, no picture</span>
              </button>
            </div>
            <input
              ref={picker}
              className="story-file"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </fieldset>
        )}

        {what === "photo" && preview && (
          // A preview of a file still on this device, so there is nothing to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="story-preview" src={preview} alt="The photo you picked" />
        )}
        {what === "doodle" && (art || editing?.art) && (
          <div className="story-preview story-preview-art">
            <DoodleArt art={art ?? editing?.art ?? ""} width={200} />
          </div>
        )}

        {answered && (
          <>
            <fieldset className="story-step">
              <legend className="label label-brass">
                {(step += 1)}. {needsWords ? "What do you want to say?" : "Say something about it"}
              </legend>
              <textarea
                className="story-words"
                value={caption}
                rows={needsWords ? 5 : 3}
                maxLength={needsWords ? NOTE_WORDS : PHOTO_WORDS}
                placeholder={needsWords ? "Write it here" : "You can leave this empty"}
                aria-label={needsWords ? "Your note" : "Caption"}
                onChange={(e) => setCaption(e.target.value)}
              />
              <label className="story-when">
                <span className="label">When was this?</span>
                <input
                  className="px-input story-date"
                  type="date"
                  value={day}
                  max={today}
                  required
                  onChange={(e) => setDay(e.target.value)}
                />
              </label>
            </fieldset>

            <fieldset className="story-step">
              <legend className="label label-brass">{(step += 1)}. Pick the stickers</legend>
              <div className="story-charms">
                {CHARMS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`story-charm${charm === name ? " is-on" : ""}`}
                    aria-pressed={charm === name}
                    onClick={() => setCharm(name)}
                  >
                    <PixelSprite
                      rows={STICKERS[name][0].rows}
                      palette={STICKERS[name][0].palette}
                      width={30}
                    />
                    <span className="label">{CHARM_NAMES[name]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {error && (
          <p className="story-error" role="alert">
            {error}
          </p>
        )}

        {answered && (
          <div className="sheet-actions">
            <button className="px-btn" type="submit" disabled={!ready || busy}>
              {busy ? "Saving" : editing ? "Save changes" : "Add to the book"}
            </button>
            <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
    <PlusSheet
      open={plusOpen}
      partnerName={displayName(partnerOf(me))}
      onClose={() => setPlusOpen(false)}
      onUnlocked={() => {
        void unlockPlus(me);
        setPlusOpen(false);
      }}
    />
    </>
  );
}
