// Bundles the API into plain JavaScript for production, so the container runs `node dist/server.js` with no
// TypeScript runtime and no source files. The workspace packages (@trestle/*) are TypeScript source, so they are
// bundled in; every real npm dependency stays external and is installed in the image from the lockfile.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.entries(pkg.dependencies)
  .filter(([, version]) => !String(version).startsWith("workspace:"))
  .map(([name]) => name);

await build({
  entryPoints: {
    server: "src/server.ts",
    // Run once per release, before the new server starts.
    migrate: "src/db/migrate-cli.ts",
    // Demo data, for development and the rehearsal stack only (it refuses to run when NODE_ENV=production).
    seed: "src/db/seed-cli.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external,
  sourcemap: "linked",
  // Bundled CommonJS packages that call require() need one in an ES module.
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  logLevel: "info",
});
