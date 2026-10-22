# Valley Estates

A mobile farming strategy game set in Ferguson Valley, WA.

Play it on the web at [the GitHub Pages site](https://danielcollins6330-ship-it.github.io/Valley-estates/). Support is [support.html](support.html). The privacy policy is [privacy.html](privacy.html). Credits are in [CREDITS.md](CREDITS.md). Store listing draft: [STORE_LISTING.md](STORE_LISTING.md).

The Android and iOS apps use Capacitor (`com.littleridgeestate.valleyestates`). They bundle the same files as the website, run fullscreen, and keep the save in local storage on the device. iPhone stays portrait. Foldables, Android split-screen, and iPad multitasking can rotate and resize without restarting the activity.

## Web files

`index.html`, `game3d.js`, `assets/textures.js`, and `assets/expansion.js` stay at the repository root so GitHub Pages can keep serving them. `npm run sync` copies those files, plus `privacy.html`, `support.html`, and `assets/audio/`, into `www/` and then into the native projects.

Expansion 1 adds a Cellar Door, Valley Villa, livestock breeding with vet care and a sale yard, wool as a product, a season cycle (the farmer announces each season), local achievements, and a three-minute tour on a new estate. The same save also holds a moving market, choice events, a shearing shed, water tank, olive grove and machinery shed, bronze/silver/gold wine, a daily gift, and a capped offline summary. A research tree covers presses, irrigation, pasture and breeding across the four ages. Named farmhands specialise in vines, stock or building. Idle hands take jobs on their own: each has a priority of vines, stock, building, or auto, and a label shows what they are doing. Each year ends vintage with a harvest festival, then a wine-show day that pays a capped bonus. Vine rows read as budburst, autumn colour, or bare winter canes, and the air carries dust, rain, or frost. Buyers post short orders, and the valley shows dusk kangaroos, cockatoos in the vines, heavier rain and frost, and a darker night. Settings cover text size, colour-blind resource labels, a left-handed layout, and a confirmed save reset. Saves stay in `valleyEstatesV4`. An older save still loads; the new fields are filled in when it opens.

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

`.github/workflows/ios-testflight.yml` runs on a `v*` tag or when someone starts it with `workflow_dispatch`. It registers the bundle id, builds the web bundle, runs `cap sync ios`, creates an Apple Distribution certificate and an App Store profile for that run, archives with that profile, exports an IPA, and uploads that IPA to TestFlight. The upload does not submit the app for App Store review. Apple limits how many distribution certificates a team can hold. When that limit is already reached, this workflow revokes one known unused CI certificate (`F87GD5XVS2`, or `4G8BZ8MGKN` if the first is already gone) and tries once more. Those certificates were created by earlier runs and their private keys were not kept. It does not revoke any other certificate.

Add these repository secrets (Settings → Secrets and variables → Actions):

- `ASC_ISSUER_ID` — App Store Connect API issuer id
- `ASC_KEY_ID` — the key id
- `APPLE_TEAM_ID` — the Apple Developer team id
- `ASC_API_KEY_P8` — the full `.p8` file, including the `BEGIN` and `END` lines

The workflow stops immediately if any of those secrets is missing. It writes the `.p8` to a private temp file for `xcodebuild` and `altool`, and it does not print the key. The TestFlight build number is the GitHub Actions run number. The marketing version stays the `1.0` set in the Xcode project.
