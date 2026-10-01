"use client";

import { coalesce, isCloud, onReady, withConn } from "./conn";
import type { PulseRow } from "./types";

/**
 * How far this device's clock sits from the server's, in milliseconds.
 *
 * "Active now" means their last check-in was under a minute and a half ago,
 * and that check-in was stamped by the server, not by this phone. A phone
 * whose clock runs a few minutes fast would otherwise decide everybody left a
 * few minutes ago. Every check-in that arrives live was stamped a moment
 * before it got here, so the gap between its stamp and this clock is the
 * offset, give or take the trip.
 */
let offset = 0;

/** The server's idea of now, as best this device can tell. */
export function serverNow(): number {
  return Date.now() + offset;
}

interface Stamped {
  active: boolean;
  at: { toMillis(): bigint | number };
}

export const pulse = {
  available: isCloud,

  watch(cb: (rows: PulseRow[]) => void): () => void {
    if (!isCloud) return () => {};
    let live = true;
    const off = onReady((conn) => {
      if (!live) return;
      const push = coalesce(() => {
        if (!live) return;
        cb(
          [...conn.db.pulse.iter()].map((row) => ({
            who: row.who,
            active: row.active,
            place: row.place,
            at: Number(row.at.toMillis()),
          })),
        );
      });
      // Rows handed over when the subscription opens can be hours old, so
      // only the ones that arrive afterwards say anything about the clock.
      const measure = (tag: string, row: Stamped) => {
        if (tag !== "SubscribeApplied" && row.active) {
          offset = Number(row.at.toMillis()) - Date.now();
        }
      };
      conn.db.pulse.onInsert((ctx, row) => {
        measure(ctx.event.tag, row);
        push();
      });
      conn.db.pulse.onUpdate((ctx, _before, row) => {
        measure(ctx.event.tag, row);
        push();
      });
      conn.db.pulse.onDelete(push);
      push();
    });
    return () => {
      live = false;
      off();
    };
  },

  async beat(who: string, place: string) {
    await withConn((conn) => conn.reducers.beat({ who, place }));
  },
  async rest(who: string) {
    await withConn((conn) => conn.reducers.rest({ who }));
  },
};
