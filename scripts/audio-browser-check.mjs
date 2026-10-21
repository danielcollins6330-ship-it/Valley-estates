import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".m4a": "audio/mp4", ".png": "image/png" };
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, rel === "/" ? "index.html" : rel);
  try {
    const body = readFileSync(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.VEAudio);
await page.click("body");
const result = await page.evaluate(async () => {
  const audio = window.VEAudio;
  audio.unlock();
  audio.setLevel("music", 40);
  audio.setLevel("effects", 25);
  audio.setLevel("voice", 60);
  const saved = localStorage.getItem("valleyEstatesAudio");
  localStorage.setItem("valleyEstatesV4", "estate");
  audio.toggleMute();
  const muted = audio.settings().mute;
  audio.toggleMute();
  audio.say("harvest");
  audio.say("frost");
  const afterSays = audio.debug();
  const nightWorld = { night: 0.9, p: 0.8, raining: false, storm: false, cattle: false, sheep: false, farming: false };
  for (let i = 0; i < 12; i += 1) audio.sync(nightWorld);
  const night = audio.debug();
  const stormWorld = { night: 0.1, p: 0.1, raining: true, storm: true, cattle: false, sheep: false, farming: true };
  for (let i = 0; i < 12; i += 1) audio.sync(stormWorld);
  const storm = audio.debug();
  const probe = new Audio("assets/audio/voice/harvest-0.m4a");
  let played = false;
  let playError = "";
  try {
    await probe.play();
    played = probe.currentTime >= 0 && !probe.paused;
    probe.pause();
  } catch (error) {
    playError = String(error);
  }
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  document.dispatchEvent(new Event("visibilitychange"));
  const hidden = audio.debug();
  return {
    saved,
    estateUntouched: localStorage.getItem("valleyEstatesV4"),
    muted,
    html: audio.settingsHtml(),
    voice: { variant: afterSays.voice.variant, pending: afterSays.voice.pending },
    night: night.loops,
    storm: storm.loops,
    played,
    playError,
    hiddenPaused: hidden.paused,
    hiddenNow: document.hidden,
    settings: audio.settings(),
  };
});
console.log(JSON.stringify({ errors: errors.filter((line) => !line.includes("WebGL")), result }, null, 2));
await browser.close();
server.close();
const html = result.html;
if (!html.includes("Ambience") || !html.includes("Effects") || !html.includes("Voice") || !html.includes("Mute")) {
  throw new Error("settings html missing a control");
}
if (result.saved == null || !result.saved.includes("0.4")) throw new Error("settings were not stored");
if (result.estateUntouched !== "estate") throw new Error("audio settings wrote the estate save");
if (result.voice.variant.harvest !== 1 || result.voice.pending !== "frost") throw new Error("voice rate limit failed");
if (!(result.night.crickets && result.night.crickets.volume > 0.05)) throw new Error("night crickets did not start");
if (!(result.storm.rain && result.storm.rain.volume > result.night.rain.volume)) throw new Error("storm rain did not rise");
if (!result.played) throw new Error("voice m4a did not play: " + result.playError);
if (result.hiddenNow && !result.hiddenPaused) throw new Error("visibility did not pause audio");
console.log("BROWSER_AUDIO_OK");
