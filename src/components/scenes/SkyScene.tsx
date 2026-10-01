"use client";

import { useEffect, useRef } from "react";
import { CLOUDS } from "@/lib/art/scenery";
import { bayer, prefersStill, seeded, stamp } from "./seeded";

/** Screen pixels to one pixel of sky. */
const SCALE = 3;
/** The sky moves slowly, so it is drawn slowly. A shooting star speeds it up. */
const CALM_MS = 100;
const FAST_MS = 33;

/**
 * Stars are scattered once over a field this big and the screen is a window
 * onto it. Resizing, or a phone's address bar sliding away, shows more or less
 * of the same sky instead of reshuffling it.
 */
const FIELD_W = 1100;
const FIELD_H = 700;
const STAR_COUNT = 2400;

const TONES = ["#f4e9d4", "#f4e9d4", "#f2d287", "#aebbe0"];
const LEVELS = [0.16, 0.38, 0.68, 1];
/** The far layer is fainter, the near one full strength. */
const DEPTH = [0.7, 0.85, 1];
const CLOUD_INK = { c: "#0e1527", C: "#1e2a4c", u: "#0a0f1e" };
const STREAK_TONES = ["#fffbf0", "#fffbf0", "#f2d287", "#f2d287", "#f2d287", "#aebbe0", "#aebbe0", "#aebbe0", "#aebbe0"];
const TRAIL = 12;
const SATELLITE = { dim: "#7f8db5", bright: "#fffbf0" };

/**
 * The Milky Way, as a band across the field. Two tones of the same pale blue
 * at low alpha, dithered rather than blurred so it stays pixel art.
 */
const BAND = { y0: 250, slope: -0.36, width: 38, core: 12 };

interface Star {
  x: number;
  y: number;
  tone: string;
  /** 0 a single pixel, 1 a two by two, 2 a sparkle with arms. */
  kind: 0 | 1 | 2;
  /** 0 far, 2 near. Near stars slide a pixel or two with the page. */
  layer: 0 | 1 | 2;
  phase: number;
  rate: number;
}

interface Cloud {
  shape: number;
  /** Height in the sky, as a share of the screen. */
  v: number;
  start: number;
  /** Sky pixels per second. */
  speed: number;
}

/** One shooting star, reused so a frame never allocates. */
interface Streak {
  active: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  age: number;
  /** Where the head has been, oldest overwritten first. */
  trail: Float32Array;
  n: number;
}

