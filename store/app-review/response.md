# App Review response: Guideline 2.1, new app submission

Preparation status: do not send or resubmit this draft until a real physical-device recording of the exact candidate build is supplied and physical-device QA is completed. Simulator footage, synthetic footage and the automated test suite are not substitutes.

## 1. Physical-device recording

Recording URL: PENDING OWNER RECORDING.

Record the exact TestFlight candidate on a physical iPhone running the latest available iOS. Begin on the Home Screen and launch Valley Estates. Show normal gameplay, the build number from TestFlight, and the main controls described below. Identify the device model, installed OS version, candidate build number and test date in the final response. Do not claim those details or tests before they are supplied. Because this app also supports iPad, complete a physical iPad/iPadOS QA pass before submission as well.

This app has no registration, login, user accounts, user-generated content, paid features, in-app purchases or subscriptions. The corresponding account deletion, moderation/reporting and payment flows therefore do not apply.

## 2. Purpose, audience and value

Valley Estates is a single-player farming and estate-management simulation set in a fictionalised Ferguson Valley, Western Australia. It is intended for players who enjoy farming, resource-management and strategy games. Players grow a homestead into a working estate by gathering resources, constructing buildings, growing crops and vineyards, raising livestock, producing virtual wine and responding to seasonal events.

It provides self-contained entertainment without an account or an internet connection. The virtual market, livestock sales and wine production are game mechanics only. The app does not sell actual alcohol, offer real financial trading or provide regulated agricultural or financial services.

## 3. Access and main-feature instructions

No login, demo credentials, backend setup or sample files are required. On a first launch, choose Start your estate, or optionally open How to play. Returning players resume their saved estate without repeating onboarding. A new estate starts with a homestead and three farmhands. Existing progress loads from device-local storage.

1. Tap a farmhand, then a nearby tree, rock or berry bush to gather resources. Drag to pan and pinch to zoom.
2. Open Build using the hammer control. Select a cottage, field or barn and confirm placement on clear terrain. Assign a farmhand to construction.
3. Select the homestead to train a farmhand and research the next age when sufficient resources are available. The farmhands/research/orders panel also exposes the research tree and worker specialisations.
4. After unlocking Settler Age, construct vineyards, a winery and paddocks. Assign workers, harvest grapes and produce bottles. Use the market for virtual goods and buyer orders when available.
5. Research upgrades as prerequisites unlock. The research screen shows the current study and remaining game time. The same study cannot be purchased twice while running.
6. Open Menu for sound levels, mute, text size, colour-blind icons, left-handed controls, graphics quality, achievements, privacy, support and credits.
7. Progress autosaves on this device. Background and reopen the app to demonstrate persistence and sound recovery. Reset is optional and requires confirmation; it is not needed to review normal gameplay.

## 4. External services, tools and platforms

Core gameplay does not depend on an external hosted service. The native app packages its HTML/JavaScript, visual assets and sound files locally and runs them through Capacitor and the device's WebKit/WebGL/audio capabilities. The bundled renderer uses Three.js; compressed models use the bundled meshoptimizer decoder. Capacitor plugins provide native haptics, splash-screen and status-bar integration.

There are no external authentication services, live data providers, advertising services, analytics SDKs, payment processors, multiplayer servers or runtime AI calls in the game. Voice clips were generated beforehand using Piper and are bundled audio files; the model is not executed in the app. The configured Game Center entitlement does not require players to sign into Game Center to play, and the game exposes no Game Center leaderboards or account flow.

GitHub Actions is used to build the application. GitHub Pages hosts public support/privacy information and a web version; the installed app does not need those services for its core offline gameplay. Asset-source websites listed in the credits are provenance references, not gameplay API dependencies.

## 5. Regional differences

The same gameplay and content are provided in every region where the app is distributed. There are no location-based feature restrictions, regional backend configurations or country-specific payment features. The interface is in English and uses fictional in-game coins, not currency conversion or real-money balances. Device-local dates govern daily game rewards; graphics and layout can vary with device capabilities and settings, not region.

## 6. Regulated activity and third-party material

This is an entertainment game, not a service in a regulated industry. Its farming, wine production and market systems are fictional. No real-world alcohol ordering, gambling, financial trading or health services are provided.

The game includes original work and third-party code/assets with source and licence information documented in the bundled credits. Do not describe all assets as original or all licences as CC0: some sound files are CC BY or CC BY-SA and require their notices. The following manifests identify the authors, source links, applicable licences and modifications:

* CREDITS.md: code and texture sources, plus links to the detailed manifests.
* ASSET_CREDITS.md: CC0 animal models, original models/buildings, modifications and the MIT-licensed model decoder.
* AUDIO_CREDITS.md: individual sound sources and CC0/public-domain/CC BY/CC BY-SA terms, plus the pre-generated voice-model attribution.
* THIRD_PARTY_LICENSES.txt: bundled MIT software licence notices.
* compliance.html and assets/licenses/: full CC BY-SA 3.0/4.0 legal texts, source attribution, transformation notices, reusable adapted recordings and checksums. These attachments do not themselves establish EULA/DRM compatibility.

Reviewer access: Menu > Credits and licences. Public copies are available in the Valley-estates repository and on the support website after the release changes are deployed. These manifests provide source/licence evidence, not a blanket legal warranty. Do not claim permissions or documentation beyond that evidence.

## Final submission gate

Before sending this text in App Store Connect and copying the completed six-part response to App Review Information > Notes:

* Replace the pending recording reference with a working reviewer-accessible URL.
* Identify and physically test the exact candidate build on supported iPhone/iPad platforms, running current OS versions. Record actual results.
* Confirm the recording starts with launching the installed app, not browser or simulator footage.
* Confirm screenshots show this candidate's actual gameplay. App Store screenshots must not be described as physical-device QA evidence if they were captured in a simulator/browser.
* Verify the recording URL is accessible without requesting permission or requiring reviewer sign-in.
* Preserve existing reviewer contact information and any relevant pre-existing notes when updating App Store Connect.
* Reply to the existing rejection thread and add the same completed information to review notes. Do not claim that changing review notes alone is a reply to the thread.
* Assess the ShareAlike synchronization clauses for sound recordings/phonograms in both the app presentation and demonstration video. They are not limited to music. Do not assume only the standalone clips can be affected.
* Verify actual distribution terms and any technical restrictions on the covered CC BY-SA audio. Do not assume a separate download automatically cures a conflicting EULA or DRM restriction. Obtain separate rights or replace the audio if compatibility cannot be established.
* Resubmit only after every requested item and the physical QA evidence are present.
