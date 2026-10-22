(function (root) {
  const VOICE_GAP_MS = 12000;
  const VOICE_EVENT_GAP_MS = 45000;
  const VARIANTS = { harvest: 3, frost: 3, rain: 3, cattle: 3, market: 3, storm: 3, spring: 2, summer: 2, autumn: 2, winter: 2 };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function defaultSettings() {
    return { music: 0.7, effects: 0.85, voice: 0.9, mute: false };
  }

  function parseSettings(raw) {
    const settings = defaultSettings();
    if (!raw || typeof raw !== "object") return settings;
    for (const key of ["music", "effects", "voice"]) {
      const value = Number(raw[key]);
      if (Number.isFinite(value)) settings[key] = clamp(value, 0, 1);
    }
    settings.mute = raw.mute === true;
    return settings;
  }

  function emptyVoice() {
    return { last: 0, by: {}, variant: {}, pending: null };
  }

  function cloneVoice(state) {
    const source = state || emptyVoice();
    return {
      last: source.last || 0,
      by: Object.assign({}, source.by || {}),
      variant: Object.assign({}, source.variant || {}),
      pending: source.pending || null,
    };
  }

  function canPlay(state, id, now) {
    if (state.last && now - state.last < VOICE_GAP_MS) return false;
    if (state.by[id] && now - state.by[id] < VOICE_EVENT_GAP_MS) return false;
    return true;
  }

  function emit(state, id, now) {
    const count = VARIANTS[id];
    const index = (state.variant[id] || 0) % count;
    state.variant[id] = index + 1;
    state.last = now;
    state.by[id] = now;
    if (state.pending === id) state.pending = null;
    return { play: { id: id, index: index }, state: state };
  }

  function takeVoice(state, id, now) {
    const next = cloneVoice(state);
    if (!VARIANTS[id]) return { play: null, state: next };
    if (canPlay(next, id, now)) return emit(next, id, now);
    next.pending = id;
    return { play: null, state: next };
  }

  function flushVoice(state, now) {
    const next = cloneVoice(state);
    if (!next.pending || !VARIANTS[next.pending]) return { play: null, state: next };
    if (!canPlay(next, next.pending, now)) return { play: null, state: next };
    return emit(next, next.pending, now);
  }

  function ambienceTargets(world) {
    const night = clamp(Number(world && world.night) || 0, 0, 1);
    const p = ((Number(world && world.p) || 0) % 1 + 1) % 1;
    const raining = !!(world && world.raining);
    const storm = !!(world && world.storm);
    const morning = night < 0.35 && (p < 0.28 || p > 0.96);
    const day = night < 0.45;
    return {
      wind: storm ? 0.9 : raining ? 0.62 : night > 0.5 ? 0.34 : 0.42,
      birds: morning && !storm ? 1 : day && !raining ? 0.4 : 0,
      crickets: night > 0.5 ? clamp((night - 0.4) * 1.5, 0, 1) : 0,
      rain: storm ? 0.95 : raining ? 0.72 : 0,
      morning: morning && !storm,
    };
  }

  root.VEAudioPolicy = {
    VOICE_GAP_MS: VOICE_GAP_MS,
    VOICE_EVENT_GAP_MS: VOICE_EVENT_GAP_MS,
    VARIANTS: VARIANTS,
    defaultSettings: defaultSettings,
    parseSettings: parseSettings,
    emptyVoice: emptyVoice,
    takeVoice: takeVoice,
    flushVoice: flushVoice,
    ambienceTargets: ambienceTargets,
  };
})(typeof window !== "undefined" ? window : globalThis);
