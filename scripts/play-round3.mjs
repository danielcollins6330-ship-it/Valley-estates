import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { spawnSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const outDir = "/opt/cursor/artifacts";
const frameDir = "/tmp/ve-round3-frames";
mkdirSync(outDir, { recursive: true });
mkdirSync(frameDir, { recursive: true });

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".m4a": "audio/mp4", ".ico": "image/x-icon" };
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, rel === "/" ? "index.html" : rel);
  try {
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const display = Boolean(process.env.DISPLAY);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: display ? false : true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", display ? "--use-angle=gl" : "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--window-size=1400,900"],
});

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function overlaps(a, b, pad = 2) {
  return a.right > b.left + pad && a.left < b.right - pad && a.bottom > b.top + pad && a.top < b.bottom - pad;
}

async function openGame(width, height) {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err).slice(0, 500)));
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.removeItem("valleyEstatesV4");
      localStorage.removeItem("valleyEstatesA11y");
      localStorage.setItem("valleyEstatesAudio", JSON.stringify({ music: 0, effects: 0, voice: 0, mute: true }));
    } catch { /* about:blank */ }
  });
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.VE && window.VE.G && window.VE3D && window.VE.frames > 3, { timeout: 120000 });
  await page.evaluate(() => { document.getElementById("modal").style.display = "none"; });
  return { page, errors };
}

async function boxes(page) {
  return page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      cls: document.documentElement.className,
      crew: box(document.getElementById("bCrew")),
      panel: box(document.getElementById("panel")),
      side: box(document.getElementById("side")),
      rside: box(document.getElementById("rside")),
      goal: box(document.getElementById("goal")),
      bar: box(document.getElementById("bar")),
      sub: box(document.getElementById("sub")),
      mini: box(document.getElementById("mini")),
    };
  });
}

const phone = await openGame(390, 844);
const phoneBox = await boxes(phone.page);
assert(phoneBox.crew.width >= 44 && phoneBox.crew.height >= 44, "crew button is small");
assert(!overlaps(phoneBox.rside, phoneBox.panel), "crew stack overlaps the panel");
assert(!overlaps(phoneBox.side, phoneBox.panel), "pause stack overlaps the panel");
assert(!overlaps(phoneBox.bar, phoneBox.sub), "bar overlaps the season line");
assert(!overlaps(phoneBox.sub, phoneBox.goal), "season line overlaps the goal");

await phone.page.click("#bCrew");
await phone.page.waitForFunction(() => document.body.innerText.includes("Farm desk"));
await phone.page.click("[data-b=research]");
await phone.page.waitForFunction(() => document.body.innerText.includes("Homestead Age") && document.body.innerText.includes("Foot Treading"));
await phone.page.screenshot({ path: join(outDir, "expansion-research.png") });

await phone.page.evaluate(() => { document.getElementById("modal").style.display = "none"; });
await phone.page.click("#bCrew");
await phone.page.click("[data-b=hands]");
await phone.page.waitForFunction(() => document.body.innerText.includes("Ned") && document.body.innerText.includes("Hire vines"));
await phone.page.screenshot({ path: join(outDir, "expansion-hands.png") });
const hired = await phone.page.evaluate(() => {
  const before = window.VE.G.units.length;
  document.querySelector("[data-b=hire\\:vines]").click();
  const units = window.VE.G.units;
  return { before, after: units.length, name: units[units.length - 1].name, skill: units[units.length - 1].skill };
});
assert(hired.after === hired.before + 1, "hire did not add a farmhand");
assert(hired.skill === "vines", "hired hand has the wrong skill");

