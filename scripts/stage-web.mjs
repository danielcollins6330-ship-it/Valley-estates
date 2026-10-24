import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REQUIRED = ["index.html", "game3d.js", "privacy.html", "support.html", "CREDITS.md", "favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png"];
const DOCUMENTS = ["README.md", ".nojekyll", "AUDIO_CREDITS.md", "ASSET_CREDITS.md"];

function assetFiles(directory, prefix = "assets") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? assetFiles(join(directory, entry.name), path) : [path];
  });
}

export function checkWeb(destination) {
  const target = resolve(ROOT, destination);
  for (const file of [...REQUIRED, ...DOCUMENTS.filter((name) => existsSync(join(ROOT, name))), ...assetFiles(join(ROOT, "assets"))]) {
    const output = join(target, file);
    if (!existsSync(output)) throw new Error(`Missing bundled asset: ${file}`);
    if (!readFileSync(output).equals(readFileSync(join(ROOT, file)))) throw new Error(`Bundled asset differs from source: ${file}`);
  }
  const html = readFileSync(join(target, "index.html"), "utf8");
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const source = match[1];
    if (/^(?:[a-z]+:)?\/\//i.test(source) || source.startsWith("data:")) continue;
    const local = source.split(/[?#]/)[0];
    if (!existsSync(join(target, local))) throw new Error(`HTML script not bundled: ${local}`);
  }
}

export function stageWeb(destination = "www") {
  // Both callers use named build directories. Never allow a typo to delete the repository.
  if (destination !== "www" && destination !== "_site") throw new Error("Output must be www or _site");
  const target = join(ROOT, destination);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const file of REQUIRED) cpSync(join(ROOT, file), join(target, file));
  for (const file of DOCUMENTS) if (existsSync(join(ROOT, file))) cpSync(join(ROOT, file), join(target, file));
  // One complete runtime asset tree for web and native builds. This includes audio,
  // building and animal models, textures, loaders, expansion logic and haptics.
  cpSync(join(ROOT, "assets"), join(target, "assets"), { recursive: true });
  checkWeb(destination);
  return target;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = process.argv[2] || "www";
  stageWeb(destination);
  console.log(`Staged and verified ${destination}: every runtime asset matches source.`);
}
