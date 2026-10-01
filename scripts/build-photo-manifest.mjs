import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const photosDir = join(root, "public", "photos");
const out = join(root, "src", "lib", "photo-manifest.json");

const OK = /\.(jpe?g|png|webp|avif|gif)$/i;

mkdirSync(photosDir, { recursive: true });
mkdirSync(dirname(out), { recursive: true });

const files = readdirSync(photosDir)
  .filter((f) => OK.test(f) && !f.startsWith("."))
  .sort();

writeFileSync(out, JSON.stringify({ photos: files }, null, 2) + "\n");
console.log(`[same-moon] ${files.length} photo(s) in public/photos`);
