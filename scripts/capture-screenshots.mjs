import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".m4a": "audio/mp4",
  ".ico": "image/x-icon",
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
if (address == null || typeof address === "string") {
  throw new Error("server did not bind");
}
const origin = `http://127.0.0.1:${address.port}`;

const display = Boolean(process.env.DISPLAY);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: display ? false : true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    display ? "--use-angle=gl" : "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--window-size=2200,1800",
  ],
});

mkdirSync("store/screenshots", { recursive: true });

const legacy = [
  { name: "android-1080x1920", width: 360, height: 640, scale: 3 },
  { name: "ios-1242x2688", width: 414, height: 896, scale: 3 },
];
const legacyScenes = ["estate", "build", "homestead"];

const storeShots = [
  { dir: "store/screenshots/iphone-6.9", width: 440, height: 956, scale: 3, pixels: [1320, 2868] },
  { dir: "store/screenshots/ipad-13", width: 1032, height: 1376, scale: 2, pixels: [2064, 2752] },
];
const storeScenes = ["homestead", "vineyard", "livestock", "frost", "empire"];

const only = process.env.SHOTS ?? "all";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function pngSize(file) {
  const buf = readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function variance(file) {
  const sample = await sharp(file).resize(48, 48, { fit: "fill" }).removeAlpha().raw().toBuffer();
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < sample.length; i += 3) {
    const y = sample[i] * 0.3 + sample[i + 1] * 0.59 + sample[i + 2] * 0.11;
    sum += y;
    sumSq += y * y;
    n += 1;
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

function overlaps(a, b, pad = 2) {
  return a.right > b.left + pad && a.left < b.right - pad && a.bottom > b.top + pad && a.top < b.bottom - pad;
}

async function openGame() {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", (err) => console.log("pageerror", String(err).slice(0, 300)));
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.removeItem("valleyEstatesV4");
      localStorage.setItem("valleyEstatesAudio", JSON.stringify({ music: 0, effects: 0, voice: 0, mute: true }));
    } catch {
      /* about:blank has no storage */
    }
  });
  return page;
}

async function boot(page, shot) {
  await page.setViewport({
    width: shot.width,
    height: shot.height,
    deviceScaleFactor: shot.scale,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.VE && window.VE.G && window.VE3D && window.VE.frames > 5, { timeout: 120000 });
}

async function chromeAudit(page, label) {
  const boxes = await page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const buttons = [...document.querySelectorAll(".rb")].map((el) => ({ id: el.id, ...box(el) }));
    return {
      cls: document.documentElement.className,
      vw: window.innerWidth,
      vh: window.innerHeight,
      buttons,
      panel: box(document.getElementById("panel")),
      mini: box(document.getElementById("mini")),
      goal: box(document.getElementById("goal")),
      side: box(document.getElementById("side")),
      rside: box(document.getElementById("rside")),
      bar: box(document.getElementById("bar")),
    };
  });
  for (const button of boxes.buttons) {
    assert(button.width >= 44 && button.height >= 44, `${label} ${button.id} is ${button.width}x${button.height}`);
  }
  const view = { left: 0, top: 0, right: boxes.vw, bottom: boxes.vh };
  for (const [name, box] of Object.entries(boxes)) {
    if (!box || typeof box.left !== "number") continue;
    assert(box.left >= -1 && box.top >= -1 && box.right <= boxes.vw + 1 && box.bottom <= boxes.vh + 1, `${label} ${name} leaves the screen ${JSON.stringify(box)}`);
    assert(box.width > 0 && box.height > 0 && box.right > box.left, `${label} ${name} has no size`);
  }
  assert(!overlaps(boxes.rside, boxes.panel), `${label} build buttons overlap the panel`);
  assert(!overlaps(boxes.side, boxes.panel), `${label} pause buttons overlap the panel`);
  assert(!overlaps(boxes.mini, boxes.rside), `${label} minimap overlaps the build buttons`);
  assert(!overlaps(boxes.mini, boxes.goal), `${label} minimap overlaps the goal`);
  assert(!overlaps(boxes.mini, boxes.panel), `${label} minimap overlaps the panel`);
  assert(!overlaps(boxes.bar, boxes.goal), `${label} resource bar overlaps the goal`);
  assert(view.right > 0, label);
  console.log("chrome", label, boxes.cls, `buttons ${boxes.buttons[0].width}px`, `panel ${Math.round(boxes.panel.height)}px`);
  return boxes;
}

