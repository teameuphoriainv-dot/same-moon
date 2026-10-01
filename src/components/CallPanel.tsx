"use client";

import { useEffect, useRef, useState } from "react";
import { clock } from "@/lib/ago";
import { partnerOf } from "@/lib/auth";
import { moonPhase } from "@/lib/moon";
import type { useBoard } from "@/lib/useBoard";
import type { useCall } from "@/lib/useCall";
import type { useGames } from "@/lib/useGames";
import type { Presence } from "@/lib/usePresence";
import type { Scrapbook } from "@/lib/useScrapbook";
import type { IconName } from "@/lib/art/icons";
import { Arcade } from "./arcade/Arcade";
import { Icon } from "./Icon";
import { PixelMoon } from "./PixelMoon";
import { PixelRing } from "./PixelRing";
import { SkyScene } from "./scenes/SkyScene";
import { displayName } from "@/lib/couple";

type Call = ReturnType<typeof useCall>;
type Games = ReturnType<typeof useGames>;
type Boards = ReturnType<typeof useBoard>;

interface Props {
  who: string;
  call: Call;
  gs: Games;
  bd: Boards;
  story: Scrapbook;
  presence: Presence;
  /** Leave the call screen and open the messages instead. */
  onMessage: () => void;
}

/**
 * A video element fed from a MediaStream.
 *
 * `srcObject` is a property, not an attribute, so it has to be assigned rather
 * than passed as a prop. The local preview is always muted: playing your own
 * microphone back is a feedback loop.
 */
