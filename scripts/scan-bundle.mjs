// Fails if a built client bundle contains something shaped like a secret. It reports the file and the kind of
// secret, never the value. Usage: node scripts/scan-bundle.mjs <dir>...
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const patterns = {
  "AWS access key id": /\bAKIA[0-9A-Z]{16}\b/,
  "Stripe live key": /\b[sr]k_live_[0-9A-Za-z]{16,}\b/,
  "GitHub token": /\bgh[pousr]_[0-9A-Za-z]{36,}\b/,
  "Slack token": /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
  "Google API key": /\bAIza[0-9A-Za-z_-]{35}\b/,
  "private key block": /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
  "JSON Web Token": /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
};

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: scan-bundle.mjs <dir>...");
  process.exit(2);
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|css|html|json|map|txt)$/.test(name)) yield path;
  }
}

let scanned = 0;
const found = [];
for (const dir of dirs) {
  for (const file of files(dir)) {
    scanned += 1;
    const text = readFileSync(file, "utf8");
    for (const [kind, pattern] of Object.entries(patterns)) if (pattern.test(text)) found.push(`${file}: ${kind}`);
  }
}

console.log(`Scanned ${scanned} files in ${dirs.join(", ")}`);
if (found.length > 0) {
  console.error(`Possible secrets in the bundle:\n${found.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("No secret-shaped strings found.");
