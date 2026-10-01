import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isPerson } from "@/lib/auth";
import { opensDoor } from "@/lib/door";

/**
 * Where photos for the storybook are taken in and thrown away.
 *
 * The phone has already shrunk the picture to a JPEG of a few hundred
 * kilobytes, so this takes the bytes as they are and hands them to storage.
 *
 * The check at the door is the same word as the lock screen, checked here on
 * the server. It keeps a stranger who stumbles on this address from filling
 * the storage up.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;
const FOLDER = "book/";
const STORAGE_HOST = ".public.blob.vercel-storage.com";

function refuse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function storageReady(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/** Every JPEG opens with the same three bytes. */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function POST(request: Request) {
  const who = request.headers.get("x-same-moon-who") ?? "";
  if (!opensDoor(request.headers.get("x-same-moon-code")) || !isPerson(who)) {
    return refuse(401, "Sign in again, then try once more.");
  }
  if (!storageReady()) return refuse(503, "Photo storage is not set up yet.");

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (type !== "image/jpeg") return refuse(415, "Only photos can go in the book.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) {
    return refuse(413, "That photo is too big.");
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return refuse(400, "That photo arrived empty. Try again.");
  if (bytes.length > MAX_BYTES) return refuse(413, "That photo is too big.");
  if (!isJpeg(bytes)) return refuse(415, "Only photos can go in the book.");

  try {
    const blob = await put(`${FOLDER}${who.toLowerCase()}-${Date.now()}.jpg`, Buffer.from(bytes), {
      access: "public",
      // The random part is what makes the address impossible to guess.
      addRandomSuffix: true,
      contentType: "image/jpeg",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[same-moon] photo upload failed", err);
    return refuse(502, "The photo could not be saved. Try again.");
  }
}

export async function DELETE(request: Request) {
  const who = request.headers.get("x-same-moon-who") ?? "";
  if (!opensDoor(request.headers.get("x-same-moon-code")) || !isPerson(who)) {
    return refuse(401, "Sign in again, then try once more.");
  }
  if (!storageReady()) return refuse(503, "Photo storage is not set up yet.");

  // Only ever delete something this route could have put there.
  let target: URL;
  try {
    target = new URL(new URL(request.url).searchParams.get("url") ?? "");
  } catch {
    return refuse(400, "That is not a photo from the book.");
  }
  if (
    target.protocol !== "https:" ||
    !target.hostname.endsWith(STORAGE_HOST) ||
    !target.pathname.startsWith(`/${FOLDER}`)
  ) {
    return refuse(400, "That is not a photo from the book.");
  }

  try {
    await del(target.toString());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[same-moon] photo delete failed", err);
    return refuse(502, "The photo could not be removed.");
  }
}
