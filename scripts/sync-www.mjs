import { cpSync, mkdirSync, rmSync } from "node:fs";

const files = ["index.html", "game3d.js", "privacy.html", "CREDITS.md"];

rmSync("www", { recursive: true, force: true });
mkdirSync("www/assets", { recursive: true });

for (const file of files) {
  cpSync(file, `www/${file}`);
}
cpSync("assets/textures.js", "www/assets/textures.js");