await phone.page.evaluate(() => {
  const G = window.VE.G;
  G.age = 1;
  G.time = 80;
  G.res.wine = 2;
  G.wineTiers.bronze = 0;
  G.wineTiers.silver = 2;
  G.wineTiers.gold = 0;
  G.order = { good: "silver", qty: 2, reward: 110, until: G.time + 120, label: "Silver wine" };
});
await phone.page.evaluate(() => { document.getElementById("modal").style.display = "none"; });
await phone.page.click("#bCrew");
await phone.page.click("[data-b=orders]");
await phone.page.waitForFunction(() => document.body.innerText.includes("Silver wine") && document.body.innerText.includes("Deliver"));
await phone.page.screenshot({ path: join(outDir, "expansion-orders.png") });
const delivered = await phone.page.evaluate(() => {
  const before = window.VE.G.res.coins;
  document.querySelector("[data-b=deliver-order]").click();
  return { before, after: window.VE.G.res.coins, order: window.VE.G.order, silver: window.VE.G.wineTiers.silver };
});
assert(delivered.order === null, "order was not cleared");
assert(delivered.silver === 0, "silver bottles were not spent");
assert(delivered.after === delivered.before + 110, "order did not pay the bonus");

await phone.page.evaluate(() => { document.getElementById("modal").style.display = "none"; });
await phone.page.click("#bMenu");
await phone.page.waitForFunction(() => document.body.innerText.includes("Text size"));
await phone.page.click("[data-b='a11y:text:large']");
await phone.page.click("[data-b='a11y:cb:1']");
await phone.page.waitForFunction(() => document.documentElement.classList.contains("text-lg") && document.documentElement.classList.contains("cb"));
await phone.page.evaluate(() => {
  const node = [...document.querySelectorAll("#sheet p")].find((p) => p.textContent.includes("Text size"));
  if (node) node.scrollIntoView({ block: "center" });
});
await phone.page.screenshot({ path: join(outDir, "expansion-settings.png") });
const bar = await phone.page.evaluate(() => document.getElementById("rF").textContent);
assert(bar.includes("Fd"), "colour-blind label missing");

await phone.page.click("[data-b='a11y:lefty:1']");
const lefty = await boxes(phone.page);
assert(lefty.cls.includes("lefty"), "left-handed class missing");
assert(lefty.rside.left < lefty.side.left, "left-handed layout did not move the main controls");
assert(!overlaps(lefty.rside, lefty.panel), "left-handed controls overlap the panel");

await phone.page.evaluate(() => {
  const button = document.querySelector("[data-b=reset-ask]");
  if (button) button.scrollIntoView({ block: "center" });
});
await phone.page.click("[data-b=reset-ask]");
await phone.page.waitForFunction(() => document.body.innerText.includes("Erase this estate?"));
const seed = await phone.page.evaluate(() => window.VE.G.seed);
await phone.page.click("[data-b=newgame-no]");
const kept = await phone.page.evaluate(() => window.VE.G.seed);
assert(kept === seed, "cancel reset changed the estate");
assert(phone.errors.length === 0, "phone page errors: " + phone.errors.join(" | "));
await phone.page.close();

