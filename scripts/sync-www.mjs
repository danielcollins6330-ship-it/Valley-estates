import { cpSync, mkdirSync, rmSync } from "node:fs";

const files = ["index.html", "game3d.js", "privacy.html", "support.html", "CREDITS.md", "favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png"];

rmSync("www", { recursive: true, force: true });
mkdirSync("www/assets/animals", { recursive: true });

for (const file of files) {
  cpSync(file, `www/${file}`);
}
cpSync("assets/textures.js", "www/assets/textures.js");
cpSync("assets/rig.js", "www/assets/rig.js");
cpSync("assets/animals/meshopt_decoder.js", "www/assets/animals/meshopt_decoder.js");
for (const animal of ["cattle", "sheep", "sheep_shorn", "dog", "chicken", "kangaroo", "cockatoo"]) {
  cpSync(`assets/animals/${animal}.glb`, `www/assets/animals/${animal}.glb`);
}
cpSync("assets/animals/coat.webp", "www/assets/animals/coat.webp");
cpSync("assets/animals/wool.webp", "www/assets/animals/wool.webp");
cpSync("assets/logo.png", "www/assets/logo.png");
cpSync("assets/audio-policy.js", "www/assets/audio-policy.js");
cpSync("assets/audio.js", "www/assets/audio.js");
cpSync("assets/expansion.js", "www/assets/expansion.js");
cpSync("assets/haptics.js", "www/assets/haptics.js");
cpSync("assets/audio", "www/assets/audio", { recursive: true });
