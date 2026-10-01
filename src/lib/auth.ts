const KEY = "same-moon:who";
const DOOR_KEY = "same-moon:door";

/**
 * The two people, as every table stores them. Their real names live in the
 * `couple` row (see couple.ts), so a rename never touches a night or a message.
 * The moon plays rose and the star plays brass in every game.
 */
export const MOON = "Moon";
export const STAR = "Star";
export const PEOPLE = [MOON, STAR] as const;

export function isPerson(name: string | null | undefined): name is string {
  return name === MOON || name === STAR;
}

export function loadWho(): string | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(KEY);
  // A door word is required too, so an old "who" from before the door existed
  // sends you back through it.
  return isPerson(saved) && loadDoor() ? saved : null;
}

export function saveWho(name: string): void {
  window.localStorage.setItem(KEY, name);
}

export function clearWho(): void {
  window.localStorage.removeItem(KEY);
}

/** The other half of the pair. */
export function partnerOf(name: string): string {
  return name === MOON ? STAR : MOON;
}

/**
 * The word that got this phone through the door. The server checks it again on
 * every photo upload, so it is kept rather than thrown away after the lock.
 */
export function loadDoor(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DOOR_KEY) ?? "";
}

export function saveDoor(word: string): void {
  window.localStorage.setItem(DOOR_KEY, word);
}

/**
 * A stable id for this install, used as the RevenueCat app user id. Random, so
 * it says nothing about who the person is.
 */
export function installId(): string {
  const key = "same-moon:install";
  let id = window.localStorage.getItem(key);
  if (!id) {
    // randomUUID needs a secure context; an http dev server is not one.
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, id);
  }
  return `same-moon-${id}`;
}

/** Ask the server whether a word opens the door. */
export async function tryDoor(word: string): Promise<"open" | "wrong" | "unset"> {
  try {
    const res = await fetch("/api/door", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ word }),
    });
    if (res.ok) return "open";
    if (res.status === 503) return "unset";
    return "wrong";
  } catch {
    return "wrong";
  }
}