const play = await openGame(1280, 800);
const soak = await play.page.evaluate(() => {
  const VE = window.VE;
  const G = VE.G;
  const X = window.VEExpansion;
  document.getElementById("modal").style.display = "none";
  G.coach = 4;
  G.nextEvt = 1e9;
  G.nextChoice = 1e9;
  G.nextOrder = 1e9;
  const notes = [];
  for (let i = 0; i < 400; i++) VE.tick(0.05);
  notes.push({ phase: "early", age: G.age, time: Math.round(G.time), coins: G.res.coins });
  function ensure(type, x, y) {
    let building = G.buildings.find((item) => item.type === type);
    if (!building) {
      building = { id: 700 + G.buildings.length, type, x, y, w: VE.B[type].w, h: VE.B[type].h, built: true, prog: 1, queue: [], research: null, stock: 0, food: 0, grapes: 0, olives: 0, count: 0, kind: null, pt: 0, wt: 0 };
      X.decorateBuilding(building);
      G.buildings.push(building);
    }
    building.built = true;
    return building;
  }
  const vines = ensure("vineyard", 42, 34);
  vines.grapes = 70;
  vines.pruned = 1;
  const winery = ensure("winery", 44, 30);
  winery.wt = 0;
  const pad = ensure("paddock", 34, 38);
  pad.kind = "sheep";
  pad.count = 4;
  pad.health = 84;
  pad.condition = 76;
  pad.fleece = 90;
  ensure("market", 32, 30);
  G.age = 2;
  G.season = 2;
  G.res.grapes = 80;
  G.res.food = 3000;
  G.res.wood = 3000;
  G.res.coins = 400;
  const midCoins = G.res.coins;
  const midWine = G.stats.wine;
  for (let i = 0; i < 800; i++) VE.tick(0.05);
  notes.push({ phase: "mid", coins: G.res.coins - midCoins, wine: G.stats.wine - midWine, wool: G.res.wool });
  G.age = 3;
  for (const node of X.RESEARCH) G.techs[node.id] = 1;
  G.techs.barrels = 1;
  G.res.grapes = 200;
  vines.grapes = 70;
  const lateCoins = G.res.coins;
  const lateWine = G.stats.wine;
  for (let i = 0; i < 800; i++) VE.tick(0.05);
  notes.push({ phase: "late", coins: G.res.coins - lateCoins, wine: G.stats.wine - lateWine, wool: G.res.wool, tiers: { ...G.wineTiers } });
  const home = G.buildings.find((item) => item.type === "homestead");
  home.research = null;
  delete G.techs.crush;
  G.selB = home.id;
  G.res.food = 500;
  VE.act("tech:crush");
  G.order = null;
  G.res.wool = 12;
  G.order = { good: "wool", qty: 8, reward: 42, until: G.time + 30, label: "Wool" };
  const paid = X.deliverOrder(G);
  G.order = { good: "olives", qty: 8, reward: 24, until: G.time - 1, label: "Olives" };
  const missed = X.tickOrder(G, G.time);
  G.order = { good: "olives", qty: 8, reward: 24, until: G.time + 40, label: "Olives" };
  VE.save();
  const raw = localStorage.getItem("valleyEstatesV4");
  const parsed = JSON.parse(raw);
  return {
    notes,
    studying: home.research && home.research.id,
    paid: paid.ok,
    missed,
    saveBytes: raw.length,
    orderShape: parsed.order,
    named: G.units.every((unit) => unit.name && unit.skill),
    frames: VE.frames,
  };
});
console.log(JSON.stringify(soak, null, 2));
assert(soak.notes[0].time >= 19, "early game did not advance");
assert(soak.notes[2].wine > 0, "late game bottled nothing");
assert(soak.notes[2].wine >= soak.notes[1].wine, "late presses should not bottle slower than the mid game");
assert(soak.studying === "crush", "research did not start");
assert(soak.paid === true, "wool order failed");
assert(soak.missed === "missed", "expired order stayed open");
assert(soak.named === true, "a farmhand has no name");
const hands = await play.page.evaluate(() => {
  const G = window.VE.G;
  const X = window.VEExpansion;
  G.coach = 4;
  const vines = G.buildings.find((building) => building.type === "vineyard" && building.built);
  if (vines) vines.grapes = 40;
  const vineHand = G.units.find((unit) => unit.skill === "vines") || G.units[0];
  vineHand.task = null;
  vineHand.hold = false;
  vineHand.carry = 0;
  vineHand.priority = "auto";
  const picked = X.pickJob(G, vineHand);
  vineHand.task = picked;
  vineHand.phase = "work";
  const label = X.activityLabel(vineHand);
  G.time = 320;
  G.season = 2;
  G.festivalYear = -1;
  G.showYear = -1;
  G.wineTiers.gold = 1;
  G.wineTiers.silver = 0;
  G.wineTiers.bronze = 0;
  const festival = X.tickFestival(G, 1, 120);
  G.time = 372;
  const show = X.tickFestival(G, 1, 120);
  const season = document.getElementById("seasonL").textContent;
  window.VE.tick(0.01);
  window.VE.updateBar();
  return {
    picked: picked && picked.res,
    label,
    festival: festival.notes.map((note) => note.text),
    show: show.notes[0] && show.notes[0].place,
    coins: show.notes[0] && show.notes[0].coins,
    season: document.getElementById("seasonL").textContent,
    before: season,
    priority: vineHand.priority,
  };
});
console.log("hands", JSON.stringify(hands));
assert(hands.picked === "grapes" || hands.picked === "olives" || hands.picked === "wool" || hands.picked === "food", "idle hand found no job");
assert(hands.label.length > 3, "activity label missing");
assert(hands.festival.some((text) => text.includes("Harvest festival")), "harvest festival did not open");
assert(hands.show === "Gold medal", "wine show place was " + hands.show);
assert(hands.coins === 48, "wine show bonus was " + hands.coins);
assert(hands.season.includes("Wine show"), "season line missed the wine show");
assert(soak.orderShape && soak.orderShape.good === "olives", "save did not keep one order");
assert(soak.saveBytes < 400000, "save grew past 400kb: " + soak.saveBytes);
assert(play.errors.length === 0, "play errors: " + play.errors.join(" | "));

