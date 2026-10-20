# Valley Estates

A mobile farming strategy game set in Ferguson Valley, WA.

Play it on the web at [the GitHub Pages site](https://danielcollins6330-ship-it.github.io/Valley-estates/). The privacy policy is [privacy.html](privacy.html). Credits are in [CREDITS.md](CREDITS.md). Store listing draft: [STORE_LISTING.md](STORE_LISTING.md).

The Android and iOS apps use Capacitor (`com.littleridgeestate.valleyestates`). They bundle the same files as the website, stay in portrait, run fullscreen, and keep the save in local storage on the device.

## Web files

`index.html`, `game3d.js`, and `assets/textures.js` stay at the repository root so GitHub Pages can keep serving them. `npm run sync` copies those files, plus `privacy.html`, into `www/` and then into the native projects.

## Mobile commands

```bash
npm ci
npm run assets   # regenerate icons and splash screens
npm run sync     # copy the game into android/ and ios/
```

Release builds run in GitHub Actions. See `STORE_LISTING.md` for what a store account owner still has to sign and upload.