function Video({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted: boolean;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

/** The moon with rings going out from it, for a phone that is ringing. */
function RingingMoon() {
  const [phase, setPhase] = useState(0.5);
  useEffect(() => setPhase(moonPhase()), []);
  return (
    <div className="ring-moon" aria-hidden="true">
      <span className="ring-wave">
        <PixelRing color="#f2d287" />
      </span>
      <span className="ring-wave is-late">
        <PixelRing color="#f2d287" />
      </span>
      <PixelMoon size={148} phase={phase} cells={22} />
    </div>
  );
}

/** A round of the call controls: a glyph with its name under it. */
function Key({
  icon,
  label,
  onClick,
  tone = "",
  pressed,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: "" | "is-go" | "is-stop" | "is-off";
  pressed?: boolean;
}) {
  return (
    <button className={`call-key ${tone}`} onClick={onClick} aria-pressed={pressed}>
      <span className="call-key-face">
        <Icon name={icon} size={26} />
      </span>
      <span className="call-key-name">{label}</span>
    </button>
  );
}

function Timer({ since }: { since: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [since]);
  if (since === null) return null;
  return <span className="call-timer">{clock(Date.now() - since)}</span>;
}

export function CallPanel({ who, call, gs, bd, story, presence, onMessage }: Props) {
  // Display only: every use below is text on screen.
  const partner = displayName(partnerOf(who));
  const [gamesOpen, setGamesOpen] = useState(false);
  const [swapped, setSwapped] = useState(false);

  // Leaving the call should not leave a game half-open over nothing.
  useEffect(() => {
    if (call.phase === "idle") {
      setGamesOpen(false);
      setSwapped(false);
    }
  }, [call.phase]);

  const message = () => {
    if (call.phase === "ringing") void call.hangUp();
    else call.dismiss();
    onMessage();
  };

  if (call.phase === "idle") {
    // The camera was refused before a call could even start. Without this the
    // Call button would appear to do nothing at all.
    if (!call.error) return null;
    return (
      <div className="scrim" role="alertdialog" aria-modal="true" aria-label="The call could not start">
        <div className="sheet">
          <p className="section-title">The call could not start</p>
          <p className="call-note">{call.error}</p>
          <div className="sheet-actions">
            <button className="px-btn" onClick={call.dismiss}>
              Okay
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (call.phase === "incoming") {
    return (
      <div className="call-screen" role="dialog" aria-modal="true" aria-label={`${displayName(call.caller)} is calling`}>
        <SkyScene />
        <div className="call-ring">
          <RingingMoon />
          <p className="call-who">{displayName(call.caller)}</p>
          <p className="label label-brass">is calling you</p>
          <div className="call-keys is-answer">
            <Key icon="phone" label="Pick up" tone="is-go" onClick={() => void call.accept()} />
            <Key icon="hangup" label="Not now" tone="is-stop" onClick={() => void call.hangUp()} />
          </div>
          {call.error && <p className="call-note is-wrong">{call.error}</p>}
        </div>
      </div>
    );
  }

  if (call.phase === "ringing") {
    return (
      <div className="call-screen" role="dialog" aria-modal="true" aria-label={`Calling ${partner}`}>
        {/* Your own picture behind the ring, so you can fix your hair while you wait. */}
        <Video
          stream={call.localStream}
          muted
          className={`call-behind${call.mirrored ? " is-mirrored" : ""}`}
        />
        <div className="call-ring">
          <RingingMoon />
          <p className="label label-brass">Calling</p>
          <p className="call-who">{partner}</p>
          <p className="call-note">
            {presence.here
              ? `${partner} is on the site. It is ringing there now.`
              : `${partner} is not on the site right now. This only rings if ${partner} opens it in the next minute.`}
          </p>
          <div className="call-keys is-answer">
            <Key icon="hangup" label="Cancel" tone="is-stop" onClick={() => void call.hangUp()} />
            {!presence.here && <Key icon="message" label="Message" onClick={message} />}
          </div>
          {call.error && <p className="call-note is-wrong">{call.error}</p>}
        </div>
      </div>
    );
  }

  if (call.phase === "unanswered") {
    return (
      <div className="call-screen" role="dialog" aria-modal="true" aria-label="No answer">
        <SkyScene />
        <div className="call-ring">
          <p className="call-who">No answer</p>
          <p className="call-note">{partner} did not pick up.</p>
          <div className="call-keys is-answer">
            <Key icon="phone" label="Try again" tone="is-go" onClick={() => void call.start()} />
            <Key icon="message" label="Message" onClick={message} />
            <Key icon="close" label="Close" onClick={call.dismiss} />
          </div>
        </div>
      </div>
    );
  }

  const failed = call.phase === "failed";
  const main = swapped ? call.localStream : call.remoteStream;
  const inset = swapped ? call.remoteStream : call.localStream;
  // Your own picture is mirrored wherever it is showing. Theirs never is.
  const mirror = call.mirrored ? " is-mirrored" : "";

  return (
    <div className="call-screen is-live" role="dialog" aria-modal="true" aria-label={`Call with ${partner}`}>
      <div className="call-stage">
        <Video
          stream={main}
          muted={swapped}
          className={`call-main${swapped ? mirror : ""}${swapped && !call.camOn ? " is-dark" : ""}`}
        />

        {call.phase !== "live" && (
          <div className="call-cover">
            <p className="call-who">{failed ? "No way through" : "Connecting"}</p>
            <p className="call-note">
              {failed
                ? "Some networks will not let two phones talk to each other directly. Hang up and try again, or try from a different network."
                : `Finding ${partner}.`}
            </p>
          </div>
        )}

        <p className="call-tag">
          <span className={`call-dot${call.phase === "live" ? " is-live" : ""}`} aria-hidden="true" />
          {partner}
          <Timer since={call.liveSince} />
        </p>

        <button
          className="call-inset"
          onClick={() => setSwapped((v) => !v)}
          aria-label={swapped ? `Make ${partner} the big picture` : "Make yourself the big picture"}
        >
          <Video
            stream={inset}
            muted={!swapped}
            className={`call-inset-video${swapped ? "" : mirror}${!swapped && !call.camOn ? " is-dark" : ""}`}
          />
          {!swapped && !call.camOn && <span className="call-inset-off label">Camera off</span>}
        </button>
      </div>

      {gamesOpen && (
        <Arcade
          who={who}
          gs={gs}
          bd={bd}
          story={story}
          onClose={() => setGamesOpen(false)}
          embedded
        />
      )}

      <div className="call-keys">
        <Key
          icon={call.micOn ? "mic" : "micOff"}
          label={call.micOn ? "Mute" : "Unmute"}
          tone={call.micOn ? "" : "is-off"}
          pressed={!call.micOn}
          onClick={call.toggleMic}
        />
        <Key
          icon={call.camOn ? "camera" : "cameraOff"}
          label={call.camOn ? "Camera" : "Camera off"}
          tone={call.camOn ? "" : "is-off"}
          pressed={!call.camOn}
          onClick={call.toggleCam}
        />
        {call.canFlip && <Key icon="flip" label="Flip" onClick={() => void call.flip()} />}
        <Key
          icon="games"
          label={gamesOpen ? "Hide games" : "Games"}
          pressed={gamesOpen}
          onClick={() => setGamesOpen((v) => !v)}
        />
        <Key icon="hangup" label="Hang up" tone="is-stop" onClick={() => void call.hangUp()} />
      </div>

      {call.error && <p className="call-note is-wrong">{call.error}</p>}
    </div>
  );
}
