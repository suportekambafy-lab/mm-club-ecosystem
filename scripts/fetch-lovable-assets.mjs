// Lovable serves files under /__l5e/assets-v1/ from its own hosting. Outside Lovable
// (OFF_LOVABLE=1) nothing serves that path, so copy them into public/ before the build.
// Read-only GETs against the live site; a failed download never fails the build.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

if (process.env.OFF_LOVABLE !== "1") process.exit(0);

const origin = (process.env.LOVABLE_ASSET_ORIGIN || "https://mmclub.pt").replace(/\/+$/, "");
const RE = /\/__l5e\/assets-v1\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+/g;
const paths = new Set();

(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(json|tsx?|css)$/.test(name)) for (const m of readFileSync(p, "utf8").match(RE) ?? []) paths.add(m);
  }
})("src");

let ok = 0;
for (const path of paths) {
  const out = join("public", path);
  if (existsSync(out)) { ok++; continue; }
  try {
    const res = await fetch(origin + path);
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || type.includes("text/html")) throw new Error(`${res.status} ${type}`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    ok++;
  } catch (e) {
    console.warn(`[lovable-assets] missing ${path}: ${e.message}`);
  }
}
console.log(`[lovable-assets] ${ok}/${paths.size} files available`);
