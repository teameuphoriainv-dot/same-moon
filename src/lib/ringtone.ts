"use client";

/**
 * The ring, made here instead of loaded from a file: two square-wave notes,
 * which is what a phone in a pixel game would sound like.
 *
 * A browser will not make a sound until the person has touched the page, so
 * `unlockAudio` is called on the first tap anywhere. By the time a call comes
 * in the page has usually been touched already. If it has not, the ring is
 * silent and the screen still shows it. Every call in here is allowed to fail.
 */

let audio: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    const Maker =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Maker) return;
    audio ??= new Maker();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    /* no sound, which is fine */
  }
}

function note(ctx: AudioContext, hz: number, at: number, length: number, loud: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(loud, at + 0.015);
  gain.gain.setValueAtTime(loud, at + length - 0.04);
  gain.gain.linearRampToValueAtTime(0, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** Notes as [pitch in hertz, when it starts in seconds]. */
const TUNES = {
  incoming: {
    every: 2400,
    loud: 0.05,
    notes: [
      [659.25, 0],
      [783.99, 0.16],
      [987.77, 0.32],
      [783.99, 0.62],
      [987.77, 0.78],
    ],
  },
  outgoing: {
    every: 3000,
    loud: 0.025,
    notes: [
      [440, 0],
      [440, 0.5],
    ],
  },
} as const;

/** Start ringing. Returns the way to stop. */
export function startRing(kind: keyof typeof TUNES): () => void {
  const tune = TUNES[kind];
  let timer: ReturnType<typeof setInterval> | null = null;

  const play = () => {
    try {
      if (!audio || audio.state !== "running") return;
      const now = audio.currentTime + 0.02;
      for (const [hz, at] of tune.notes) {
        note(audio, hz, now + at, kind === "incoming" ? 0.14 : 0.3, tune.loud);
      }
      if (kind === "incoming") navigator.vibrate?.([180, 90, 180]);
    } catch {
      /* a ring that cannot sound is still a ring on screen */
    }
  };

  play();
  timer = setInterval(play, tune.every);
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
