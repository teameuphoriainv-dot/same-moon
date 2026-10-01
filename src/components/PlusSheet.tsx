"use client";

import { useEffect, useState } from "react";
import {
  buyPlus,
  isNativeApp,
  loadPlusOffer,
  restorePlus,
  type PlusOffer,
} from "@/lib/purchases";
import { PixelMoon } from "./PixelMoon";

interface Props {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  partnerName: string;
}

type Phase = "loading" | "ready" | "busy" | "unavailable" | "web";

const FAILED = "That did not go through. Nothing was charged.";

export function PlusSheet({ open, onClose, onUnlocked, partnerName }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [offer, setOffer] = useState<PlusOffer | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The price comes from the store, so it is fetched each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setNote(null);
    if (!isNativeApp()) {
      setPhase("web");
      return;
    }
    let live = true;
    setPhase("loading");
    loadPlusOffer().then((o) => {
      if (!live) return;
      setOffer(o);
      setPhase(o ? "ready" : "unavailable");
    });
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  const busy = phase === "busy";

  const subscribe = async () => {
    setNote(null);
    setPhase("busy");
    try {
      const unlocked = await buyPlus();
      // False with no error means they backed out of the store sheet.
      setPhase("ready");
      if (unlocked) onUnlocked();
    } catch {
      setPhase("ready");
      setNote(FAILED);
    }
  };

  const restore = async () => {
    setNote(null);
    setPhase("busy");
    try {
      const unlocked = await restorePlus();
      setPhase(offer ? "ready" : "unavailable");
      if (unlocked) onUnlocked();
      else setNote("There is no Plus purchase on this Apple ID to restore.");
    } catch {
      setPhase(offer ? "ready" : "unavailable");
      setNote("Restoring did not go through. Try again in a moment.");
    }
  };

  return (
    <div
      className="scrim"
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plus-title"
    >
      <div className="sheet plus-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="plus-moons" aria-hidden="true">
          <PixelMoon size={44} phase={0.5} cells={14} />
          <span className="sprite-heart plus-heart" />
          <PixelMoon size={44} phase={0.5} cells={14} />
        </div>

        <h2 id="plus-title" className="plus-title">
          Same Moon Plus
        </h2>
        <p className="plus-line">
          One subscription covers both of you. It adds photos to your scrapbook, so your pages
          hold more than words.
        </p>
        <p className="plus-line">{partnerName} gets it too.</p>

        {phase === "web" ? (
          <p className="plus-line plus-note">Plus is in the iPhone app.</p>
        ) : phase === "loading" ? (
          <p className="label plus-status" aria-live="polite">
            Checking the price
          </p>
        ) : phase === "unavailable" ? (
          <p className="plus-line plus-note">Plus is not available right now. Try again later.</p>
        ) : (
          offer && (
            <p className="plus-price">
              {offer.priceLabel}
              {offer.periodLabel && <span className="label">{offer.periodLabel}</span>}
            </p>
          )
        )}

        {note && (
          <p className="plus-line plus-error" role="alert">
            {note}
          </p>
        )}

        <div className="sheet-actions plus-actions">
          {(phase === "ready" || phase === "busy") && (
            <button className="px-btn" onClick={subscribe} disabled={busy}>
              {busy ? "One moment" : "Subscribe"}
            </button>
          )}
          <button className="ghost-btn" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        {phase !== "web" && phase !== "loading" && (
          <button className="plus-restore" onClick={restore} disabled={busy}>
            Restore purchase
          </button>
        )}
      </div>
    </div>
  );
}
