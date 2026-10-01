"use client";

import { useState } from "react";
import { isFuture, monthGrid, monthLabel, nightKey } from "@/lib/dates";
import { isBirthday } from "@/lib/birthday";
import type { Book } from "@/lib/types";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function NightGrid({ book, onPick }: { book: Book; onPick: (day: string) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = nightKey();

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const atCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const cells = monthGrid(year, month);

  // Denominator counts only nights that have actually happened.
  const lived = cells.filter((d): d is string => Boolean(d) && !isFuture(d as string));
  const called = lived.filter((d) => book.nights[d]?.kind === "called").length;
  const elapsed = lived.length;

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">The nights</h2>
        <div className="grid-nav">
          <button className="ghost-btn" onClick={() => step(-1)} aria-label="Previous month">
            &larr;
          </button>
          <span className="label" style={{ minWidth: "11ch", textAlign: "center" }}>
            {monthLabel(year, month)}
          </span>
          <button
            className="ghost-btn"
            onClick={() => step(1)}
            disabled={atCurrentMonth}
            aria-label="Next month"
          >
            &rarr;
          </button>
        </div>
      </div>

      <div className="grid-body">
        <div>
          <div className="dow" aria-hidden="true">
            {DOW.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="nights">
            {cells.map((day, i) => {
              if (!day) return <div key={`b${i}`} className="night blank" />;
              const night = book.nights[day];
              const future = isFuture(day);
              const cls = [
                "night",
                night ? night.kind : "slot",
                day === today ? "today" : "",
                isBirthday(day) ? "birthday" : "",
                night?.note ? "has-note" : "",
                future ? "future" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={day}
                  className={cls}
                  onClick={() => onPick(day)}
                  disabled={future}
                  title={isBirthday(day) ? `${day} (birthday)` : day}
                  aria-label={day}
                />
              );
            })}
          </div>
        </div>

        <div className="month-tally">
          <p className="v">
            {called}
            <span style={{ color: "var(--moon-ghost)", fontSize: "0.42em" }}> / {elapsed}</span>
          </p>
          <p className="label" style={{ marginTop: "0.7rem" }}>
            Nights called in {monthLabel(year, month).split(" ")[0]}
          </p>

          <div className="legend">
            <div>
              <span className="key called" />
              <span className="label">You called</span>
            </div>
            <div>
              <span className="key clouded" />
              <span className="label">A clouded night</span>
            </div>
            <div>
              <span className="key noted" />
              <span className="label">There is a note</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
