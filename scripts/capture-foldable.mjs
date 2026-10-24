import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
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
    "--window-size=2400,2400",
  ],
});

const outDir = "store/foldable";
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "cover-904x2316", width: 904, height: 2316, cls: "layout-tall" },
  { name: "inner-1812x2176", width: 1812, height: 2176, cls: "layout-square" },
  { name: "landscape-2208x1840", width: 2208, height: 1840, cls: "layout-wide" },
  { name: "window-1280x800", width: 1280, height: 800, cls: "layout-wide" },
];

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function regionVariance(file, fx, fy) {
  const meta = await sharp(file).metadata();
  const left = Math.max(0, Math.min(meta.width - 64, Math.floor(meta.width * fx)));
  const top = Math.max(0, Math.min(meta.height - 64, Math.floor(meta.height * fy)));
  const sample = await sharp(file).extract({ left, top, width: 64, height: 64 }).raw().toBuffer();
  const channels = meta.channels ?? 3;
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < sample.length; i += channels) {
    const y = sample[i] * 0.3 + sample[i + 1] * 0.59 + sample[i + 2] * 0.11;
    sum += y;
    sumSq += y * y;
    n += 1;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

async function mapVariance(file) {
  const samples = await Promise.all([
    regionVariance(file, 0.42, 0.42),
    regionVariance(file, 0.5, 0.48),
    regionVariance(file, 0.58, 0.55),
    regionVariance(file, 0.35, 0.5),
  ]);
  return Math.max(...samples);
}

async function settle(page) {
  const start = await page.evaluate(() => VE.frames);
  await page.waitForFunction((n) => window.VE.frames > n + 1, { timeout: 60000 }, start);
}

const report = [];

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: viewports[0].width, height: viewports[0].height, deviceScaleFactor: 1 });
  await page.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.VE && window.VE.G && window.VE3D, { timeout: 120000 });
  await page.evaluate(() => {
    const modal = document.getElementById("modal");
    if (modal) modal.style.display = "none";
  });
  await settle(page);

  const css = await page.evaluate(() => document.querySelector("style").textContent);
  assert(css.includes("horizontal-viewport-segments"), "missing horizontal viewport-segment media query");
  assert(css.includes("vertical-viewport-segments"), "missing vertical viewport-segment media query");
  assert(css.includes("viewport-segment-width 0 0"), "missing env(viewport-segment-width)");
  assert(css.includes("viewport-segment-top 0 1"), "missing bottom-segment env()");

  const marked = await page.evaluate(() => {
    VE.G.res.coins = 4242;
    VE.save();
    return { seed: VE.G.seed, coins: VE.G.res.coins, units: VE.G.units.length };
  });

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await page.evaluate(() => VE.resize());
    await settle(page);
    const metrics = await page.evaluate(() => VE.metrics());
    const targets = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll(".rb, #panel .btn")];
      return nodes.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
    });
    const home = await page.evaluate(() => {
      const b = VE.G.buildings.find((x) => x.type === "homestead");
      const s = VE.w2s(b.x + b.w / 2, b.y + b.h / 2, 0.4);
      return { x: s[0], y: s[1] };
    });
    assert(
      home.x > vp.width * 0.3 && home.x < vp.width * 0.7 && home.y > vp.height * 0.2 && home.y < vp.height * 0.85,
      `${vp.name} homestead left the view at ${home.x.toFixed(0)},${home.y.toFixed(0)}`,
    );
    const shot = join(outDir, `${vp.name}.png`);
    await page.screenshot({ path: shot });
    const variance = Math.max(await mapVariance(shot), await regionVariance(shot, home.x / vp.width, home.y / vp.height));
    const aspect = metrics.bufW / metrics.bufH;
    const viewAspect = metrics.W / metrics.H;
    assert(metrics.W === vp.width && metrics.H === vp.height, `${vp.name} viewport ${metrics.W}x${metrics.H}`);
    assert(metrics.cls.includes(vp.cls), `${vp.name} class ${metrics.cls} expected ${vp.cls}`);
    assert(Math.abs(aspect - viewAspect) < 0.02, `${vp.name} stretched buffer ${metrics.bufW}x${metrics.bufH} vs ${metrics.W}x${metrics.H}`);
    assert(Math.abs(metrics.clientW - metrics.W) <= 2 && Math.abs(metrics.clientH - metrics.H) <= 2, `${vp.name} canvas css size`);
    assert(metrics.pr <= 3 && metrics.pr >= 1 && metrics.DPR <= 3 && metrics.DPR >= 1, `${vp.name} dpr ${metrics.pr} hud ${metrics.DPR}`);
    assert(metrics.bufW <= 3200 && metrics.bufH <= 3200 && metrics.bufW > 0 && metrics.bufH > 0, `${vp.name} buffer ${metrics.bufW}x${metrics.bufH}`);
    assert(metrics.seed === marked.seed && metrics.coins === 4242, `${vp.name} lost state seed ${metrics.seed} coins ${metrics.coins}`);
    assert(variance > 8, `${vp.name} canvas looks blank (variance ${variance.toFixed(1)})`);
    assert(targets.length > 0 && targets.every((t) => t.w >= 44 && t.h >= 44), `${vp.name} touch target ${JSON.stringify(targets)}`);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("valleyEstatesV4")));
    assert(saved.seed === marked.seed && saved.res.coins === 4242, `${vp.name} save not written`);
    report.push({ name: vp.name, metrics, variance: Number(variance.toFixed(1)), targets: targets.length });
    console.log("ok", vp.name, metrics.cls, `${metrics.bufW}x${metrics.bufH}`, "var", variance.toFixed(1));
  }

  await page.setViewport({ width: 1812, height: 2176, deviceScaleFactor: 1 });
  const gap = 48;
  const segW = Math.floor((1812 - gap) / 2);
  const segments = [
    { x: 0, y: 0, width: segW, height: 2176 },
    { x: segW + gap, y: 0, width: 1812 - segW - gap, height: 2176 },
  ];
  await page.evaluate((rects) => VE.setViewportSegments(rects), segments);
  await settle(page);
  const dual = await page.evaluate(() => {
    const m = VE.metrics();
    const buttons = [...document.querySelectorAll("#bar, #sub, #goal, #panel, #side, #rside, #mini, #modal")].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.id, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
    });
    return { m, buttons };
  });
  const hingeLeft = segW;
  const hingeRight = segW + gap;
  for (const box of dual.buttons) {
    const overlapsHinge = box.right > hingeLeft + 1 && box.left < hingeRight - 1;
    assert(!overlapsHinge, `${box.id} sits on the hinge ${JSON.stringify(box)}`);
    assert(box.left >= -1 && box.right <= segW + 2, `${box.id} left the left segment ${JSON.stringify(box)}`);
  }
  assert(dual.m.cls.includes("seg-h"), `segment class ${dual.m.cls}`);
  assert(dual.m.cls.includes("layout-tall"), `segment should use the tall cover layout, got ${dual.m.cls}`);
  assert(dual.m.seed === marked.seed && dual.m.coins === 4242, "state lost when spanning");
  assert(dual.m.clientW === 1812 && dual.m.clientH === 2176, "canvas stopped spanning both segments");
  const dualShot = join(outDir, "dual-segment-1812x2176.png");
  await page.screenshot({ path: dualShot });
  const dualVar = await mapVariance(dualShot);
  assert(dualVar > 8, `dual segment canvas looks blank (${dualVar.toFixed(1)})`);
  report.push({ name: "dual-segment", hinge: [hingeLeft, hingeRight], cls: dual.m.cls, buttons: dual.buttons, variance: Number(dualVar.toFixed(1)) });
  console.log("ok dual-segment", dual.m.cls, "var", dualVar.toFixed(1));

  await page.setViewport({ width: 1812, height: 2176, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    VE3D.setQuality("high");
    VE.resize();
  });
  const capped = await page.evaluate(() => VE.metrics());
  assert(capped.pr <= 2 && capped.pr > 1.3, `expected native-scale long-edge cap, got ${capped.pr}`);
  assert(capped.bufW <= 3200 && capped.bufH <= 3200, `buffer exceeded cap ${capped.bufW}x${capped.bufH}`);
  assert(Math.max(capped.bufW, capped.bufH) > 2560, `high quality still used the old soft buffer ${capped.bufW}x${capped.bufH}`);
  assert(Math.abs(capped.bufW / capped.bufH - capped.W / capped.H) < 0.02, "capped buffer aspect drifted");
  assert(capped.seed === marked.seed && capped.coins === 4242, "state lost during dpr resize");
  report.push({ name: "dpr-cap", pr: capped.pr, buf: [capped.bufW, capped.bufH], css: [capped.W, capped.H] });
  console.log("ok dpr-cap", capped.pr, capped.bufW, capped.bufH);

  const reloaded = await browser.newPage();
  await reloaded.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await reloaded.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 120000 });
  await reloaded.waitForFunction(() => window.VE && window.VE.G && window.VE.G.res, { timeout: 120000 });
  const restored = await reloaded.evaluate(() => ({ seed: VE.G.seed, coins: VE.G.res.coins, units: VE.G.units.length }));
  assert(restored.seed === marked.seed && restored.coins === 4242, `reload lost save ${JSON.stringify(restored)}`);
  assert(restored.units === marked.units, `reload unit count ${restored.units} vs ${marked.units}`);
  report.push({ name: "reload", restored });
  console.log("ok reload", restored);
  await reloaded.close();

  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log("foldable checks passed");
} finally {
  await browser.close();
  server.close();
}
