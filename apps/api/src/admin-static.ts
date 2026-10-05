import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

import type { Hono } from "hono";

import type { Env } from "./context";

// The admin panel is a static single-page app. Serving it from the API's own origin keeps the session cookie
// same-site without needing a domain, removes CORS from the admin entirely, and means one build runs anywhere
// (its API URL is relative). The files come from the admin's production build (`vite build`).

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/** The headers the build emits for the panel (its `_headers` file, first block), so they are defined once. */
export function readHeadersFile(dir: string): Record<string, string> {
  const file = join(dir, "_headers");
  if (!existsSync(file)) return {};
  const headers: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line);
    if (match) headers[match[1]!] = match[2]!.trim();
  }
  return headers;
}

/** Paths the API owns; everything else is the panel. */
export const isApiPath = (path: string) => path === "/health" || path === "/api" || path.startsWith("/api/");

export function serveAdmin(app: Hono<Env>, dir: string) {
  const root = resolve(dir);
  const indexFile = join(root, "index.html");
  if (!existsSync(indexFile)) throw new Error(`ADMIN_DIST has no index.html: ${root}`);
  const headers = readHeadersFile(root);

  app.get("*", (c) => {
    const path = decodeURIComponent(c.req.path);
    if (isApiPath(path)) return c.notFound();

    // Never leave the build directory, whatever the path says.
    const requested = normalize(join(root, path));
    const inside = requested === root || requested.startsWith(root + sep);
    const isFile = inside && existsSync(requested) && statSync(requested).isFile();

    // An unknown path with no extension is a client-side route of the panel; an unknown file is a real 404.
    if (!isFile && extname(path)) return c.notFound();
    const file = isFile ? requested : indexFile;

    for (const [name, value] of Object.entries(headers)) c.header(name, value);
    // Fingerprinted assets never change; the HTML that references them must always be revalidated.
    c.header("Cache-Control", file !== indexFile && path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    c.header("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    return c.body(readFileSync(file));
  });
}
