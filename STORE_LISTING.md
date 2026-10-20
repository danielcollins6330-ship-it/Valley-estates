# Valley Estates — store listing draft

Draft copy for Google Play and the Apple App Store. The owner still has to paste this into each console and complete the official questionnaires. Do not treat the age-rating notes below as a granted rating.

Public privacy policy (after this branch is on `main`):

https://danielcollins6330-ship-it.github.io/Valley-estates/privacy.html

## Identity

| Field | Value |
|---|---|
| Title | Valley Estates |
| Apple subtitle | Ferguson Valley Farming |
| Package / bundle id | `com.littleridgeestate.valleyestates` |
| Developer name | Daniel Collins |
| Category | Games → Simulation. Secondary: Strategy |
| Price | Free. No ads. No in-app purchases. |

Play title limit is 30 characters. “Valley Estates” is 14.

## Short description (Play, 80 characters max)

Build a Ferguson Valley wine estate. Farm, herd, and reach Empire.

(67 characters.)

## Promotional text (Apple, 170 characters max)

Found a homestead in Ferguson Valley, WA. Chop, quarry, plant vines, bottle wine, and raise Speckle Park cattle and Babydoll sheep. Seasons bring drought, frost, foxes, and bushfire.

## Keywords (Apple, 100 characters max, comma-separated)

farming,strategy,simulation,vineyard,wine,estate,agriculture,build,colony,valley

(79 characters.)

## Full description

Valley Estates is a portrait farming strategy game set in Ferguson Valley, Western Australia.

You start with a homestead, three farmhands, and a patch of grass beside the creek. Gather wood, stone, and berries. Build cottages, wheat fields, a barn, and a lumber camp. Advance through four ages — Homestead, Settler, Estate, and Valley Empire — and turn the valley into a working wine estate.

Plant vineyards, bottle wine at the winery, and sell it at the market. Stock paddocks with Speckle Park cattle or Babydoll sheep. Research sharper axes, better ploughs, fox-proof fencing, irrigation, and cellar-door tourism. Seasons change every couple of minutes. Drought, frost, foxes, and bushfires will set the farm back if you have not prepared.

How to play: tap a farmhand, then tap a tree, rock, berry bush, or building. Drag to pan, pinch to zoom, and drag-select a crew. The game autosaves on the device. It does not need an account or a network connection.

Win by reaching the Valley Empire Age and bottling 60 wines.

There are no ads, no purchases, and no online features. Your save stays on the device. The privacy policy is at the link above.

## Age rating answers

Answer the official forms this way. Wine is made and sold as a farm product. Nobody is shown drinking, and there is no intoxication. Foxes can take sheep and bushfires can burn tiles. There is no blood, no combat between people, and no weapons.

| Question | Answer |
|---|---|
| Violence against humans or realistic violence | No |
| Cartoon or fantasy violence / peril | Mild. Foxes take sheep. Bushfires burn trees and fields. No blood, no injury detail. |
| Sexual content or nudity | No |
| Profanity or crude humour | No |
| Alcohol, tobacco, or drug use | No use is shown. |
| Alcohol reference | Yes, infrequent and mild. Players grow grapes and bottle wine, then sell bottles for coins. |
| Gambling | No. The market trades goods for in-game coins only. No real money, no loot boxes. |
| Horror | No |
| User-generated content or chat | No |
| Unrestricted web access | No. The app does not embed a browser. |
| Location, contacts, camera, microphone | Not used |
| Personal data collected or shared | None. See privacy.html. |
| Ads, tracking, or account required | No |

Likely outcomes if the forms are answered as above: Apple 9+ (alcohol reference), ESRB Everyone 10+, PEGI 7, USK 6. The consoles decide the final rating. Do not advertise the game as alcohol-free.

## Data safety (Play) and App privacy (Apple)

| Question | Answer |
|---|---|
| Do you collect or share user data? | No |
| Data types | None |
| Data encrypted in transit | Not applicable. The game does not transmit data. |
| Users can request deletion | Not applicable. The only save is local. New Game, uninstall, or clearing site data removes it. |
| Tracking | No |
| Export compliance (Apple) | No non-exempt encryption. `ITSAppUsesNonExemptEncryption` is false. |

## Graphics already in this repo

| Asset | Path | Use |
|---|---|---|
| Play icon 512×512 | `store/graphics/play-icon-512.png` | Play Console high-res icon |
| App Store icon 1024×1024 | `store/graphics/appstore-icon-1024.png` | App Store Connect |
| Feature graphic 1024×500 | `store/graphics/feature-graphic-1024x500.png` | Play feature graphic (required) |
| Adaptive / iOS icon sources | `resources/brand/` | Speckle Park cow and Babydoll sheep painting, generated into `android/` and `ios/` |
| Phone screenshots | `store/screenshots/` | See sizes below |

## Screenshots

Generated from the running game, portrait, with the on-device UI:

| File | Pixels | Store slot |
|---|---|---|
| `store/screenshots/android-1080x1920-estate.png` | 1080×1920 | Play phone |
| `store/screenshots/android-1080x1920-build.png` | 1080×1920 | Play phone |
| `store/screenshots/android-1080x1920-homestead.png` | 1080×1920 | Play phone |
| `store/screenshots/ios-1242x2688-estate.png` | 1242×2688 | App Store 6.5-inch |
| `store/screenshots/ios-1242x2688-build.png` | 1242×2688 | App Store 6.5-inch |
| `store/screenshots/ios-1242x2688-homestead.png` | 1242×2688 | App Store 6.5-inch |

Play requires at least two phone screenshots. JPEG or 24-bit PNG, sides between 320 and 3840 px, 16:9 or 9:16. 1080×1920 satisfies that.

Still required before submission, not generated here:

- Apple 6.7-inch iPhone screenshots, 1290×2796 (required by current App Store Connect). The 1242×2688 set can be rescaled only as a temporary stand-in; capture native 6.7-inch shots before review.
- Apple 13-inch iPad screenshots, 2064×2752, if the app is offered on iPad. iPad supports all four orientations so Split View and Slide Over work.
- Play 7-inch tablet (optional) and 10-inch tablet (optional).
- A short preview video is optional on both stores.

Capture notes: dismiss the welcome sheet, show the estate with the goal card, open the build menu, and select the homestead so the bottom panel is visible. Keep the status bar hidden. Do not show a debug console.
