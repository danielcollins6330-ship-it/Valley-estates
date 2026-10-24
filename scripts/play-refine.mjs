import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import puppeteer from "puppeteer-core";

const root = process.cwd();
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
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", display ? "--use-angle=gl" : "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--window-size=2200,1800"],
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
  page.on("pageerror", (err) => errors.push(String(err).slice(0, 400)));
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.removeItem("valleyEstatesV4");
      localStorage.setItem("valleyEstatesAudio", JSON.stringify({ music: 0, effects: 0, voice: 0, mute: true }));
    } catch { /* about:blank */ }
  });
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.VE && window.VE.G && window.VE3D && window.VE.frames > 3, { timeout: 120000 });
  return { page, errors };
}

async function layout(page, label) {
  const boxes = await page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const buttons = [...document.querySelectorAll(".rb,.btn")].slice(0, 12).map((el) => ({ id: el.id || el.textContent.slice(0, 18), ...box(el) }));
    return {
      cls: document.documentElement.className,
      vw: innerWidth,
      vh: innerHeight,
      buttons,
      panel: box(document.getElementById("panel")),
      mini: box(document.getElementById("mini")),
      goal: box(document.getElementById("goal")),
      side: box(document.getElementById("side")),
      rside: box(document.getElementById("rside")),
      bar: box(document.getElementById("bar")),
      sub: box(document.getElementById("sub")),
      season: document.getElementById("seasonL").textContent,
    };
  });
  for (const button of boxes.buttons) {
    if (!button.id) continue;
    assert(button.width >= 44 && button.height >= 44, `${label} ${button.id} is ${Math.round(button.width)}x${Math.round(button.height)}`);
  }
  assert(!overlaps(boxes.bar, boxes.goal), `${label} resource bar overlaps the goal`);
  assert(!overlaps(boxes.bar, boxes.sub), `${label} resource bar overlaps the season line`);
  assert(!overlaps(boxes.sub, boxes.goal), `${label} season line overlaps the goal`);
  assert(!overlaps(boxes.rside, boxes.panel), `${label} build buttons overlap the panel`);
  assert(!overlaps(boxes.side, boxes.panel), `${label} pause buttons overlap the panel`);
  assert(!overlaps(boxes.mini, boxes.goal), `${label} minimap overlaps the goal`);
  assert(boxes.season.includes("·"), `${label} season label missing`);
  console.log("layout", label, boxes.cls, boxes.season);
  return boxes;
}

const phone = await openGame(390, 844);
await phone.page.evaluate(() => { document.getElementById("modal").style.display = "none"; });
await layout(phone.page, "iphone-390");
await phone.page.close();

