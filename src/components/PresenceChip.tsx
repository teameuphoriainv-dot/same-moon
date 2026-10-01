import type { Presence } from "@/lib/usePresence";

/** What they are doing, said plainly, for when they are somewhere other than the front page. */
const DOING: Record<string, string> = {
  messages: "reading messages",
  call: "on a call",
  games: "playing a game",
  book: "in the storybook",
};

/** One line saying whether the other one is here, and if not, when they last were. */
export function PresenceChip({
  presence,
  compact = false,
}: {
  presence: Presence;
  /** Drops the name, for places where the name is already the heading. */
  compact?: boolean;
}) {
  if (!presence.available || !presence.label) return null;
  const doing = presence.here ? DOING[presence.place] : undefined;

  return (
    <p className={`presence${presence.here ? " here" : ""}`} role="status">
      <span className="presence-dot" aria-hidden="true" />
      {!compact && <span className="presence-name">{presence.partner}</span>}
      <span className="presence-label">
        {presence.label}
        {doing ? `, ${doing}` : ""}
      </span>
    </p>
  );
}
