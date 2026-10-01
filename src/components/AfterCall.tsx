"use client";

import { spell } from "@/lib/ago";

/**
 * What comes up when a call ends and tonight has not been marked yet. The
 * call is the whole reason the streak exists, so this is the moment to ask.
 */
export function AfterCall({
  ms,
  partner,
  onMark,
  onClose,
}: {
  ms: number;
  partner: string;
  onMark: (e: React.MouseEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="Mark tonight">
      <div className="sheet after-call" onClick={(e) => e.stopPropagation()}>
        <p className="label label-brass">You and {partner} talked for</p>
        <p className="after-call-time">{spell(ms)}</p>
        <p className="call-note">That counts. Tonight is not marked yet.</p>
        <div className="sheet-actions">
          <button className="px-btn" onClick={onMark}>
            Mark tonight
          </button>
          <button className="ghost-btn" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
