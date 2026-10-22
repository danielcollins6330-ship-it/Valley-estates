import { cpSync, mkdirSync, rmSync } from "node:fs";

const files = ["index.html", "game3d.js", "privacy.html", "support.html", "CREDITS.md", "favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png"];

rmSync("www", { recursive: true, force: true });
mkdirSync("www/assets", { recursive: true });

for (const file of files) {
  cpSync(file, `www/${file}`);
}
cpSync("assets/textures.js", "www/assets/textures.js");
cpSync("assets/logo.png", "www/assets/logo.png");
cpSync("assets/audio-policy.js", "www/assets/audio-policy.js");
cpSync("assets/audio.js", "www/assets/audio.js");
cpSync("assets/expansion.js", "www/assets/expansion.js");
cpSync("assets/haptics.js", "www/assets/haptics.js");
cpSync("assets/audio", "www/assets/audio", { recursive: true });
