/**
 * Makes the tsc output in .test-build runnable by `node --test`.
 *
 * The app compiles with bundler module resolution, so `import "./dates"` is
 * written without an extension. Node's ESM loader will not resolve that, so
 * every relative specifier gets a `.js` put back on it here. Marking the
 * directory as ESM is the other half.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = ".test-build";

writeFileSync(join(DIR, "package.json"), '{"type":"module"}\n');

/** Every .js file under a directory, however deep. The sprites live one level down. */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return name.endsWith(".js") ? [path] : [];
  });
}

for (const path of walk(DIR)) {
  const fixed = readFileSync(path, "utf8").replace(
    /(\bfrom\s+")(\.\.?\/[^"]*?)(")/g,
    (whole, open, spec, close) =>
      spec.endsWith(".js") ? whole : `${open}${spec}.js${close}`,
  );
  writeFileSync(path, fixed);
}
