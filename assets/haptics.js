(function (root) {
  function tap(kind) {
    const heavy = kind === "heavy";
    const cap = root.Capacitor;
    const haptics = cap && cap.Plugins && cap.Plugins.Haptics;
    if (haptics && typeof haptics.impact === "function") {
      Promise.resolve(haptics.impact({ style: heavy ? "HEAVY" : "LIGHT" })).catch(function () {});
      return;
    }
    if (root.navigator && typeof root.navigator.vibrate === "function") {
      try {
        root.navigator.vibrate(heavy ? 16 : 8);
      } catch (error) {
        /* some browsers block vibration without a gesture */
      }
    }
  }

  root.VEHaptics = { tap: tap };
})(typeof window !== "undefined" ? window : globalThis);
