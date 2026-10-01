import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The door word, checked on the server only.
 *
 * Each couple sets SAME_MOON_DOOR when they deploy. It never ships in the
 * client bundle, so reading the site's source does not give it away. It is
 * still one shared word, not an account system, and the README says so.
 */
export function doorIsSet(): boolean {
  return Boolean(process.env.SAME_MOON_DOOR?.trim());
}

function digest(word: string): Buffer {
  return createHash("sha256").update(word.trim().toLowerCase()).digest();
}

export function opensDoor(word: string | null | undefined): boolean {
  const door = process.env.SAME_MOON_DOOR?.trim();
  if (!door || !word) return false;
  // Hashing first makes both sides the same length, which timingSafeEqual needs.
  return timingSafeEqual(digest(word), digest(door));
}
