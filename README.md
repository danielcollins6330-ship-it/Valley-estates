# Valley Estates

A mobile farming strategy game set in Ferguson Valley, WA.

Play it on the web at [the GitHub Pages site](https://danielcollins6330-ship-it.github.io/Valley-estates/). The privacy policy is [privacy.html](privacy.html). Credits are in [CREDITS.md](CREDITS.md). Store listing draft: [STORE_LISTING.md](STORE_LISTING.md).

The Android and iOS apps use Capacitor (`com.littleridgeestate.valleyestates`). They bundle the same files as the website, run fullscreen, and keep the save in local storage on the device. iPhone stays portrait. Foldables, Android split-screen, and iPad multitasking can rotate and resize without restarting the activity.

## Web files

`index.html`, `game3d.js`, and `assets/textures.js` stay at the repository root so GitHub Pages can keep serving them. `npm run sync` copies those files, plus `privacy.html` and `assets/audio/`, into `www/` and then into the native projects.

Sound is ambience that follows the time of day and the rain, animal calls, action effects, and short Australian farmer lines. The menu has separate ambience, effects and voice sliders plus mute. Those settings are stored in `valleyEstatesAudio`, separate from the estate save. The first tap unlocks playback. Audio uses the page's media elements with the ambient session so the iOS silent switch can mute it, and it pauses when the app is in the background. Sources and licences are in [AUDIO_CREDITS.md](AUDIO_CREDITS.md).

## Mobile commands

```bash
npm ci
npm run assets   # regenerate icons and splash screens
npm run sync     # copy the game into android/ and ios/
```

Release builds run in GitHub Actions. Android signing still uses the keystore secrets in `.github/workflows/android.yml`. See `STORE_LISTING.md` for the store listing. iOS TestFlight is below.

## TestFlight

`.github/workflows/ios-register-bundle-id.yml` registers the iOS bundle id `com.littleridgeestate.valleyestates` (name Valley Estates) with the App Store Connect API. If that id already exists, the step succeeds. Run it from the Actions tab, or let the TestFlight workflow run it first. It does not create the app record and does not submit anything for review.

After that id exists, create the app yourself: App Store Connect → My Apps → + → New App, and choose this bundle id. The TestFlight upload cannot succeed until that app record exists.

`.github/workflows/ios-testflight.yml` runs on a `v*` tag or when someone starts it with `workflow_dispatch`. It registers the bundle id, builds the web bundle, runs `cap sync ios`, creates an Apple Distribution certificate and an App Store profile for that run, archives with that profile, exports an IPA, and uploads that IPA to TestFlight. Before that profile is created, the workflow enables the Game Center capability on the bundle ID so the profile includes `com.apple.developer.game-center`, matching `ios/App/App/App.entitlements`. The upload does not submit the app for App Store review. Apple limits how many distribution certificates a team can hold. When that limit is already reached, this workflow revokes one known unused CI certificate, oldest first (`F87GD5XVS2`, `4G8BZ8MGKN`, `38798V9TFT`, `ADJS9GQYHR`, then `U86P563X6Z`), and tries once more. Those certificates were created by earlier runs and their private keys were not kept. It does not revoke any other certificate.

Add these repository secrets (Settings → Secrets and variables → Actions):

- `ASC_ISSUER_ID` — App Store Connect API issuer id
- `ASC_KEY_ID` — the key id
- `APPLE_TEAM_ID` — the Apple Developer team id
- `ASC_API_KEY_P8` — the full `.p8` file, including the `BEGIN` and `END` lines

The workflow stops immediately if any of those secrets is missing. It writes the `.p8` to a private temp file for `xcodebuild` and `altool`, and it does not print the key. The TestFlight build number is the GitHub Actions run number. The marketing version is `MARKETING_VERSION` in the Xcode project.
