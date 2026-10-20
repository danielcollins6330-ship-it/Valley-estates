import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const sourcePath = "resources/brand/logo-source.jpg";
const safeScale = 66 / 108;

const androidLauncher = [
  ["ldpi", 36],
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];

const androidAdaptive = [
  ["ldpi", 81],
  ["mdpi", 108],
  ["hdpi", 162],
  ["xhdpi", 216],
  ["xxhdpi", 324],
  ["xxxhdpi", 432],
];

const androidSplash = [
  ["drawable", 320, 480],
  ["drawable-land-ldpi", 320, 240],
  ["drawable-land-mdpi", 480, 320],
  ["drawable-land-hdpi", 800, 480],
  ["drawable-land-xhdpi", 1280, 720],
  ["drawable-land-xxhdpi", 1600, 960],
  ["drawable-land-xxxhdpi", 1920, 1280],
  ["drawable-port-ldpi", 240, 320],
  ["drawable-port-mdpi", 320, 480],
  ["drawable-port-hdpi", 480, 800],
  ["drawable-port-xhdpi", 720, 1280],
  ["drawable-port-xxhdpi", 960, 1600],
  ["drawable-port-xxxhdpi", 1280, 1920],
];

const iosIcons = [
  ["iphone", "20x20", "2x", 40],
  ["iphone", "20x20", "3x", 60],
  ["iphone", "29x29", "2x", 58],
  ["iphone", "29x29", "3x", 87],
  ["iphone", "40x40", "2x", 80],
  ["iphone", "40x40", "3x", 120],
  ["iphone", "60x60", "2x", 120],
  ["iphone", "60x60", "3x", 180],
  ["ipad", "20x20", "1x", 20],
  ["ipad", "20x20", "2x", 40],
  ["ipad", "29x29", "1x", 29],
  ["ipad", "29x29", "2x", 58],
  ["ipad", "40x40", "1x", 40],
  ["ipad", "40x40", "2x", 80],
  ["ipad", "76x76", "1x", 76],
  ["ipad", "76x76", "2x", 152],
  ["ipad", "83.5x83.5", "2x", 167],
  ["ios-marketing", "1024x1024", "1x", 1024],
];

function ensureDir(file) {
  mkdirSync(dirname(file), { recursive: true });
}

async function writePng(pipeline, file, { opaque = false } = {}) {
  ensureDir(file);
  let image = pipeline;
  if (opaque) {
    image = image.flatten({ background: "#1d140b" }).removeAlpha();
  }
  await image.png({ compressionLevel: 9 }).toFile(file);
}

async function squareLogo(size) {
  const source = readFileSync(sourcePath);
  const meta = await sharp(source).metadata();
  const side = Math.min(meta.width ?? 0, meta.height ?? 0);
  const left = Math.floor(((meta.width ?? side) - side) / 2);
  const top = Math.floor(((meta.height ?? side) - side) / 2);
  return sharp(source)
    .extract({ left, top, width: side, height: side })
    .resize(size, size, { fit: "fill", kernel: "lanczos3" });
}

async function blurredCover(width, height) {
  const source = await (await squareLogo(1024)).png().toBuffer();
  return sharp(source)
    .resize(width, height, { fit: "cover", position: "centre" })
    .blur(width > 800 ? 24 : 8)
    .modulate({ brightness: 0.92 });
}

async function splashCanvas(size, { dark = false } = {}) {
  const background = await (await blurredCover(size, size)).png().toBuffer();
  const logoSize = Math.round(size * 0.5);
  const logo = await (await squareLogo(logoSize)).png().toBuffer();
  const title = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect x="${(size - logoSize) / 2}" y="${size / 2 - logoSize / 2 - size * 0.07}" width="${logoSize}" height="${size * 0.09}" rx="${size * 0.02}" fill="#1d140bcc"/>
  <text x="50%" y="${size / 2 - logoSize / 2 - size * 0.012}" text-anchor="middle" fill="#fff8e6" font-family="Liberation Serif, DejaVu Serif, serif" font-size="${Math.round(size * 0.045)}" font-weight="700">Valley Estates</text>
</svg>`);
  let image = sharp(background).composite([
    { input: logo, gravity: "centre" },
    { input: title, gravity: "centre" },
  ]);
  if (dark) {
    image = image.modulate({ brightness: 0.62, saturation: 0.85 });
  }
  return image;
}

async function featureGraphic() {
  const background = await (await blurredCover(1024, 500)).png().toBuffer();
  const logo = await (await squareLogo(420)).png().toBuffer();
  const title = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <rect x="486" y="188" width="500" height="124" rx="22" fill="#1d140bcc"/>
  <text x="736" y="268" text-anchor="middle" fill="#fff8e6" font-family="Liberation Serif, DejaVu Serif, serif" font-size="64" font-weight="700">Valley Estates</text>
</svg>`);
  return sharp(background).composite([
    { input: logo, left: 40, top: 40 },
    { input: title, left: 0, top: 0 },
  ]);
}

function circleMask(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
}

async function adaptiveForeground(size) {
  const inner = Math.round(size * safeScale);
  const logo = await (await squareLogo(inner)).png().toBuffer();
  const offset = Math.floor((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: logo, left: offset, top: offset }]);
}

