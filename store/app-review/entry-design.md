# Professional app entry and Apple HIG

## Sources checked

* https://developer.apple.com/design/human-interface-guidelines/launching
* https://developer.apple.com/design/human-interface-guidelines/onboarding
* https://developer.apple.com/design/human-interface-guidelines/accessibility

Apple's launch guidance says the native launch screen should resemble the first app screen, avoid unnecessary text/branding and transition promptly. Onboarding should be brief, optional and repeatable from an appropriate help location. Returning people should regain their prior state rather than repeating setup. These are design references, not an Apple compliance certification or assurance of review approval.

## Implemented entry

The native launch is a simple warm-paper UIView. The former oversized branded launch image is no longer referenced by the launch storyboard. The Capacitor splash has no forced minimum display time. The HTML boot surface uses the matching colour and an honest indeterminate status while the game actually initialises. A boot failure offers retry/support without clearing estate storage.

The first-time welcome uses an original inline vineyard illustration, the existing Red Gum Interactive identity, restrained forest/cream colours, system-font body copy, a serif game title and one clear Start your estate action. How to play is a separate, optional short explanation. There are no emoji logos, fake percentage loaders, decorative time delays, sign-up barriers or new external services. The illustration is onboarding artwork, not a gameplay screenshot, and must not be used as App Store gameplay evidence.

Returning players with completed onboarding resume their saved estate automatically. A legacy estate that has not completed onboarding can continue from the welcome without resetting. The simulation pauses and the hidden 3D scene is not drawn while welcome/help is open and restores its previous speed, including an intentional pause, afterward. Menu reopens help. Save recovery remains higher priority than every entry action, and no entry module code reads, overwrites or deletes local estate storage.

## Accessibility implementation and limits

Controls are at least 44 CSS pixels with a 52-pixel primary action, safe-area-aware padding, scrollable content at larger sizes, system text styles and relative type sizes. Reduced-motion and higher-contrast preferences are respected. The dialog is labelled, background controls become inert/hidden to assistive technology, keyboard focus is contained and restored on dismissal, and Escape uses the non-destructive start/continue action. Text/button colour pairs pass automated WCAG AA contrast checks.

These measures are not proof of native accessibility compliance. Confirm actual point sizes, VoiceOver reading order, larger system text, touch/pinch behaviour, contrast settings, landscape/iPad layout and native launch transitions on supported physical devices. The new entry is specifically not a reason to remove Apple's physical QA gate.

## Regression checks

The suite covers optional welcome/help, existing-estate continuation, tutorial completion only on explicit start, preserving simulation speed, recovery precedence, focus containment/restoration, boot-error handling, safe-area and motion preferences, source-file packaging and native launch configuration. Existing audio, research, save-recovery and signing tests remain in the suite.

## Before App Review

Record the exact revised TestFlight candidate launching on a physical device with the latest OS, show the typical flow and provide real iPhone/iPad QA results. Complete all six requested review-information items, add them to App Review Information > Notes and reply to the rejection thread separately. Do not claim that a draft, simulator, artwork preview or automated test run fulfils that evidence requirement.
