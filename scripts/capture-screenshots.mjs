import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
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
  ],
});

mkdirSync("store/screenshots", { recursive: true });

const shots = [
  { name: "android-1080x1920", width: 360, height: 640, scale: 3 },
  { name: "ios-1242x2688", width: 414, height: 896, scale: 3 },
];

const scenes = ["estate", "build", "homestead"];

try {
  for (const shot of shots) {
    const page = await browser.newPage();
    await page.setViewport({
      width: shot.width,
      height: shot.height,
      deviceScaleFactor: shot.scale,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(`${origin}/index.html`, { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => window.VE && window.VE.G && window.VE3D, { timeout: 120000 });
    await page.evaluate(() => {
      const modal = document.getElementById("modal");
      if (modal) modal.style.display = "none";
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));

    for (const scene of scenes) {
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
} finally {
  await browser.close();
  server.close();
}