async function setupScene(page, name) {
  const report = await page.evaluate((scene) => {
    const VE = window.VE;
    const G = VE.G;
    const modal = document.getElementById("modal");
    if (modal) modal.style.display = "none";
    G.tutorialSeen = true;
    G.coach = 4;
    G.coachTime = 180;
    if (window.VE3D && VE3D.setQuality) VE3D.setQuality("high");
    const home = G.buildings.find((b) => b.type === "homestead");
    const hx = home.x;
    const hy = home.y;
    const tablet = window.innerWidth >= 900;
    const zoomFor = (base) => (tablet ? Math.min(2.2, base * 1.5) : base);

    function give(extra) {
      Object.assign(G.res, extra);
    }
    function place(type, x, y) {
      for (let rad = 0; rad <= 14; rad += 1) {
        for (let dy = -rad; dy <= rad; dy += 1) {
          for (let dx = -rad; dx <= rad; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
            const px = x + dx;
            const py = y + dy;
            if (!VE.validPlace(type, px, py)) continue;
            VE.setPlacing(type, px, py);
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
    function lookAt(tx, ty, zoom) {
      VE.cam.zoom = zoom;
      const panel = document.getElementById("panel").getBoundingClientRect();
      const wide = document.documentElement.classList.contains("layout-wide");
      let sx = tx;
      let sy = ty;
      if (!wide) {
        const cover = Math.max(0, window.innerHeight - panel.top);
        const viewTiles = window.innerHeight / (32 * zoom);
        sy = ty + (cover / window.innerHeight) * viewTiles * 0.45;
      } else {
        const cover = panel.width;
        const viewTiles = window.innerWidth / (32 * zoom);
        sx = tx + (cover / window.innerWidth) * viewTiles * 0.45;
      }
      VE.centerOn(sx, sy);
    }
    function select(building) {
      G.sel = [];
      G.selB = building ? building.id : null;
    }
    function addHands(n, x, y) {
      let next = 800;
      for (let i = 0; i < n; i += 1) {
        G.units.push({
          id: next,
          x: x + (i % 4) * 0.8,
          y: y + Math.floor(i / 4) * 0.8,
          path: null,
          task: null,
          phase: null,
          carry: 0,
          ct: null,
          wt: 0,
          dir: 1,
          anim: i,
        });
        next += 1;
      }
    }

    give({ food: 4000, wood: 4000, stone: 2000, coins: 2000, grapes: 40, wine: 40, wool: 0 });
    const placed = [];
    let focus = { x: hx + 1.5, y: hy + 1.5 };
    let zoom = zoomFor(1.35);

    if (scene === "homestead") {
      G.age = 0;
      G.time = 16;
      G.season = 0;
      G.mission = 0;
      G.res = { food: 200, wood: 200, stone: 60, coins: 0, grapes: 0, wine: 0, wool: 0 };
      select(home);
      zoom = zoomFor(1.4);
    } else if (scene === "vineyard") {
      G.age = 1;
      G.time = 256;
      G.season = 2;
      G.mission = 11;
      G.stats.wine = 3;
      const vine = place("vineyard", hx + 4, hy - 1);
      const winery = place("winery", hx + 4, hy + 3);
      if (vine) vine.grapes = 72;
      G.res.grapes = 28;
      G.res.wine = 4;
      select(winery || vine || home);
      const pts = [vine, winery].filter(Boolean);
      focus = {
        x: pts.reduce((s, b) => s + b.x + b.w / 2, 0) / pts.length,
        y: pts.reduce((s, b) => s + b.y + b.h / 2, 0) / pts.length,
      };
      zoom = zoomFor(1.05);
      placed.push(vine && "vineyard", winery && "winery");
    } else if (scene === "livestock") {
      G.age = 1;
      G.time = 28;
      G.season = 0;
      G.mission = 12;
      const cattle = place("paddock", hx - 6, hy - 1);
      const sheep = place("paddock", hx + 4, hy + 3);
      if (cattle) {
        cattle.kind = "cattle";
        cattle.count = 5;
        cattle.stock = 36;
        cattle.health = 84;
        cattle.condition = 71;
      }
      if (sheep) {
        sheep.kind = "sheep";
        sheep.count = 6;
        sheep.stock = 24;
        sheep.health = 90;
        sheep.condition = 77;
        sheep.fleece = 64;
      }
      select(cattle || sheep || home);
      const pts = [cattle, sheep].filter(Boolean);
      focus = {
        x: pts.reduce((s, b) => s + b.x + b.w / 2, 0) / pts.length,
        y: pts.reduce((s, b) => s + b.y + b.h / 2, 0) / pts.length,
      };
      zoom = zoomFor(0.95);
      placed.push(cattle && "cattle", sheep && "sheep");
    } else if (scene === "frost") {
      G.age = 1;
      G.time = 434;
      G.season = 3;
      G.mission = 11;
      G.stats.wine = 3;
      G.nextEvt = 0.01;
      const vine = place("vineyard", hx + 4, hy);
      const field = place("field", hx - 4, hy + 1);
      if (vine) vine.grapes = 60;
      if (field) field.food = 110;
      const random = Math.random;
      Math.random = () => 0.2;
      try {
        VE.tick(0.05);
      } finally {
        Math.random = random;
      }
      select(vine || field || home);
      focus = vine ? { x: vine.x + 1, y: vine.y + 1 } : focus;
      zoom = zoomFor(1.08);
      placed.push(vine && "vineyard", field && "field", G.events.frost ? "frost" : "no-frost");
    } else if (scene === "empire") {
      G.age = 3;
      G.time = 1216;
      G.season = 2;
      G.mission = 15;
      G.stats.wine = 42;
      G.stats.coins = 860;
      G.res.wine = 18;
      G.res.coins = 860;
      G.res.wool = 40;
      const specs = [
        ["house", hx - 4, hy - 4],
        ["house", hx + 4, hy - 4],
        ["barn", hx - 4, hy + 3],
        ["field", hx + 4, hy + 1],
        ["field", hx - 6, hy + 1],
        ["vineyard", hx + 6, hy + 4],
        ["winery", hx + 4, hy + 6],
        ["paddock", hx - 6, hy - 6],
        ["paddock", hx + 6, hy - 2],
        ["market", hx - 2, hy + 6],
        ["cellardoor", hx - 8, hy + 5],
        ["valleyvilla", hx + 9, hy + 8],
        ["yard", hx + 1, hy - 7],
      ];
      const buildings = [];
      for (const [type, x, y] of specs) {
        const built = place(type, x, y);
        if (built) buildings.push(built);
      }
      const cattle = buildings.find((b) => b.type === "paddock");
      const sheep = buildings.filter((b) => b.type === "paddock")[1];
      if (cattle) {
        cattle.kind = "cattle";
        cattle.count = 4;
        cattle.stock = 50;
      }
      if (sheep) {
        sheep.kind = "sheep";
        sheep.count = 5;
        sheep.stock = 30;
      }
      const vines = buildings.filter((b) => b.type === "vineyard");
      for (const vine of vines) vine.grapes = 70;
      addHands(6, hx + 1.2, hy + 3.6);
      const market = buildings.find((b) => b.type === "market");
      select(market || home);
      focus = {
        x: (hx + buildings.reduce((s, b) => s + b.x + b.w / 2, hx + 1.5)) / (buildings.length + 1),
        y: (hy + buildings.reduce((s, b) => s + b.y + b.h / 2, hy + 1.5)) / (buildings.length + 1),
      };
      zoom = zoomFor(0.62);
      placed.push(...buildings.map((b) => b.type));
    } else if (scene === "tourism") {
      G.age = 3;
      G.time = 250;
      G.season = 2;
      G.mission = 14;
      G.nextEvt = 80;
      G.stats.wine = 12;
      G.res.wine = 24;
      G.res.coins = 800;
      const vine = place("vineyard", hx + 5, hy - 2);
      const winery = place("winery", hx + 5, hy + 1);
      const cellar = place("cellardoor", hx - 6, hy + 1);
      const villaB = place("valleyvilla", hx - 7, hy - 6);
      if (vine) vine.grapes = 74;
      if (cellar) {
        cellar.visitT = 40;
        cellar.guests = 2;
      }
      if (villaB) {
        villaB.guests = 3;
        villaB.stayT = 8;
      }
      VE.tick(0.2);
      select(cellar || villaB || home);
      const pts = [cellar, villaB, winery].filter(Boolean);
      focus = {
        x: pts.reduce((s, b) => s + b.x + b.w / 2, 0) / pts.length,
        y: pts.reduce((s, b) => s + b.y + b.h / 2, 0) / pts.length,
      };
      zoom = zoomFor(0.72);
      placed.push(vine && "vineyard", winery && "winery", cellar && "cellardoor", villaB && "valleyvilla", (G.stats.tastings || 0) > 0 ? "tasting" : "no-tasting");
    } else if (scene === "stockyard") {
      G.age = 1;
      G.time = 30;
      G.season = 0;
      G.mission = 12;
      G.nextEvt = 80;
      const cattle = place("paddock", hx - 6, hy - 1);
      const sheep = place("paddock", hx + 5, hy + 2);
      const yard = place("yard", hx - 1, hy + 5);
      if (cattle) {
        cattle.kind = "cattle";
        cattle.count = 4;
        cattle.health = 38;
        cattle.condition = 34;
        cattle.stock = 44;
        cattle.vetWarned = 0;
      }
      if (sheep) {
        sheep.kind = "sheep";
        sheep.count = 5;
        sheep.health = 88;
        sheep.condition = 76;
        sheep.fleece = 86;
      }
      G.res.wool = 4;
      G.res.coins = 80;
      select(sheep || yard || home);
      const pts = [cattle, sheep, yard].filter(Boolean);
      focus = {
        x: pts.reduce((s, b) => s + b.x + b.w / 2, 0) / pts.length,
        y: pts.reduce((s, b) => s + b.y + b.h / 2, 0) / pts.length,
      };
      zoom = zoomFor(0.78);
      placed.push(cattle && "cattle", sheep && "sheep", yard && "yard");
    } else if (scene === "season") {
      G.age = 1;
      G.time = 372;
      G.season = 3;
      G.mission = 8;
      G.nextEvt = 80;
      const vine = place("vineyard", hx + 4, hy);
      const field = place("field", hx - 5, hy + 1);
      if (vine) {
        vine.grapes = 12;
        vine.pruned = 1;
      }
      if (field) field.food = 40;
      select(vine || home);
      focus = vine ? { x: vine.x + 1, y: vine.y + 1 } : focus;
      zoom = zoomFor(1.05);
      placed.push(vine && "vineyard", field && "field", document.getElementById("seasonL").textContent);
    } else {
      throw new Error("unknown scene " + scene);
    }

    window.VE3D.buildWorld(G);
    lookAt(focus.x, focus.y, zoom);
    const box = document.getElementById("toasts");
    if (box) {
      for (const el of [...box.children]) {
        if (scene === "frost" && el.textContent.includes("Frost")) {
          el.style.animationDuration = "12s";
          continue;
        }
        el.remove();
      }
    }
    return {
      scene,
      age: G.age,
      season: G.season,
      mission: G.mission,
      frost: Boolean(G.events.frost),
      buildings: G.buildings.map((b) => b.type + (b.kind ? ":" + b.kind + "x" + b.count : "")),
      placed: placed.filter(Boolean),
      toasts: box ? [...box.querySelectorAll(".toast")].map((t) => t.textContent) : [],
      units: G.units.length,
      zoom: VE.cam.zoom,
    };
  }, name);
  console.log("scene", JSON.stringify(report));
  if (name === "vineyard") assert(report.placed.includes("vineyard") && report.placed.includes("winery"), "vineyard scene missing buildings");
  if (name === "livestock") assert(report.placed.includes("cattle") && report.placed.includes("sheep"), "livestock scene missing stock");
  if (name === "frost") {
    assert(report.frost, "frost event did not start");
    assert(report.toasts.some((t) => t.includes("Frost")), "frost toast missing");
  }
  if (name === "empire") {
    assert(report.age === 3, "empire is not Valley Empire age");
    assert(report.buildings.filter((b) => b !== "homestead").length >= 6, "empire is too small");
    assert(report.placed.includes("cellardoor") && report.placed.includes("valleyvilla"), "empire is missing the cellar door or Valley Villa");
  }
  return report;
}

try {
  if (only === "all" || only === "legacy") {
    for (const shot of legacy) {
      const page = await openGame();
      await boot(page, shot);
      await page.evaluate(() => {
        const modal = document.getElementById("modal");
        if (modal) modal.style.display = "none";
      });
      await new Promise((resolve) => setTimeout(resolve, 1800));
      for (const scene of legacyScenes) {
        if (scene === "build") {
          await page.evaluate(() => window.VE.act("build"));
        } else if (scene === "homestead") {
          await page.evaluate(() => {
            const modal = document.getElementById("modal");
            if (modal) modal.style.display = "none";
            window.VE.act("tc");
          });
        }
        await new Promise((resolve) => setTimeout(resolve, scene === "estate" ? 400 : 700));
        const file = `store/screenshots/${shot.name}-${scene}.png`;
        await page.screenshot({ path: file, type: "png" });
        const info = statSync(file);
        console.log(`${file} ${info.size} bytes`);
      }
      await page.close();
    }
  }

  if (only === "all" || only === "store") {
    const auditPage = await openGame();
    await boot(auditPage, storeShots[1]);
    await auditPage.evaluate(() => {
      const modal = document.getElementById("modal");
      if (modal) modal.style.display = "none";
      window.VE.act("tc");
    });
    const portrait = await chromeAudit(auditPage, "ipad-portrait");
    assert(!portrait.cls.includes("layout-wide"), "iPad portrait should keep the bottom panel");
    await auditPage.setViewport({ width: 1376, height: 1032, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await auditPage.evaluate(() => window.VE.resize());
    await new Promise((resolve) => setTimeout(resolve, 400));
    const landscape = await chromeAudit(auditPage, "ipad-landscape");
    assert(landscape.cls.includes("layout-wide"), "iPad landscape should dock the panel on the side");
    await auditPage.screenshot({ path: "/tmp/ipad-landscape.png", type: "png" });
    await auditPage.close();

    for (const shot of storeShots) {
      mkdirSync(shot.dir, { recursive: true });
      for (const scene of storeScenes) {
        const page = await openGame();
        await boot(page, shot);
        await setupScene(page, scene);
        const pumps = scene === "frost" ? 100 : scene === "livestock" || scene === "empire" ? 30 : 8;
        await page.evaluate((n) => {
          const game = window.VE.G;
          for (let i = 0; i < n; i += 1) {
            window.VE3D.render(game, { cam: window.VE.cam, placing: null, validPlace: window.VE.validPlace });
          }
        }, pumps);
        const wait = scene === "frost" ? 900 : 500;
        await new Promise((resolve) => setTimeout(resolve, wait));
        const file = `${shot.dir}/${scene}.png`;
        await page.screenshot({ path: file, type: "png" });
        const size = pngSize(file);
        const spread = await variance(file);
        assert(size.w === shot.pixels[0] && size.h === shot.pixels[1], `${file} is ${size.w}x${size.h}`);
        assert(spread > 12, `${file} looks blank (variance ${spread.toFixed(1)})`);
        console.log(`${file} ${size.w}x${size.h} var ${spread.toFixed(1)} ${statSync(file).size} bytes`);
        await page.close();
      }
    }
  }

  if (only === "expansion") {
    const page = await openGame();
    await boot(page, { width: 1280, height: 800, scale: 1 });
    const smoke = await page.evaluate(() => {
      const VE = window.VE;
      const G = VE.G;
      const modal = document.getElementById("modal");
      if (modal) modal.style.display = "none";
      const legacy = {
        tutorialSeen: true,
        season: 1,
        res: { food: 9, wood: 4 },
        stats: { wine: 1 },
        buildings: [{ type: "paddock", built: true, kind: "sheep", count: 2 }],
      };
      window.VEExpansion.migrateSave(legacy);
      const home = G.buildings.find((b) => b.type === "homestead");
      function place(type, x, y) {
        for (let rad = 0; rad <= 12; rad += 1) {
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
      G.age = 3;
      G.time = 250;
      G.season = 2;
      G.nextEvt = 400;
      G.coach = 4;
      G.res.food = 400;
      G.res.wood = 4000;
      G.res.stone = 2000;
      G.res.coins = 2000;
      G.res.wine = 40;
      if (G.wineTiers) G.wineTiers.bronze = 40;
      G.res.wool = 0;
      G.stats.wine = 4;
      G.achievements = {};
      const cellar = place("cellardoor", home.x - 6, home.y + 1);
      const villa = place("valleyvilla", home.x - 7, home.y - 6);
      const yard = place("yard", home.x + 2, home.y + 6);
      const cattle = place("paddock", home.x - 6, home.y - 1);
      const sheep = place("paddock", home.x + 5, home.y + 2);
      const vine = place("vineyard", home.x + 5, home.y - 2);
      if (cellar) cellar.visitT = 40;
      if (villa) {
        villa.guests = 0;
        villa.stayT = 23;
      }
      const coins = G.res.coins;
      const wine = G.res.wine;
      VE.tick(0.3);
      if (cattle) {
        cattle.kind = "cattle";
        cattle.count = 2;
        cattle.health = 80;
        cattle.condition = 70;
        cattle.breedT = 54;
      }
      const food = G.res.food;
      VE.tick(2);
      if (sheep) {
        sheep.kind = "sheep";
        sheep.count = 4;
        sheep.health = 30;
        sheep.condition = 40;
        sheep.fleece = 80;
        G.selB = sheep.id;
      }
      const wool = G.res.wool;
      VE.act("shear");
      const sellCount = sheep ? sheep.count : 0;
      VE.act("sellstock");
      const soldCount = sheep ? sheep.count : 0;
      const soldStock = G.stats.soldStock || 0;
      VE.act("vet");
      G.time = 372;
      G.season = 3;
      if (vine) vine.pruned = 0;
      G.selB = vine ? vine.id : G.selB;
      VE.act("prune");
      G.coach = 0;
      G.sel = [1];
      G.stats.wood = 0;
      const coach = window.VEExpansion.coachAdvance(G, 10);
      window.VE3D.buildWorld(G);
      for (let i = 0; i < 4; i += 1) window.VE3D.render(G, { cam: VE.cam, placing: null, validPlace: VE.validPlace });
      const meshes = [];
      window.VE3D._dbg().scene.traverse((obj) => {
        if (obj.userData && obj.userData.bid && obj.userData.g) {
          const building = G.buildings.find((b) => b.id === obj.userData.bid);
          meshes.push({ type: building ? building.type : "?", kids: obj.userData.g.children.length });
        }
      });
      const price = window.VEExpansion.boostedWinePrice(VE.marketPrice(35), true);
      return {
        legacyCoach: legacy.coach,
        legacyHealth: legacy.buildings[0].health,
        cellar: !!cellar,
        villa: !!villa,
        yard: !!yard,
        tasting: (G.stats.tastings || 0) > 0 && G.res.wine < wine && G.res.coins > coins,
        guests: villa ? villa.guests : 0,
        calf: cattle ? cattle.count : 0,
        food: G.res.food < food,
        wool: G.res.wool > wool,
        sold: soldStock >= 1 && soldCount === sellCount - 1,
        health: sheep ? sheep.health : 0,
        pruned: vine ? vine.pruned : 0,
        vintage: G.achievements.vintage,
        villaGoal: G.achievements.valleyvilla,
        coach,
        price,
        meshes,
      };
    });
    console.log("smoke", JSON.stringify(smoke));
    assert(smoke.legacyCoach === 4 && smoke.legacyHealth === 86, "old save did not migrate");
    assert(smoke.cellar && smoke.villa && smoke.yard, "could not place the new buildings");
    assert(smoke.tasting, "cellar door tasting did not pay");
    assert(smoke.guests >= 1, "villa did not take a guest");
    assert(smoke.calf === 3 && smoke.food, "cattle did not breed");
    assert(smoke.wool, "shear did not make wool");
    assert(smoke.sold, "sale yard did not sell stock");
    assert(smoke.health >= 60, "vet did not treat the sheep");
    assert(smoke.pruned === 1, "winter prune did not take");
    assert(smoke.vintage === 1 && smoke.villaGoal === 1, "achievements were not saved on the estate");
    assert(smoke.coach === 1, "tutorial did not advance");
    assert(smoke.price > 35, "villa did not raise the wine price");
    for (const type of ["cellardoor", "valleyvilla", "yard"]) {
      const mesh = smoke.meshes.find((item) => item.type === type);
      assert(mesh && mesh.kids >= 3, type + " mesh is missing");
    }
    await page.close();

    mkdirSync("/tmp/ve-shots", { recursive: true });
    const shot = { width: 1280, height: 800, scale: 1 };
    for (const scene of ["tourism", "stockyard", "season"]) {
      const view = await openGame();
      await boot(view, shot);
      const report = await setupScene(view, scene);
      console.log("feature", JSON.stringify(report));
      if (scene === "tourism") assert(report.placed.includes("tasting") && report.placed.includes("valleyvilla"), "tourism scene incomplete");
      if (scene === "stockyard") assert(report.placed.includes("yard") && report.placed.includes("sheep"), "stockyard scene incomplete");
      await view.evaluate((n) => {
        const game = window.VE.G;
        for (let i = 0; i < n; i += 1) {
          window.VE3D.render(game, { cam: window.VE.cam, placing: null, validPlace: window.VE.validPlace });
        }
      }, scene === "season" ? 24 : 36);
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (scene === "season") {
        const label = await view.$eval("#seasonL", (el) => el.textContent || "");
        const cls = await view.$eval("#sub", (el) => el.className);
        assert(label.includes("Winter") && label.includes("Pruning"), "season label is " + label);
        assert(cls.includes("s3"), "winter pill missing");
      }
      if (scene === "stockyard") {
        const panel = await view.$eval("#panel", (el) => el.textContent || "");
        assert(panel.includes("health") && panel.includes("fleece"), "livestock panel is " + panel);
      }
      const file = `/tmp/ve-shots/${scene}.png`;
      await view.screenshot({ path: file, type: "png" });
      const size = pngSize(file);
      const spread = await variance(file);
      assert(size.w === 1280 && size.h === 800, `${file} is ${size.w}x${size.h}`);
      assert(spread > 12, `${file} looks blank`);
      console.log(`${file} var ${spread.toFixed(1)}`);
      await view.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
