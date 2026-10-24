import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

function harness() {
  const handlers = new Map();
  const documentHandlers = new Map();
  const media = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.paused = true; this.volume = 1; this.muted = false; this.currentTime = 0; this.events = new Map(); media.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    addEventListener(name, fn) { this.events.set(name, fn); }
    removeEventListener(name) { this.events.delete(name); }
  }
  const storage = new Map([["valleyEstatesV4", "estate-save-must-not-change"]]);
  const add = (map) => (name, fn) => { if (!map.has(name)) map.set(name, []); map.get(name).push(fn); };
  const document = { hidden: false, addEventListener: add(documentHandlers) };
  const audioSession = { type: "auto" };
  const context = vm.createContext({ Audio: FakeAudio, navigator: { audioSession }, performance: { now: () => 100000 }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, document, addEventListener: add(handlers), Math, Set, Map, WeakMap, console, setTimeout, clearTimeout });
  context.window = context;
  for (const file of ["../assets/audio-policy.js", "../assets/audio.js"]) vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
  const dispatch = (name) => { for (const handler of handlers.get(name) || []) handler({ type: name }); };
  const visibility = (hidden) => { document.hidden = hidden; for (const handler of documentHandlers.get("visibilitychange") || []) handler({ type: "visibilitychange" }); };
  return { audio: context.VEAudio, media, storage, dispatch, visibility, audioSession };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

async function started() { const h = harness(); h.audio.unlock(); await settle(); return h; }

test("pagehide/pageshow does not leave a visible game permanently silent", async () => {
  const h = await started();
  h.dispatch("pagehide");
  assert.equal(h.audio.debug().paused, true);
  h.dispatch("pageshow");
  assert.equal(h.audio.debug().paused, false);
  h.audio.sync({ night: 0, p: 0.1 });
  await settle();
  assert.ok(h.media.some(item => !item.paused && item.volume > 0));
});

test("effects volume zero silences an effect already playing", async () => {
  const h = await started();
  h.audio.sfx("build");
  await settle();
  const effect = h.media.find(item => item.src.endsWith("/build.m4a") && !item.paused);
  assert.ok(effect, "effect starts before changing its slider");
  h.audio.setLevel("effects", 0);
  assert.ok(effect.paused || effect.volume === 0, "playing effect must respect its new bus volume");
});

test("voice volume zero silences speech already playing", async () => {
  const h = await started();
  h.audio.say("harvest");
  await settle();
  const voice = h.media.find(item => item.src.endsWith("/voice/harvest-0.m4a") && !item.paused);
  assert.ok(voice, "voice starts before changing its slider");
  h.audio.setLevel("voice", 0);
  assert.ok(voice.paused || voice.volume === 0, "playing speech must respect its new bus volume");
});

test("visibility and master mute immediately pause active audio", async () => {
  const h = await started();
  h.audio.sfx("build"); h.audio.say("harvest");
  h.visibility(true);
  assert.equal(h.audio.debug().paused, true);
  assert.ok(h.media.every(item => item.paused));
  h.visibility(false);
  assert.equal(h.audio.debug().paused, false);
  h.audio.sfx("coins");
  h.audio.toggleMute();
  assert.ok(h.media.every(item => item.paused));
});

test("playback session stays active and the unlock gesture does not pause the loops", async () => {
  const h = harness();
  assert.equal(h.audioSession.type, "playback");
  h.audio.unlock();
  h.audio.sync({ night: 0, p: 0.1 });
  await settle();
  await settle();
  const wind = h.media.find((item) => item.src.endsWith("/wind.m4a"));
  assert.ok(wind, "wind loop is created on the first tap");
  assert.equal(wind.paused, false);
  assert.ok(wind.volume > 0, "ambience is audible after the gesture promise resolves");
  assert.equal(h.audioSession.type, "playback");
  assert.equal(h.audio.debug().settings.mute, false);
});

test("shipped cues are m4a and present for the iOS bundle", () => {
  const root = fileURLToPath(new URL("../assets/audio/", import.meta.url));
  const files = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, prefix + name + "/");
      else files.push({ name: prefix + name, path });
    }
  };
  walk(root, "");
  assert.ok(files.length >= 40);
  assert.equal(files.some((file) => file.name.endsWith(".ogg") || file.name.endsWith(".mp3")), false);
  for (const file of files) {
    assert.match(file.name, /\.m4a$/);
    const bytes = readFileSync(file.path);
    assert.ok(bytes.length > 200, file.name);
    assert.equal(bytes.subarray(4, 8).toString("ascii"), "ftyp", file.name);
  }
  const player = readFileSync(new URL("../assets/audio.js", import.meta.url), "utf8");
  assert.match(player, /audioSession\.type = "playback"/);
  assert.doesNotMatch(player, /audioSession\.type = "ambient"/);
  assert.match(player, /\.m4a"/);
  assert.doesNotMatch(player, /\.ogg/);
});

test("sound settings never overwrite the estate save", async () => {
  const h = await started();
  h.audio.setLevel("music", 40); h.audio.setLevel("effects", 25); h.audio.toggleMute();
  assert.equal(h.storage.get("valleyEstatesV4"), "estate-save-must-not-change");
  const saved = JSON.parse(h.storage.get("valleyEstatesAudio"));
  assert.equal(saved.music, 0.4); assert.equal(saved.effects, 0.25); assert.equal(saved.mute, true);
});
