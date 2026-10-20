import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

mkdirSync("resources/brand", { recursive: true });
mkdirSync("store/graphics", { recursive: true });

const font = "Inter, Liberation Sans, sans-serif";
const serif = "Liberation Serif, DejaVu Serif, serif";

function render(svg, width, file) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontDirs: ["/usr/share/fonts"], loadSystemFonts: true },
  })
    .render()
    .asPng();
  writeFileSync(file, png);
}

function skyDefs({ dusk = false } = {}) {
  const skyTop = dusk ? "#2a1c3a" : "#f6d27a";
  const skyMid = dusk ? "#6a3a4a" : "#e9924a";
  const skyBot = dusk ? "#1d140b" : "#d86a45";
  return `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyTop}"/>
      <stop offset="48%" stop-color="${skyMid}"/>
      <stop offset="100%" stop-color="${skyBot}"/>
    </linearGradient>
    <linearGradient id="hillA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${dusk ? "#3e5a34" : "#8aaa62"}"/>
      <stop offset="100%" stop-color="${dusk ? "#2c4226" : "#5f8144"}"/>
    </linearGradient>
    <linearGradient id="hillB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${dusk ? "#24361f" : "#4d6b34"}"/>
      <stop offset="100%" stop-color="${dusk ? "#152214" : "#2f4a24"}"/>
    </linearGradient>
  `;
}

function valley({ dusk = false, sunY = 230 } = {}) {
  const sun = dusk ? "#f0c9a0" : "#fff3c4";
  return `
    <rect width="1024" height="1024" fill="url(#sky)"/>
    <circle cx="760" cy="${sunY}" r="92" fill="${sun}"/>
    <circle cx="760" cy="${sunY}" r="140" fill="${sun}" opacity="0.28"/>
    <path d="M0 500 C 160 390, 300 540, 500 450 C 700 360, 860 490, 1024 420 L 1024 1024 L 0 1024 Z" fill="url(#hillA)"/>
    <path d="M0 680 C 220 560, 400 760, 640 640 C 840 540, 920 700, 1024 620 L 1024 1024 L 0 1024 Z" fill="url(#hillB)"/>
  `;
}

function vines(y0, rows) {
  let out = "";
  for (let i = 0; i < rows; i++) {
    const y = y0 + i * 36;
    const inset = 70 + i * 22;
    const stroke = 8 + i * 1.4;
    out += `<path d="M${inset} ${y} Q 512 ${y - 28} ${1024 - inset} ${y}" fill="none" stroke="#1d3314" stroke-width="${stroke}" stroke-linecap="round"/>`;
    for (let p = 0; p < 8; p++) {
      const t = (p + 0.5) / 8;
      const x = inset + (1024 - inset * 2) * t;
      const cy = y - Math.sin(Math.PI * t) * 28;
      out += `<ellipse cx="${x}" cy="${cy - 10}" rx="${7 + i}" ry="${11 + i}" fill="#3f6a28"/>`;
    }
  }
  return out;
}

function homestead(cx, cy, scale) {
  const s = scale;
  return `
    <g transform="translate(${cx} ${cy}) scale(${s})">
      <rect x="-70" y="8" width="150" height="18" rx="3" fill="#c4a574"/>
      <rect x="-78" y="22" width="166" height="10" fill="#8d6a3f"/>
      <rect x="-46" y="-36" width="92" height="70" fill="#f4e4c4"/>
      <path d="M-62 -36 L 0 -92 L 62 -36 Z" fill="#a33b24"/>
      <rect x="28" y="-78" width="14" height="36" fill="#6b3a32"/>
      <rect x="-14" y="-4" width="22" height="38" fill="#6b3a32"/>
      <rect x="-40" y="-16" width="16" height="16" fill="#9fd0e0"/>
      <rect x="18" y="-16" width="16" height="16" fill="#9fd0e0"/>
    </g>
  `;
}

