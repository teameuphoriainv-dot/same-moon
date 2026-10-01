"use client";

import { MILESTONES, nextMilestone } from "@/lib/milestones";

export function MilestoneLadder({ current }: { current: number }) {
  const next = nextMilestone(current);
  // Everything already earned, plus the next three to reach for.
  const nextIndex = next ? MILESTONES.findIndex((m) => m.n === next.n) : MILESTONES.length;
  const shown = MILESTONES.slice(0, Math.min(MILESTONES.length, nextIndex + 3));

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Named nights</h2>
        <span className="label">
          {next ? `${next.n - current} to ${next.name}` : "every one of them"}
        </span>
      </div>

      <div className="ladder">
        {shown.map((m) => {
          const hit = current >= m.n;
          const isNext = next?.n === m.n;
          return (
            <div
              key={m.n}
              className={["rung", hit ? "hit" : "", isNext ? "next" : ""].filter(Boolean).join(" ")}
            >
              <span className="n">{m.n}</span>
              <span className="name">{m.name}</span>
              <span className="note">{hit ? m.note : isNext ? "next" : ""}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
