import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const release = process.argv.includes("--release");

const bundleOptions = {
  bundle: true,
  target: "chrome120",
  sourcemap: !release,
  minify: release,
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await Promise.all([
  build({
    entryPoints: [resolve(root, "src/background/index.ts")],
    outfile: resolve(dist, "background.js"),
    ...bundleOptions,
    format: "esm",
  }),
  build({
    entryPoints: [resolve(root, "src/content/index.ts")],
    outfile: resolve(dist, "content.js"),
    ...bundleOptions,
    format: "iife",
  }),
  build({
    entryPoints: [resolve(root, "src/popup/main.tsx")],
    outfile: resolve(dist, "popup.js"),
    ...bundleOptions,
    format: "iife",
  }),
  build({
    entryPoints: [resolve(root, "src/options/main.tsx")],
    outfile: resolve(dist, "options.js"),
    ...bundleOptions,
    format: "iife",
  }),
]);

await Promise.all([
  cp(resolve(root, "manifest.json"), resolve(dist, "manifest.json")),
  cp(resolve(root, "src/content/content.css"), resolve(dist, "content.css")),
  cp(resolve(root, "src/popup/popup.html"), resolve(dist, "popup.html")),
  cp(resolve(root, "src/popup/popup.css"), resolve(dist, "popup.css")),
  cp(resolve(root, "src/options/options.html"), resolve(dist, "options.html")),
  cp(resolve(root, "src/options/options.css"), resolve(dist, "options.css")),
  cp(resolve(root, "public"), resolve(dist), { recursive: true }),
]);

console.log(`Built ${release ? "release" : "development"} extension at ${dist}`);