function grapes(cx, cy, scale) {
  const dots = [
    [-18, 10], [0, 6], [18, 12], [-10, 28], [12, 30], [0, 46], [-22, 44], [22, 48],
  ];
  const circles = dots
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="#6b2142"/>`)
    .join("");
  return `
    <g transform="translate(${cx} ${cy}) scale(${scale})">
      <path d="M0 -8 C 18 -36, 40 -28, 28 -6" fill="none" stroke="#2f6b1f" stroke-width="6"/>
      <ellipse cx="34" cy="-24" rx="16" ry="8" fill="#3f6a28" transform="rotate(-30 34 -24)"/>
      ${circles}
      <circle cx="6" cy="22" r="7" fill="#f3d2dc" opacity="0.7"/>
    </g>
  `;
}

const iconOnly = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${skyDefs()}</defs>
  ${valley()}
  ${vines(760, 6)}
  ${homestead(390, 700, 2.15)}
  ${grapes(690, 640, 2.4)}
</svg>`;

const iconBackground = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${skyDefs()}</defs>
  ${valley()}
  ${vines(780, 5)}
</svg>`;

const iconForeground = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${homestead(430, 560, 2.5)}
  ${grapes(680, 500, 2.7)}
</svg>`;

function splash({ dusk = false } = {}) {
  const title = dusk ? "#f6e7c8" : "#fff8e6";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 1024 1024">
  <defs>${skyDefs({ dusk })}</defs>
  ${valley({ dusk, sunY: 300 })}
  ${vines(790, 5)}
  ${homestead(430, 680, 1.9)}
  ${grapes(700, 620, 1.9)}
  <rect x="170" y="330" width="684" height="128" rx="28" fill="#1d140bcc"/>
  <text x="512" y="408" text-anchor="middle" fill="${title}" font-family="${serif}" font-size="68" font-weight="700">Valley Estates</text>
  <text x="512" y="448" text-anchor="middle" fill="${title}" font-family="${font}" font-size="26">Ferguson Valley</text>
</svg>`;
}

const feature = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6d27a"/>
      <stop offset="55%" stop-color="#e9924a"/>
      <stop offset="100%" stop-color="#c45c3e"/>
    </linearGradient>
    <linearGradient id="hillA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8aaa62"/>
      <stop offset="100%" stop-color="#5f8144"/>
    </linearGradient>
    <linearGradient id="hillB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4d6b34"/>
      <stop offset="100%" stop-color="#2f4a24"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#sky)"/>
  <circle cx="860" cy="110" r="54" fill="#fff3c4"/>
  <path d="M0 230 C 180 160, 320 250, 520 190 C 740 120, 880 210, 1024 170 L 1024 500 L 0 500 Z" fill="url(#hillA)"/>
  <path d="M0 340 C 200 270, 420 390, 680 310 C 860 260, 940 340, 1024 300 L 1024 500 L 0 500 Z" fill="url(#hillB)"/>
  ${vines(390, 3)}
  ${homestead(250, 300, 1.35)}
  ${grapes(430, 270, 1.5)}
  <text x="620" y="230" fill="#fff8e6" font-family="${serif}" font-size="64">Valley Estates</text>
  <text x="620" y="278" fill="#fff8e6" font-family="${font}" font-size="24">A farming strategy game</text>
</svg>`;

render(iconOnly, 1024, "resources/brand/icon-only.png");
render(iconBackground, 1024, "resources/brand/icon-background.png");
render(iconForeground, 1024, "resources/brand/icon-foreground.png");
render(splash({ dusk: false }), 2732, "resources/brand/splash.png");
render(splash({ dusk: true }), 2732, "resources/brand/splash-dark.png");
render(iconOnly, 512, "store/graphics/play-icon-512.png");
render(iconOnly, 1024, "store/graphics/appstore-icon-1024.png");
render(feature, 1024, "store/graphics/feature-graphic-1024x500.png");

writeFileSync("resources/brand/icon-only.svg", iconOnly);
writeFileSync("resources/brand/splash.svg", splash({ dusk: false }));
writeFileSync("store/graphics/feature-graphic.svg", feature);
