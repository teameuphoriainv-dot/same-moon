"use client";

/**
 * Gets a photo ready to go in the book.
 *
 * A picture straight off a phone camera is several megabytes, which is far
 * more than a page needs. It is shrunk here, on the phone, before it is sent:
 * the upload is quick even on a poor connection and the book stays light to
 * open. A second, tiny copy is made to be drawn while the real one loads.
 */

const LONG_EDGE = 1600;
const THUMB_EDGE = 36;
const QUALITY = 0.84;
/** Comfortably under what the server will take in one request. */
const MAX_BYTES = 3_500_000;

export interface Prepared {
  blob: Blob;
  /** A data URL a few hundred bytes long. */
  thumb: string;
  w: number;
  h: number;
}

type Source = ImageBitmap | HTMLImageElement;

async function open(file: File): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      // Turns the picture the right way up, the way the camera meant it.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to the element, which can open a few things this cannot */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("unreadable"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sizeOf(source: Source): { w: number; h: number } {
  if ("naturalWidth" in source) return { w: source.naturalWidth, h: source.naturalHeight };
  return { w: source.width, h: source.height };
}

function draw(source: Source, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  // A JPEG has no see-through, so anything clear would otherwise come out black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("no blob"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Scale a size down so its longer side is `edge`, never up. */
export function fit(w: number, h: number, edge: number): { w: number; h: number } {
  const scale = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

export async function preparePhoto(file: File): Promise<Prepared> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("That is not a picture. Pick a photo.");
  }

  let source: Source;
  try {
    source = await open(file);
  } catch {
    throw new Error("That photo could not be opened. Try a JPG or a PNG.");
  }

  try {
    const real = sizeOf(source);
    if (!real.w || !real.h) throw new Error("That photo could not be opened. Try a JPG or a PNG.");

    let size = fit(real.w, real.h, LONG_EDGE);
    let blob = await toBlob(draw(source, size.w, size.h), QUALITY);
    if (blob.size > MAX_BYTES) {
      size = fit(real.w, real.h, 1100);
      blob = await toBlob(draw(source, size.w, size.h), 0.76);
    }
    if (blob.size > MAX_BYTES) throw new Error("That photo is too big, even shrunk down.");

    const small = fit(real.w, real.h, THUMB_EDGE);
    const thumb = draw(source, small.w, small.h).toDataURL("image/jpeg", 0.7);

    return { blob, thumb, w: size.w, h: size.h };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("That photo")) throw err;
    throw new Error("That photo could not be made ready. Try a different one.");
  } finally {
    if ("close" in source) source.close();
  }
}
