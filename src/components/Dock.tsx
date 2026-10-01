import type { IconName } from "@/lib/art/icons";
import { Icon } from "./Icon";

interface DockButtonProps {
  icon: IconName;
  label: string;
  /** What a screen reader says, when it should say more than the label. */
  hint?: string;
  /** A count to show, such as unread messages. */
  badge?: number;
  /** A small light, for "something is happening here". */
  live?: boolean;
  onClick: () => void;
}

export function DockButton({ icon, label, hint, badge = 0, live = false, onClick }: DockButtonProps) {
  return (
    <button className="dock-btn" onClick={onClick} aria-label={hint ?? label}>
      <span className="dock-icon">
        <Icon name={icon} size={24} />
        {live && <span className="dock-live" aria-hidden="true" />}
        {badge > 0 && <span className="chat-badge">{badge > 99 ? "99+" : badge}</span>}
      </span>
      <span className="dock-label">{label}</span>
    </button>
  );
}

/** The pinned row of things to open. A bar along the bottom on a phone, a corner cluster on a desk. */
export function Dock({ children }: { children: React.ReactNode }) {
  return (
    <nav className="dock" aria-label="Open">
      {children}
    </nav>
  );
}
