import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const label = process.argv[2] || "shot";
const outDir = process.argv[3] || "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".m4a": "audio/mp4",
  ".glb": "model/gltf-binary",
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
const origin = `http://127.0.0.1:${address.port}`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1600,2200"],
});

const views = [
  { name: "iphone", width: 390, height: 844, dpr: 3 },
  { name: "ipad", width: 1024, height: 1366, dpr: 2 },
];

const report = [];
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  for (const view of views) {
    await page.setViewport({ width: view.width, height: view.height, deviceScaleFactor: view.dpr });
    await page.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => window.VE && window.VE.G && window.VE3D, { timeout: 120000 });
    await page.evaluate(() => {
      const modal = document.getElementById("modal");
      if (modal) modal.style.display = "none";
      if (window.VEEntry && VEEntry.isOpen()) VEEntry.close();
      VE3D.setQuality("high");
      VE.resize();
      const home = VE.G.buildings.find((b) => b.type === "homestead");
      VE.centerOn(home.x + 1.2, home.y + 0.4);
    });
    const start = await page.evaluate(() => VE.frames);
    await page.waitForFunction((n) => window.VE.frames > n + 4, { timeout: 60000 }, start);
    const metrics = await page.evaluate(() => VE.metrics());
    const canvas = await page.$("#cv");
    const file = join(outDir, `sharpness-${label}-${view.name}.png`);
    await canvas.screenshot({ path: file });
    report.push({ view: view.name, css: [view.width, view.height], devicePixelRatio: view.dpr, pr: metrics.pr, DPR: metrics.DPR, buf: [metrics.bufW, metrics.bufH], file });
    console.log(label, view.name, "pr", metrics.pr, "buf", metrics.bufW, metrics.bufH);
  }
} finally {
  await browser.close();
  server.close();
}

writeFileSync(join(outDir, `sharpness-${label}.json`), JSON.stringify(report, null, 2));
console.log("wrote", label, report.length);
