"use client";

import { useEffect, useState } from "react";
import { longDate } from "@/lib/dates";
import { moonPhaseForDay, phaseName } from "@/lib/moon";
import type { Night, NightKind } from "@/lib/types";
import { PixelMoon } from "./PixelMoon";

interface Props {
  day: string;
  night?: Night;
  cloudedLeft: number;
  onSave: (kind: NightKind, note: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function NightSheet({ day, night, cloudedLeft, onSave, onClear, onClose }: Props) {
  const [note, setNote] = useState(night?.note ?? "");
  const phase = moonPhaseForDay(day);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const canFreeze = cloudedLeft > 0 || night?.kind === "clouded";

  return (
    <div className="scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <PixelMoon size={52} phase={phase} cells={16} />
          <div>
            <p className="serif" style={{ fontSize: "1.5rem", lineHeight: 1.15 }}>
              {longDate(day)}
            </p>
            <p className="label" style={{ marginTop: "0.35rem" }}>
              {phaseName(phase)}
            </p>
          </div>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened on this call?"
          maxLength={280}
        />

        <div className="sheet-actions">
          <button className="px-btn" onClick={() => onSave("called", note)}>
            {night?.kind === "called" ? "Save" : "We called"}
          </button>
          <button
            className="ghost-btn"
            disabled={!canFreeze}
            onClick={() => onSave("clouded", note)}
            title={canFreeze ? "Keeps the streak alive, earns no credit" : "No clouded nights banked"}
          >
            Clouded
          </button>
          {night && (
            <button className="ghost-btn" onClick={onClear}>
              Erase
            </button>
          )}
          <button className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="label" style={{ marginTop: "1.1rem" }}>
          {cloudedLeft} clouded {cloudedLeft === 1 ? "night" : "nights"} banked
        </p>
      </div>
    </div>
  );
}