function writeIco(file, images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + entries.length;
  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    const at = i * 16;
    entries.writeUInt8(image.size >= 256 ? 0 : image.size, at);
    entries.writeUInt8(image.size >= 256 ? 0 : image.size, at + 1);
    entries.writeUInt16LE(1, at + 4);
    entries.writeUInt16LE(32, at + 6);
    entries.writeUInt32LE(image.buffer.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += image.buffer.length;
  }
  writeFileSync(file, Buffer.concat([header, entries, ...images.map((image) => image.buffer)]));
}

const master = await (await squareLogo(1024)).png().toBuffer();
mkdirSync("resources/brand", { recursive: true });
mkdirSync("store/graphics", { recursive: true });
mkdirSync("assets", { recursive: true });

await writePng(sharp(master), "resources/brand/icon-only.png", { opaque: true });
await writePng(sharp(master).resize(512, 512), "store/graphics/play-icon-512.png", { opaque: true });
await writePng(sharp(master), "store/graphics/appstore-icon-1024.png", { opaque: true });
await writePng(await blurredCover(1024, 1024), "resources/brand/icon-background.png", { opaque: true });
await writePng(await adaptiveForeground(1024), "resources/brand/icon-foreground.png");
await writePng(await splashCanvas(2732), "resources/brand/splash.png", { opaque: true });
await writePng(await splashCanvas(2732, { dark: true }), "resources/brand/splash-dark.png", { opaque: true });
await writePng(await featureGraphic(), "store/graphics/feature-graphic-1024x500.png", { opaque: true });
await writePng(sharp(master).resize(256, 256), "assets/logo.png", { opaque: true });

for (const [density, size] of androidLauncher) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  await writePng(sharp(master).resize(size, size), join(dir, "ic_launcher.png"), { opaque: true });
  const round = await sharp(master)
    .resize(size, size)
    .composite([{ input: circleMask(size), blend: "dest-in" }])
    .png()
    .toBuffer();
  await writePng(sharp(round), join(dir, "ic_launcher_round.png"));
}

for (const [density, size] of androidAdaptive) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  await writePng(await blurredCover(size, size), join(dir, "ic_launcher_background.png"), { opaque: true });
  await writePng(await adaptiveForeground(size), join(dir, "ic_launcher_foreground.png"));
}

const splash = await (await splashCanvas(2732)).png().toBuffer();
const splashDark = await (await splashCanvas(2732, { dark: true })).png().toBuffer();

function nightFolder(folder) {
  if (folder === "drawable") return "drawable-night";
  return folder.replace(/-(l|m|h|xh|xxh|xxxh)dpi$/, "-night-$1dpi");
}

for (const [folder, width, height] of androidSplash) {
  await writePng(
    sharp(splash).resize(width, height, { fit: "cover", position: "centre" }),
    `android/app/src/main/res/${folder}/splash.png`,
    { opaque: true },
  );
  const nightWidth = folder === "drawable" ? 320 : width;
  const nightHeight = folder === "drawable" ? 240 : height;
  await writePng(
    sharp(splashDark).resize(nightWidth, nightHeight, { fit: "cover", position: "centre" }),
    `android/app/src/main/res/${nightFolder(folder)}/splash.png`,
    { opaque: true },
  );
}

const iosDir = "ios/App/App/Assets.xcassets/AppIcon.appiconset";
const iosImages = [];
for (const [idiom, size, scale, pixels] of iosIcons) {
  const filename = idiom === "ios-marketing" ? "Icon-1024.png" : `Icon-${size}@${scale}.png`;
  await writePng(sharp(master).resize(pixels, pixels), join(iosDir, filename), { opaque: true });
  iosImages.push({ idiom, size, scale, filename });
}
writeFileSync(
  join(iosDir, "Contents.json"),
  `${JSON.stringify({ images: iosImages.map(({ idiom, size, scale, filename }) => ({ idiom, size, scale, filename })), info: { author: "xcode", version: 1 } }, null, 2)}\n`,
);

const splashSet = "ios/App/App/Assets.xcassets/Splash.imageset";
for (const name of ["Default@1x~universal~anyany.png", "Default@2x~universal~anyany.png", "Default@3x~universal~anyany.png"]) {
  await writePng(sharp(splash), join(splashSet, name), { opaque: true });
}
for (const name of ["Default@1x~universal~anyany-dark.png", "Default@2x~universal~anyany-dark.png", "Default@3x~universal~anyany-dark.png"]) {
  await writePng(sharp(splashDark), join(splashSet, name), { opaque: true });
}

const faviconSizes = [16, 32, 48];
const faviconPngs = [];
for (const size of faviconSizes) {
  const buffer = await sharp(master).resize(size, size).flatten({ background: "#1d140b" }).removeAlpha().png().toBuffer();
  faviconPngs.push({ size, buffer });
  if (size !== 48) {
    await writePng(sharp(buffer), `favicon-${size}.png`, { opaque: true });
  }
}
writeIco("favicon.ico", faviconPngs);
await writePng(sharp(master).resize(180, 180), "apple-touch-icon.png", { opaque: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  writeFileSync(`android/app/src/main/res/mipmap-anydpi-v26/${name}`, adaptiveXml);
}

console.log("brand assets written");
