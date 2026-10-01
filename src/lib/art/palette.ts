/**
 * The one palette every sprite on the site is drawn from.
 *
 * It is a superset of the birthday sheet's PARTY palette, so a sprite written
 * against either one renders the same. Plain data with no React in it, so the
 * tests can import it.
 *
 * Nothing here is outlined in `k` and left at that. `k` is nearly the colour of
 * the page, so a shape that depends on its outline to be read disappears on
 * the night sky. Shapes are carried by their fills.
 */

export type Palette = Record<string, string>;

export const INK: Palette = {
  k: "#05070d", // edge
  d: "#0d1220", // night, deep
  n: "#1d2438", // night panel
  N: "#2b3450", // night panel, lit side
  s: "#7f8db5", // slate
  S: "#aebbe0", // slate, light
  m: "#f4e9d4", // moonlight
  w: "#fffbf0", // highlight
  g: "#e2d2ae", // moonlight, a shade down
  G: "#c0ae87", // moonlight, shaded
  H: "#8f8061", // moonlight, deep shade
  b: "#d8a94b", // brass
  B: "#f2d287", // brass, bright
  z: "#8c6a25", // brass, deep
  r: "#c97b84", // rose
  R: "#e3a3aa", // rose, light
  q: "#8e4f58", // rose, deep
  l: "#a8d98a", // leaf
  L: "#d3f0b5", // leaf, light
  t: "#5d8a4e", // leaf, deep
  u: "#6fa8c9", // water
  U: "#a9d3e8", // water, light
  p: "#9a86c9", // dusk
  P: "#c4b5e6", // dusk, light
  o: "#d98a4f", // ember
  O: "#f0b987", // ember, light
  e: "#6b4a2f", // wood
  E: "#93694a", // wood, light
};

/** For glyphs that take their colour from the text around them. */
export const GLYPH: Palette = { ...INK, x: "currentColor" };
