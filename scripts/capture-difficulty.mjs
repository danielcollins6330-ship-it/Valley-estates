import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".m4a": "audio/mp4",
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, rel === "/" ? "index.html" : rel);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
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
const address = server.address();
if (address == null || typeof address === "string") throw new Error("server did not bind");
const origin = `http://127.0.0.1:${address.port}`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
    "--window-size=1400,2800",
  ],
});

mkdirSync("store/screenshots", { recursive: true });

const page = await browser.newPage();
page.setDefaultTimeout(120000);
page.on("pageerror", (err) => console.log("pageerror", String(err).slice(0, 400)));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("console", msg.text().slice(0, 300));
});
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.removeItem("valleyEstatesV4");
    localStorage.setItem("valleyEstatesAudio", JSON.stringify({ music: 0, effects: 0, voice: 0, mute: true }));
  } catch {
    /* about:blank */
  }
});
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => {
  const boot = document.getElementById("entry-boot");
  return boot && boot.hidden && document.querySelector('[data-b="entry-difficulty"]');
}, { timeout: 120000 });
await page.click('[data-b="entry-difficulty"]');
await page.waitForFunction(() => {
  const title = document.getElementById("entry-title");
  const on = document.querySelector('.diff-card[aria-checked="true"]');
  return title && title.textContent.includes("Choose your difficulty") && on && on.textContent.includes("Normal") && on.querySelector(".diff-tick-mark") && on.querySelector(".diff-tick-mark").textContent.includes("✓");
});

const layout = await page.evaluate(() => {
  const sheet = document.getElementById("sheet");
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      left: Math.round(r.left),
      right: Math.round(r.right),
      h: Math.round(r.height),
      font: style.fontSize,
      text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    };
  };
  const cards = [...document.querySelectorAll(".diff-card")].map((el) => ({
    ...box(el),
    checked: el.getAttribute("aria-checked"),
    tick: el.querySelector(".diff-tick-mark") ? el.querySelector(".diff-tick-mark").textContent : "",
  }));
  return {
    vh: window.innerHeight,
    vw: window.innerWidth,
    scroll: sheet.scrollHeight,
    client: sheet.clientHeight,
    title: box(document.getElementById("entry-title")),
    start: box(document.querySelector('[data-b="entry-start"]')),
    back: box(document.querySelector('[data-b="entry-back"]')),
    cards,
    bar: document.getElementById("bar").textContent,
  };
});
console.log(JSON.stringify(layout, null, 2));
function inside(box, name) {
  if (!box) throw new Error(name + " missing");
  const size = Number.parseFloat(box.font);
  if (size < 13) throw new Error(name + " font " + box.font);
  if (box.top < 0 || box.bottom > layout.vh + 1) throw new Error(name + " clipped " + JSON.stringify(box));
}
inside(layout.title, "title");
inside(layout.start, "start");
inside(layout.back, "back");
for (const card of layout.cards) inside(card, "card");
if (layout.scroll > layout.client + 2) throw new Error("difficulty step scrolls " + layout.scroll + " > " + layout.client);
await page.screenshot({ path: "store/screenshots/difficulty-newgame-iphone.png" });

await page.click('[data-b="entry-start"]');
await page.waitForFunction(() => window.VE && window.VE.G && window.VE.G.tutorialSeen && window.VE.frames > 2 && !window.VEEntry.isOpen(), { timeout: 120000 });
await page.click("#bMenu");
await page.waitForFunction(() => {
  const badge = document.querySelector(".diff-badge");
  const row = document.querySelector(".diff-setting");
  return badge && row && row.textContent.includes("Difficulty") && document.getElementById("bar").textContent.indexOf("Difficulty") === -1;
});
const menu = await page.evaluate(() => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), font: getComputedStyle(el).fontSize, text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100) };
  };
  return {
    badge: box(document.querySelector(".diff-badge")),
    note: box(document.querySelector(".diff-badge-note")),
    row: box(document.querySelector(".diff-setting")),
    sheetTop: Math.round(document.getElementById("sheet").getBoundingClientRect().top),
    hudHasBadge: !!document.querySelector("#bar .diff-badge, #hud .diff-badge, #sub .diff-badge"),
  };
});
console.log(JSON.stringify(menu, null, 2));
for (const [name, box] of Object.entries(menu)) {
  if (!box || typeof box.top !== "number") continue;
  if (box.top < 0 || box.bottom > 844) throw new Error(name + " clipped " + JSON.stringify(box));
  if (Number.parseFloat(box.font) < 13) throw new Error(name + " font " + box.font);
}
if (menu.hudHasBadge) throw new Error("difficulty badge is on the HUD");
await page.screenshot({ path: "store/screenshots/difficulty-settings-iphone.png" });

function pngSize(file) {
  const buf = readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
for (const file of ["store/screenshots/difficulty-newgame-iphone.png", "store/screenshots/difficulty-settings-iphone.png"]) {
  console.log(file, pngSize(file));
}

await browser.close();
server.close();
