import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(root, "src/background/index.ts")],
    outfile: resolve(dist, "background.js"),
    bundle: true,
    format: "esm",
    target: "chrome120",
    sourcemap: true,
    minify: false,
  }),
  build({
    entryPoints: [resolve(root, "src/content/index.ts")],
    outfile: resolve(dist, "content.js"),
    bundle: true,
    format: "iife",
    target: "chrome120",
    sourcemap: true,
    minify: false,
  }),
  build({
    entryPoints: [resolve(root, "src/popup/main.tsx")],
    outfile: resolve(dist, "popup.js"),
    bundle: true,
    format: "iife",
    target: "chrome120",
    sourcemap: true,
    minify: false,
  }),
]);

await Promise.all([
  cp(resolve(root, "manifest.json"), resolve(dist, "manifest.json")),
  cp(resolve(root, "src/content/content.css"), resolve(dist, "content.css")),
  cp(resolve(root, "src/popup/popup.html"), resolve(dist, "popup.html")),
  cp(resolve(root, "src/popup/popup.css"), resolve(dist, "popup.css")),
]);

console.log(`Built extension at ${dist}`);