const ipad = await openGame(1032, 1376);
await ipad.page.evaluate(() => { document.getElementById("modal").style.display = "none"; window.VE.act("tc"); });
await layout(ipad.page, "ipad-portrait");
await ipad.page.setViewport({ width: 1376, height: 1032, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ipad.page.evaluate(() => window.VE.resize());
await new Promise((r) => setTimeout(r, 300));
const land = await layout(ipad.page, "ipad-landscape");
assert(land.cls.includes("layout-wide"), "iPad landscape should dock the panel");
await ipad.page.close();

const play = await openGame(1280, 800);
const report = await play.page.evaluate(() => {
  const VE = window.VE;
  const G = VE.G;
  document.getElementById("modal").style.display = "none";
  G.coach = 4;
  G.age = 3;
  G.time = 250;
  G.season = 2;
  G.nextEvt = 5000;
  G.nextChoice = 30;
  Object.assign(G.res, { food: 5000, wood: 5000, stone: 3000, coins: 2500, grapes: 40, wine: 4, wool: 0, olives: 0 });
  G.stats.wine = 4;
  window.VEExpansion.migrateSave(G);
  const home = G.buildings.find((b) => b.type === "homestead");
  function place(type, x, y) {
    for (let rad = 0; rad <= 10; rad += 1) {
      for (let dy = -rad; dy <= rad; dy += 1) {
        for (let dx = -rad; dx <= rad; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          if (!VE.validPlace(type, x + dx, y + dy)) continue;
          VE.setPlacing(type, x + dx, y + dy);
          const built = VE.confirmPlace();
          if (!built) continue;
          built.built = true;
          built.prog = 1;
          return built;
        }
      }
    }
    return null;
  }
  const placed = {
    vineyard: place("vineyard", home.x + 5, home.y - 2),
    winery: place("winery", home.x + 5, home.y + 1),
    market: place("market", home.x - 6, home.y + 4),
    olive: place("olive", home.x + 5, home.y + 5),
    tank: place("tank", home.x - 6, home.y - 4),
    shed: place("shed", home.x - 4, home.y + 6),
    machine: place("machine", home.x + 8, home.y - 4),
    paddock: place("paddock", home.x - 8, home.y + 1),
    yard: place("yard", home.x + 1, home.y - 6),
    cellar: place("cellardoor", home.x - 8, home.y - 2),
  };
  if (placed.vineyard) placed.vineyard.grapes = 70;
  if (placed.paddock) {
    placed.paddock.kind = "sheep";
    placed.paddock.count = 4;
    placed.paddock.health = 80;
    placed.paddock.condition = 70;
    placed.paddock.fleece = 20;
  }
  const before = G.market.wine;
  const samples = [];
  let choices = 0;
  const errors = [];
  for (let minute = 0; minute < 22; minute += 1) {
    for (let step = 0; step < 30; step += 1) {
      try {
        VE.tick(2);
      } catch (error) {
        errors.push(String(error));
        minute = 99;
        break;
      }
    }
    if (G.choice) {
      const event = window.VEExpansion.choiceById(G.choice.id);
      const pick = event.choices.find((choice) => window.VEExpansion.applyChoice({ res: Object.assign({}, G.res), wineTiers: Object.assign({}, G.wineTiers), buildings: G.buildings, events: {}, time: G.time }, event.id, choice.id).ok) || event.choices[event.choices.length - 1];
      window.VEExpansion.applyChoice(G, event.id, pick.id);
      G.choice = null;
      document.getElementById("modal").style.display = "none";
      choices += 1;
    }
    const nums = [G.res.coins, G.res.wine, G.res.wool, G.res.olives, G.res.food, G.market.wine];
    if (nums.some((n) => !Number.isFinite(n))) errors.push("non finite " + nums.join(","));
    samples.push({ minute, coins: G.res.coins | 0, wine: G.res.wine | 0, wool: G.res.wool | 0, olives: G.res.olives | 0, price: G.market.wine, tiers: Object.assign({}, G.wineTiers) });
  }
  window.VE3D.buildWorld(G);
  for (let i = 0; i < 6; i += 1) window.VE3D.render(G, { cam: VE.cam, placing: null, validPlace: VE.validPlace });
  const meshes = [];
  window.VE3D._dbg().scene.traverse((obj) => {
    if (obj.userData && obj.userData.bid && obj.userData.g) {
      const building = G.buildings.find((b) => b.id === obj.userData.bid);
      meshes.push({ type: building && building.type, kids: obj.userData.g.children.length, herd: !!(obj.userData.herd || (building && building.type === "paddock")) });
    }
  });
  const herd = [];
  window.VE3D._dbg().scene.traverse((obj) => {
    if (obj.userData && obj.userData.herd) herd.push(obj.userData.herd.body.count);
  });
  return {
    errors,
    choices,
    moved: G.market.wine !== before || G.market.hist.wine.length > 1,
    placed: Object.fromEntries(Object.entries(placed).map(([key, value]) => [key, !!value])),
    samples,
    meshes,
    herd,
    tiers: G.wineTiers,
    wool: G.res.wool | 0,
    olives: G.res.olives | 0,
  };
});
console.log(JSON.stringify({ placed: report.placed, choices: report.choices, moved: report.moved, errors: report.errors, herd: report.herd, wool: report.wool, olives: report.olives, tiers: report.tiers, first: report.samples[0], last: report.samples[report.samples.length - 1], meshes: report.meshes }, null, 2));
assert(report.errors.length === 0, "play errors " + report.errors.join(" | "));
assert(report.placed.olive && report.placed.tank && report.placed.shed && report.placed.machine && report.placed.market, "a new building did not place");
assert(report.moved, "market prices did not move");
assert(report.choices >= 1, "no choice event in 20 minutes");
assert(report.samples[report.samples.length - 1].minute >= 20, "did not reach 20 minutes");
assert((report.tiers.bronze + report.tiers.silver + report.tiers.gold) === (report.samples.at(-1).wine), "wine tiers drifted from the bottle count");
for (const type of ["olive", "tank", "shed", "machine"]) {
  const mesh = report.meshes.find((item) => item.type === type);
  assert(mesh && mesh.kids >= 2, type + " has no mesh");
}
assert(report.herd.some((count) => count >= 4), "sheep were not instanced");
if (play.errors.length) console.log("pageerrors", play.errors);
assert(play.errors.length === 0, play.errors.join(" | "));

mkdirSync("/tmp/ve-refine", { recursive: true });
await play.page.evaluate(() => {
  const G = window.VE.G;
  const market = G.buildings.find((b) => b.type === "market");
  G.selB = market.id;
  G.sel = [];
  document.getElementById("modal").style.display = "none";
  window.VE.centerOn(market.x + 1.5, market.y + 1.5);
});
await new Promise((r) => setTimeout(r, 400));
await play.page.screenshot({ path: "/tmp/ve-refine/market.png" });

await play.page.evaluate(() => {
  const event = window.VEExpansion.choiceById("hail");
  window.showChoice ? window.showChoice(event) : null;
});
const opened = await play.page.evaluate(() => {
  const event = window.VEExpansion.rollChoice(() => 0.5);
  const modal = document.getElementById("modal");
  const sheet = document.getElementById("sheet");
  sheet.innerHTML = `<h3>${event.title}</h3><p>${event.line}</p>` + event.choices.map((choice) => `<button class="btn" style="width:100%;margin-bottom:8px">${choice.label}</button>`).join("") + `<button class="close">Decide later</button>`;
  modal.style.display = "flex";
  return event.title;
});
console.log("choice shot", opened);
await play.page.screenshot({ path: "/tmp/ve-refine/choice.png" });

await play.page.evaluate(() => {
  document.getElementById("modal").style.display = "none";
  const G = window.VE.G;
  const olive = G.buildings.find((b) => b.type === "olive");
  G.selB = olive.id;
  window.VE.centerOn(olive.x + 4, olive.y + 1);
  window.VE.cam.zoom = 1.15;
  window.VE3D.buildWorld(G);
  for (let i = 0; i < 8; i += 1) window.VE3D.render(G, { cam: window.VE.cam, placing: null, validPlace: window.VE.validPlace });
});
await new Promise((r) => setTimeout(r, 300));
await play.page.screenshot({ path: "/tmp/ve-refine/grove.png" });

await play.page.evaluate(() => {
  const G = window.VE.G;
  const winery = G.buildings.find((b) => b.type === "winery");
  G.selB = winery.id;
  G.res.grapes = 20;
  window.VE.centerOn(winery.x + 1, winery.y + 1);
});
await new Promise((r) => setTimeout(r, 300));
await play.page.screenshot({ path: "/tmp/ve-refine/wine.png" });

for (let frame = 0; frame < 12; frame += 1) {
  await play.page.evaluate((n) => {
    const G = window.VE.G;
    const shed = G.buildings.find((b) => b.type === "machine");
    shed.built = false;
    shed.prog = 0.25 + (n % 6) * 0.1;
    document.getElementById("modal").style.display = "none";
    G.selB = null;
    window.VE.centerOn(shed.x + 1, shed.y + 1);
    window.VE.cam.zoom = 1.35;
    for (let i = 0; i < 2; i += 1) window.VE3D.render(G, { cam: window.VE.cam, placing: null, validPlace: window.VE.validPlace });
  }, frame);
  await play.page.screenshot({ path: `/tmp/ve-refine/frame-${String(frame).padStart(2, "0")}.png` });
}

await play.page.close();
await browser.close();
server.close();
console.log("play refine done");
