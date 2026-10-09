import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const artifacts = resolve(root, "artifacts");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const archive = resolve(artifacts, `gradual-read-v${packageJson.version}.zip`);

await run(process.execPath, [resolve(root, "scripts/build.mjs"), "--release"], { cwd: root });
await mkdir(artifacts, { recursive: true });
await rm(archive, { force: true });
await run("zip", ["-qr", archive, "."], { cwd: dist });

console.log(`Packaged Chrome Web Store archive at ${archive}`);