interface Satellite {
  active: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

function makeStars(): Star[] {
  const rand = seeded(20260807);
  return Array.from({ length: STAR_COUNT }, () => {
    const roll = rand();
    const depth = rand();
    const kind = roll > 0.975 ? 2 : roll > 0.87 ? 1 : 0;
    // The big ones are near; the dust is mostly far.
    const layer = kind === 2 ? 2 : kind === 1 ? (depth > 0.4 ? 2 : 1) : depth > 0.85 ? 2 : depth > 0.5 ? 1 : 0;
    return {
      x: Math.floor(rand() * FIELD_W),
      y: Math.floor(rand() * FIELD_H),
      tone: TONES[Math.floor(rand() * TONES.length)],
      kind,
      layer,
      phase: rand() * Math.PI * 2,
      rate: 0.35 + rand() * 1.5,
    };
  });
}

function makeClouds(): Cloud[] {
  const rand = seeded(8675309);
  return Array.from({ length: 5 }, (_, i) => ({
    shape: i % CLOUDS.length,
    v: 0.06 + rand() * 0.62,
    start: rand(),
    speed: 0.5 + rand() * 1.1,
  }));
}

function paintBand(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const img = ctx.createImageData(W, H);
  const px = img.data;
  const tilt = Math.cos(Math.atan(BAND.slope));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dist = Math.abs(y - (BAND.y0 + BAND.slope * x)) * tilt;
      const haze = 0.42 * Math.exp(-((dist / BAND.width) ** 2));
      const core = 0.3 * Math.exp(-((dist / BAND.core) ** 2));
      const b = bayer(x, y);
      if (b >= haze + core) continue;
      const i = (y * W + x) * 4;
      px[i] = 178;
      px[i + 1] = 190;
      px[i + 2] = 226;
      px[i + 3] = b < core ? 34 : 20;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * The night sky behind everything: pixel stars in three depths that twinkle
 * in steps and drift a pixel with the page, the Milky Way, slow clouds that
 * cover them as they pass, now and then a shooting star, rarely a satellite.
 */
export function SkyScene() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const backdrop = document.createElement("canvas");
    const back = backdrop.getContext("2d");
    if (!back) return;

    const stars = makeStars();
    const clouds = makeClouds();
    const still = prefersStill();
    const chance = seeded(Date.now() % 100000);

    const streak: Streak = { active: false, x: 0, y: 0, dx: 0, dy: 0, age: 0, trail: new Float32Array(TRAIL * 2), n: 0 };
    const sat: Satellite = { active: false, x: 0, y: 0, dx: 0, dy: 0 };
    let nextStreak = 5000 + chance() * 9000;
    let nextSat = 30000 + chance() * 60000;
    const ox = [0, 0, 0];
    const oy = [0, 0, 0];
    let pointer = 0;
    let raf = 0;
    let last = 0;
    let frame = 0;

    const draw = (t: number) => {
      const W = canvas.width;
      const H = canvas.height;
      const seconds = t / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(backdrop, 0, 0);

      for (const s of stars) {
        const x = s.x + ox[s.layer];
        const y = s.y + oy[s.layer];
        if (x >= W || y >= H || x < 0 || y < 0) continue;
        const wave = 0.5 + 0.5 * Math.sin(seconds * s.rate + s.phase);
        const level = Math.min(3, Math.floor(wave * 4));
        const depth = DEPTH[s.layer];
        ctx.globalAlpha = LEVELS[level] * depth;
        ctx.fillStyle = s.tone;
        if (s.kind === 0) {
          ctx.fillRect(x, y, 1, 1);
        } else if (s.kind === 1) {
          ctx.globalAlpha = LEVELS[level] * depth * 0.8;
          ctx.fillRect(x, y, 2, 2);
        } else {
          ctx.fillRect(x, y, 1, 1);
          // The arms only show at the top of the twinkle.
          if (level >= 2) {
            ctx.globalAlpha = level === 3 ? 0.7 : 0.3;
            ctx.fillRect(x - 1, y, 1, 1);
            ctx.fillRect(x + 1, y, 1, 1);
            ctx.fillRect(x, y - 1, 1, 1);
            ctx.fillRect(x, y + 1, 1, 1);
            if (level === 3) {
              ctx.globalAlpha = 0.28;
              ctx.fillRect(x - 2, y, 1, 1);
              ctx.fillRect(x + 2, y, 1, 1);
              ctx.fillRect(x, y - 2, 1, 1);
              ctx.fillRect(x, y + 2, 1, 1);
            }
          }
        }
      }

      if (sat.active) {
        const blink = frame % 10 < 2;
        ctx.globalAlpha = blink ? 0.9 : 0.45;
        ctx.fillStyle = blink ? SATELLITE.bright : SATELLITE.dim;
        ctx.fillRect(Math.round(sat.x), Math.round(sat.y), 1, 1);
      }

      if (streak.active) {
        const life = Math.max(0, 1 - streak.age / 30);
        // The head and the bright body, white into brass into a slate tail.
        for (let i = 0; i < STREAK_TONES.length; i++) {
          ctx.globalAlpha = Math.max(0, 1 - i / STREAK_TONES.length) * life;
          ctx.fillStyle = STREAK_TONES[i];
          ctx.fillRect(Math.round(streak.x - streak.dx * i * 0.8), Math.round(streak.y - streak.dy * i * 0.8), 1, 1);
        }
        // Behind that, single pixels left where the head was, going out.
        ctx.fillStyle = "#aebbe0";
        for (let k = 1; k <= Math.min(TRAIL, streak.n); k++) {
          const at = ((streak.n - k) % TRAIL) * 2;
          ctx.globalAlpha = 0.35 * (1 - k / (TRAIL + 1)) * life;
          ctx.fillRect(Math.round(streak.trail[at]), Math.round(streak.trail[at + 1]), 1, 1);
        }
      }

      ctx.globalAlpha = 1;
      for (const c of clouds) {
        const rows = CLOUDS[c.shape];
        const span = W + rows[0].length + 20;
        const x = Math.round(((c.start * span + seconds * c.speed) % span) - rows[0].length - 10);
        stamp(ctx, rows, CLOUD_INK, x, Math.round(c.v * H));
      }
    };

    const fit = () => {
      const w = Math.ceil(window.innerWidth / SCALE);
      // Headroom below the fold, so the sky does not run out when a phone's
      // address bar slides away and the screen gets taller.
      const h = Math.ceil((window.innerHeight + 160) / SCALE);
      if (canvas.width === w && canvas.height >= h) return;
      canvas.width = w;
      canvas.height = Math.max(h, canvas.width === w ? canvas.height : 0);
      canvas.style.width = `${canvas.width * SCALE}px`;
      canvas.style.height = `${canvas.height * SCALE}px`;
      backdrop.width = canvas.width;
      backdrop.height = canvas.height;
      paintBand(back, canvas.width, canvas.height);
      if (still) draw(0);
    };

    // The near stars slide a pixel or two against the page and the hand.
    const shift = () => {
      const drift = Math.min(1, window.scrollY / 600);
      for (let l = 0; l < 3; l++) {
        ox[l] = Math.round(pointer * l);
        oy[l] = -Math.round(drift * l);
      }
    };
    const onPointer = (e: PointerEvent) => {
      pointer = (e.clientX / window.innerWidth - 0.5) * 2;
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const gap = streak.active ? FAST_MS : CALM_MS;
      if (t - last < gap) return;
      const elapsed = last === 0 ? gap : t - last;
      last = t;
      frame += 1;
      shift();

      if (streak.active) {
        streak.trail[(streak.n % TRAIL) * 2] = streak.x - streak.dx * 6;
        streak.trail[(streak.n % TRAIL) * 2 + 1] = streak.y - streak.dy * 6;
        streak.n += 1;
        streak.x += streak.dx;
        streak.y += streak.dy;
        streak.age += 1;
        if (streak.age > 30) streak.active = false;
      } else {
        nextStreak -= elapsed;
        if (nextStreak <= 0) {
          const leftward = chance() > 0.5;
          streak.active = true;
          streak.x = canvas.width * (0.15 + chance() * 0.7);
          streak.y = canvas.height * chance() * 0.3;
          streak.dx = (leftward ? -1 : 1) * (2.2 + chance() * 1.4);
          streak.dy = 0.9 + chance() * 0.8;
          streak.age = 0;
          streak.n = 0;
          nextStreak = 7000 + chance() * 12000;
        }
      }

      if (sat.active) {
        sat.x += sat.dx;
        sat.y += sat.dy;
        if (sat.x < -2 || sat.x > canvas.width + 2 || sat.y < -2) sat.active = false;
      } else {
        nextSat -= elapsed;
        if (nextSat <= 0) {
          // About forty seconds to cross, whatever the width.
          const leftward = chance() > 0.5;
          sat.active = true;
          sat.x = leftward ? canvas.width + 1 : -1;
          sat.y = canvas.height * (0.12 + chance() * 0.3);
          sat.dx = ((leftward ? -1 : 1) * canvas.width) / 400;
          sat.dy = -(0.02 + chance() * 0.05);
          nextSat = 45000 + chance() * 75000;
        }
      }
      draw(t);
    };

    fit();
    window.addEventListener("resize", fit);
    if (still) {
      draw(0);
    } else {
      window.addEventListener("pointermove", onPointer, { passive: true });
      raf = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="sky" aria-hidden="true" />;
}
