"use client";

import { useState } from "react";
import type { Joke } from "@/lib/types";
import { displayName } from "@/lib/couple";

const MAX = 60;

interface Props {
  jokes: Joke[];
  who: string;
  onAdd: (text: string, by: string) => void;
  onRemove: (id: number) => void;
}

export function JokeLibrary({ jokes, who, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState("");

  const clean = draft.trim();
  const duplicate = jokes.some((j) => j.text.toLowerCase() === clean.toLowerCase());
  const canAdd = clean.length > 0 && !duplicate;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    onAdd(clean, who);
    setDraft("");
  };

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Inside jokes</h2>
        <span className="label">
          {jokes.length === 0 ? "the popup says these back" : `${jokes.length} saved`}
        </span>
      </div>

      <form className="joke-add" onSubmit={submit}>
        <input
          className="px-input joke-input"
          value={draft}
          maxLength={MAX}
          placeholder="ADD A WORD"
          aria-label="Add an inside joke"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="px-btn" type="submit" disabled={!canAdd}>
          Add
        </button>
      </form>

      <p className="label joke-hint">
        {duplicate && clean ? "already in there" : "one word is best, it gets shown big"}
      </p>

      {jokes.length === 0 ? (
        <p className="joke-empty label">
          Nothing yet. Whatever you put here is what the app says back when either of
          you marks a night.
        </p>
      ) : (
        <ul className="joke-list">
          {jokes.map((j) => (
            <li className="joke" key={j.id}>
              <span className="joke-text">{j.text}</span>
              {j.by && <span className="joke-by label">{displayName(j.by)}</span>}
              <button
                className="joke-x"
                onClick={() => onRemove(j.id)}
                aria-label={`Remove ${j.text}`}
                title="Remove"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
