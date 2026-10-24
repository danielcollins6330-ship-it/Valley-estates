import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stageWeb, checkWeb } from "./stage-web.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const file = (path) => new URL(path, `file://${ROOT}`);

test("mobile and Pages bundles include the complete, identical runtime asset tree", () => {
  stageWeb("www");
  stageWeb("_site");
  for (const path of [
    "assets/audio.js", "assets/audio-policy.js", "assets/audio/build.m4a", "assets/audio/voice/harvest-0.m4a",
    "assets/expansion.js", "assets/haptics.js", "assets/rig.js", "assets/buildings.js",
    "assets/animals/cattle.glb", "assets/animals/sheep.glb", "assets/animals/meshopt_decoder.js",
    "assets/animals/coat.webp", "assets/buildings/homestead.glb", "assets/buildings/valleyvilla.glb",
    "AUDIO_CREDITS.md", "ASSET_CREDITS.md", ".nojekyll",
  ]) {
    assert.ok(existsSync(file(`www/${path}`)), `${path} bundled for mobile`);
    assert.deepEqual(readFileSync(file(`www/${path}`)), readFileSync(file(`_site/${path}`)), `${path} identical for Pages`);
  }
  checkWeb("www");
  checkWeb("_site");
});

test("missing or stale audio fails validation rather than shipping a silent game", () => {
  stageWeb("www");
  const audio = file("www/assets/audio/build.m4a");
  rmSync(audio);
  assert.throws(() => checkWeb("www"), /Missing bundled asset: assets\/audio\/build.m4a/);
  stageWeb("www");
  writeFileSync(audio, "not the source recording");
  assert.throws(() => checkWeb("www"), /Bundled asset differs from source: assets\/audio\/build.m4a/);
  stageWeb("www");
});

test("staging refuses repository or arbitrary output paths", () => {
  for (const destination of [".", "..", "assets", "/tmp/valley-estates", "www/../assets"]) {
    assert.throws(() => stageWeb(destination), /Output must be www or _site/);
  }
});

test("Pages uses the same checked staging script as native builds", () => {
  const workflow = readFileSync(file(".github/workflows/pages.yml"), "utf8");
  assert.match(workflow, /node scripts\/stage-web\.mjs _site/);
  assert.doesNotMatch(workflow, /cp assets\/textures\.js/);
});
