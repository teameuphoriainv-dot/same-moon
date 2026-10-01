/** Things to draw, for when the canvas is blank and so are they. */
export const IDEAS = [
  "Draw the two of you.",
  "Draw what you had for dinner.",
  "Draw the view from your window.",
  "Draw each other, badly.",
  "Draw a house you would both live in.",
  "Draw your whole day in one picture.",
  "Draw the pet you want.",
  "Draw the moon tonight.",
  "Draw the first thing you did together.",
  "Draw something only the two of you would get.",
  "One of you draws. The other one guesses.",
  "Take turns. Add one thing each.",
  "Draw where you want to go next.",
  "Draw your favourite thing about today.",
];

/** A different idea from the one already showing. */
export function nextIdea(current: string, pick: () => number = Math.random): string {
  const pool = IDEAS.filter((idea) => idea !== current);
  return pool[Math.floor(pick() * pool.length)] ?? IDEAS[0];
}
