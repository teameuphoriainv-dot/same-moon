import { NextResponse } from "next/server";
import { doorIsSet, opensDoor } from "@/lib/door";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Does this word open the door? Answers yes or no and nothing else. */
export async function POST(request: Request) {
  if (!doorIsSet()) {
    return NextResponse.json({ error: "Set SAME_MOON_DOOR on the server first." }, { status: 503 });
  }
  let word = "";
  try {
    const body = (await request.json()) as { word?: unknown };
    word = typeof body.word === "string" ? body.word.slice(0, 200) : "";
  } catch {
    return NextResponse.json({ error: "Send the word as JSON." }, { status: 400 });
  }
  return opensDoor(word)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "That is not it." }, { status: 401 });
}
