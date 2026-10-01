"use client";

import { useCallback, useEffect, useState } from "react";
import { HONOREE, birthdayNow } from "./birthday";

const SEEN_KEY = "same-moon:bday-seen";

/**
 * Whether tonight is her birthday, plus the once-a-night auto-open of the card.
 *
 * Resolved in an effect rather than during render: the answer depends on the
 * clock, and the server has no idea what day it is on her phone. Everything
 * decorative stays off until this flips, so there is no hydration mismatch.
 */
export function useBirthday() {
  const [on, setOn] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    const key = birthdayNow();
    if (!key) return;

    setOn(true);
    setDay(key);
    document.documentElement.dataset.birthday = "true";
    document.title = `Happy Birthday, ${HONOREE}`;

    // Opens itself the first time she loads the page tonight, never again after.
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(SEEN_KEY);
    } catch {
      seen = null;
    }
    if (seen !== key) setCardOpen(true);

    return () => {
      delete document.documentElement.dataset.birthday;
    };
  }, []);

  const closeCard = useCallback(() => {
    setCardOpen(false);
    try {
      if (day) window.localStorage.setItem(SEEN_KEY, day);
    } catch {
      /* private mode, it will just open again next load */
    }
  }, [day]);

  const openCard = useCallback(() => setCardOpen(true), []);

  return { on, day, cardOpen, openCard, closeCard };
}
