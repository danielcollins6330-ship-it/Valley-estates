# Valley Estates

A mobile farming strategy game set in Ferguson Valley, WA.

Play it on the web at [the GitHub Pages site](https://danielcollins6330-ship-it.github.io/Valley-estates/). Support is [support.html](support.html). The privacy policy is [privacy.html](privacy.html). Credits are in [CREDITS.md](CREDITS.md). Store listing draft: [STORE_LISTING.md](STORE_LISTING.md).

The Android and iOS apps use Capacitor (`com.littleridgeestate.valleyestates`). They bundle the same files as the website, run fullscreen, and keep the save in local storage on the device. iPhone stays portrait. Foldables, Android split-screen, and iPad multitasking can rotate and resize without restarting the activity.

## Web files

`index.html`, `game3d.js`, `assets/textures.js`, and `assets/expansion.js` stay at the repository root so GitHub Pages can keep serving them. `npm run sync` copies those files, plus `privacy.html`, `support.html`, and `assets/audio/`, into `www/` and then into the native projects.

Expansion 1 adds a Cellar Door, Valley Villa, livestock breeding with vet care and a sale yard, wool as a product, a season cycle (the farmer announces each season), local achievements, and a three-minute tour on a new estate. The same save also holds a moving market, choice events, a shearing shed, water tank, olive grove and machinery shed, bronze/silver/gold wine, a daily gift, and a capped offline summary. A research tree covers presses, irrigation, pasture and breeding across the four ages. Named farmhands specialise in vines, stock or building. Idle hands take jobs on their own: each has a priority of vines, stock, building, or auto. Tap a hand, or open the farm desk, to see what they are doing. Each year ends vintage with a harvest festival, then a wine-show day that pays a capped bonus. Vine rows read as budburst, autumn colour, or bare winter canes, and the air carries dust, rain, or frost. During the harvest festival a few visitors walk the cellar door, including on Low graphics. The homestead, winery, cellar door, Valley Villa, sheds and sale yard are corrugated-iron rural buildings with a simpler distant mesh. Buyers post short orders, and the valley shows dusk kangaroos, cockatoos in the vines, heavier rain and frost, and a darker night. Settings cover text size, colour-blind resource labels, a left-handed layout, and a confirmed save reset. Saves stay in `valleyEstatesV4`. An older save still loads; the new fields are filled in when it opens.

Version 1.1 draws the valley at the screen's own resolution. Medium, Low and Auto step the picture down, and Auto drops a step when the frame rate stays under 30. A Tractor Shed unlocks a tractor that works wheat, vines and olives faster. The shed sells a sprayer, hay mower, baler and seeder, then a combine harvester from the Estate Age. The Valley Empire opens a broadacre paddock for a larger herd. A new estate starts on Easy, Normal or Hard. That choice scales building and research costs, how fast weeds spread, what they cost to clear, how hard drought hits, and how often events arrive. An older save stays on Normal. Frost still damages vines, and the cellar door still takes tastings. Wine, wool, cattle and lamb prices lean with the season: vintage lifts wine, winter lifts wool, spring lifts lamb, and autumn lifts cattle.

Sound is ambience that follows the time of day and the rain, animal calls, action effects, and short Australian farmer lines. The menu has separate ambience, effects and voice sliders plus mute. Those settings are stored in `valleyEstatesAudio`, separate from the estate save. The first tap unlocks playback. Audio uses the page's media elements with the playback session, so the iOS silent switch does not mute the game. In-game mute still does, and sound pauses when the app is in the background. Sources and licences are in [AUDIO_CREDITS.md](AUDIO_CREDITS.md).

## Mobile commands

```bash
npm ci
npm run assets   # regenerate icons and splash screens
npm run sync     # copy the game into android/ and ios/
npm test         # deterministic gameplay, sound, signing and packaging regressions
npm run web:stage # stage and verify the same runtime assets for GitHub Pages
```

Release builds run in GitHub Actions. Android signing still uses the keystore secrets in `.github/workflows/android.yml`. See `STORE_LISTING.md` for the store listing. iOS TestFlight is below.

## TestFlight

`.github/workflows/ios-register-bundle-id.yml` registers the iOS bundle id `com.littleridgeestate.valleyestates` (name Valley Estates) with the App Store Connect API. If that id already exists, the step succeeds. Run it from the Actions tab, or let the TestFlight workflow run it first. It does not create the app record and does not submit anything for review.

After that id exists, create the app yourself: App Store Connect → My Apps → + → New App, and choose this bundle id. The TestFlight upload cannot succeed until that app record exists.

`.github/workflows/ios-testflight.yml` runs on a `v*` tag or when someone starts it with `workflow_dispatch`. It registers the bundle id, builds the web bundle, runs `cap sync ios`, creates an Apple Distribution certificate and an App Store profile for that run, archives with that profile, exports an IPA, and uploads that IPA to TestFlight. Before that profile is created, the workflow enables the Game Center capability on the bundle ID so the profile includes `com.apple.developer.game-center`, matching `ios/App/App/App.entitlements`. The upload does not submit the app for App Store review. Apple limits how many distribution certificates a team can hold. When that limit is already reached, this workflow revokes known unused CI certificates, oldest first (`F87GD5XVS2`, `4G8BZ8MGKN`, `38798V9TFT`, `ADJS9GQYHR`, `U86P563X6Z`, then `CMYTHGHAD5`), until Apple accepts a new one. Those certificates were created by earlier runs and their private keys were not kept. It does not revoke any other certificate.

Add these repository secrets (Settings → Secrets and variables → Actions):

- `ASC_ISSUER_ID` — App Store Connect API issuer id
- `ASC_KEY_ID` — the key id
- `APPLE_TEAM_ID` — the Apple Developer team id
- `ASC_API_KEY_P8` — the full `.p8` file, including the `BEGIN` and `END` lines

The workflow stops immediately if any of those secrets is missing. It writes the `.p8` to a private temp file for `xcodebuild` and `altool`, and it does not print the key. The marketing version archived for TestFlight is 1.1.0, and the build number is 18. App Store Connect already accepted 1.0.12 (17).

## Web and native asset integrity

GitHub Pages and the Capacitor web bundle use `scripts/stage-web.mjs` as their shared staging path. It copies the complete `assets/` tree, including audio, voice, building and animal models, textures and loaders. Both staging paths verify each copied file against its source before succeeding. Do not return to a hand-maintained list of individual assets: missing audio scripts cause the Sound controls to disappear, and missing model loaders silently remove expansion visuals.

The Node audio tests use controlled media-element stubs to reproduce lifecycle and volume-control bugs. They do not prove that a physical iPhone or Android device plays audio. Before releasing, test a real tap, sound controls, and background/foreground recovery on-device. The native session is playback, so the hardware silent switch does not mute the game.

## Research and saved-estate protection

Research already running anywhere on the estate cannot be purchased again from the farm desk or a building. The research sheet shows a live percentage and remaining game seconds without replacing the controls as the timer updates. Legacy upgrades and age advances use the same duplicate protection.

Estate saves keep the `valleyEstatesV4` key. A normal save retains the previous valid snapshot in `valleyEstatesV4_backup`. Damaged raw data is retained in place and, when storage permits, copied to `valleyEstatesV4_corrupt`. Failed validation, failed loading, a missing primary with an existing backup, or unavailable storage opens a recovery screen. Gameplay and autosaving stay paused until recovery succeeds or the player explicitly confirms a reset. Recovery offers backup restoration, retry and an export of the original data. Reset deletes the estate and its recovery keys, not sound or accessibility preferences.

Storage quota failures are reported instead of pretending that a save succeeded. If both snapshots are damaged or storage itself has been cleared, recovery cannot recreate the lost estate. This remains device-local storage, not cloud backup. The deterministic tests cover the recovery state machine and real game save/load function integration with controlled renderer and storage stubs; handset and native file-export behaviour still require device testing before release.


## App entry and Apple review evidence

The iOS launch storyboard is an unbranded warm-paper surface that matches the first interactive screen. There is no minimum splash delay. First-time players receive a restrained estate welcome with optional guidance. Existing estates resume automatically once onboarding has been completed. The simulation pauses during welcome/help, restores its prior speed afterward, and cannot bypass damaged-save recovery. Menu reopens the short tutorial.

The entry has keyboard focus containment, explicit dialog labelling, safe-area padding, scalable system-font body text, motion/contrast preferences and 44-point-or-larger controls. Automated checks do not certify VoiceOver, Dynamic Type, native scaling or physical-device interaction; those still need device QA. See `store/app-review/entry-design.md` for the Apple guidance and device checklist. Apple Guideline 2.1 still requires the requested real-device recording and complete review information before resubmission.
