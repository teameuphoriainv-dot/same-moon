/**
 * How painted pixels are packed for the trip to the server: two base 36 digits
 * for where on the sheet, then one letter for the ink. The server unpacks the
 * same three characters, so the two sides have to agree exactly.
 */
export function encodeStrokes(pixels: Map<number, string>): string {
  let out = "";
  for (const [at, ink] of pixels) {
    out += at.toString(36).padStart(2, "0") + ink;
  }
  return out;
}