const rate = await play.page.evaluate(() => new Promise((resolve) => {
  const start = performance.now();
  const before = window.VE.frames;
  let spins = 0;
  function step() {
    spins += 1;
    if (spins >= 12) resolve({ frames: window.VE.frames - before, ms: performance.now() - start });
    else requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}));
console.log("fps sample", rate);
assert(rate.frames >= 12 && rate.ms < 6000, "frame rate stalled: " + JSON.stringify(rate));

await play.page.evaluate(() => {
  const G = window.VE.G;
  document.getElementById("modal").style.display = "none";
  G.season = 1;
  G.time = 34.8;
  G.events = {};
  let vines = G.buildings.find((building) => building.type === "vineyard");
  if (!vines) {
    vines = { id: 880, type: "vineyard", x: 42, y: 34, w: 2, h: 2, built: true, prog: 1, queue: [], research: null, grapes: 60, pruned: 0, care: 10 };
    window.VEExpansion.decorateBuilding(vines);
    G.buildings.push(vines);
  }
  vines.built = true;
  vines.grapes = 60;
  window.VE.cam.zoom = 1.45;
  window.VE.centerOn(41, 35);
});
await new Promise((r) => setTimeout(r, 400));
for (let i = 0; i < 14; i++) {
  await play.page.evaluate((step) => {
    window.VE.G.time = 33.2 + step * 0.28;
    window.VE.G.season = 1;
  }, i);
  await new Promise((r) => setTimeout(r, 90));
  await play.page.screenshot({ path: join(frameDir, `frame-${String(i).padStart(2, "0")}.png`) });
}
const gif = spawnSync("ffmpeg", ["-y", "-framerate", "10", "-i", join(frameDir, "frame-%02d.png"), "-vf", "scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse", join(outDir, "expansion-dusk.gif")], { encoding: "utf8" });
if (gif.status !== 0) throw new Error(gif.stderr || "ffmpeg failed");
assert(play.errors.length === 0, "dusk errors: " + play.errors.join(" | "));

const ipad = await openGame(1032, 1376);
const ipadBox = await boxes(ipad.page);
assert(!overlaps(ipadBox.rside, ipadBox.panel), "iPad portrait controls overlap the panel");
assert(!overlaps(ipadBox.bar, ipadBox.sub), "iPad portrait bar overlaps the season line");
assert(!overlaps(ipadBox.sub, ipadBox.goal), "iPad portrait season line overlaps the goal");
await ipad.page.setViewport({ width: 1376, height: 1032, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ipad.page.evaluate(() => window.VE.resize());
await new Promise((r) => setTimeout(r, 300));
const land = await boxes(ipad.page);
assert(land.cls.includes("layout-wide"), "iPad landscape should dock the panel");
assert(!overlaps(land.rside, land.panel), "iPad landscape controls overlap the panel");
await ipad.page.evaluate(() => document.documentElement.classList.add("lefty"));
const landLeft = await boxes(ipad.page);
assert(landLeft.rside.left < 80, "iPad left-handed controls stayed on the right");
assert(!overlaps(landLeft.rside, landLeft.panel), "iPad left-handed controls overlap the panel");
assert(ipad.errors.length === 0, "iPad errors: " + ipad.errors.join(" | "));
await ipad.page.close();

await browser.close();
server.close();
console.log("round 3 play passed");
