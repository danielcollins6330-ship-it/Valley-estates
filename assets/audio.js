(function () {
  const KEY = "valleyEstatesAudio";
  const policy = window.VEAudioPolicy;
  const LOOP_NAMES = ["wind", "birds", "crickets", "rain", "tractor"];
  const ANIMAL_EVERY = { cow: 22000, sheep: 17000, chicken: 28000, dog: 36000, magpie: 20000, kookaburra: 30000 };

  let settings = policy.parseSettings(readStore());
  let unlocked = false;
  let paused = document.hidden;
  let voiceState = policy.emptyVoice();
  const loops = {};
  const shown = {};
  const nextAnimal = {};
  const active = new Set();
  const buses = new WeakMap();
  const played = [];
  let currentVoice = null;

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function writeStore() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (error) {
      /* private mode or a full store */
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function src(name) {
    return "assets/audio/" + name + ".m4a";
  }

  function note(name) {
    played.push(name);
    if (played.length > 30) played.shift();
  }

  function make(name, loop) {
    const audio = new Audio(src(name));
    audio.loop = !!loop;
    audio.preload = "auto";
    audio.volume = 0;
    audio.playsInline = true;
    return audio;
  }

  function audible() {
    return unlocked && !paused && !settings.mute;
  }

  function setPlaybackSession() {
    try {
      // playback keeps a game audible when the iPhone silent switch is on.
      // ambient is silenced by that switch, which is why 1.0.11 and 1.0.12 stayed quiet.
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch (error) {
      /* older WebKit */
    }
  }

  function track(audio, bus, gain) {
    active.add(audio);
    buses.set(audio, { bus: bus, gain: gain });
    const release = function () {
      active.delete(audio);
      if (currentVoice === audio) currentVoice = null;
    };
    audio.addEventListener("ended", release, { once: true });
    audio.addEventListener("error", release, { once: true });
  }

  function pauseAll() {
    for (const name of LOOP_NAMES) {
      const audio = loops[name];
      if (audio) audio.pause();
    }
    if (currentVoice) currentVoice.pause();
    for (const audio of active) audio.pause();
    active.clear();
    currentVoice = null;
  }

  function unlock() {
    if (unlocked) return;
    setPlaybackSession();
    let waiting = 0;
    let failed = 0;
    for (const name of LOOP_NAMES) {
      const audio = loops[name] || make(name, true);
      loops[name] = audio;
      audio.muted = false;
      audio.volume = 0;
      waiting += 1;
      const pending = audio.play();
      const finish = function (error) {
        waiting -= 1;
        if (error) failed += 1;
        // A gesture play() that is later paused cannot be started again on iOS.
        // If every loop rejects, allow the next tap to try the unlock again.
        if (waiting === 0 && failed === LOOP_NAMES.length) unlocked = false;
      };
      if (pending && pending.then) pending.then(function () { finish(); }).catch(function () { finish(true); });
      else finish();
    }
    const now = performance.now();
    for (const name of Object.keys(ANIMAL_EVERY)) nextAnimal[name] = now + 4000 + Math.random() * 8000;
    unlocked = true;
  }

  function applyLoop(name, target, bus) {
    const audio = loops[name];
    if (!audio) return;
    const want = audible() ? clamp(target * settings[bus], 0, 1) : 0;
    const current = shown[name] || 0;
    const next = want === 0 && current < 0.02 ? 0 : current + (want - current) * 0.18;
    shown[name] = next;
    audio.volume = next;
    if (next <= 0.012) {
      if (!audio.paused) audio.pause();
      return;
    }
    if (audio.paused) {
      const pending = audio.play();
      if (pending && pending.catch) pending.catch(function () {});
    }
  }

  function sfx(name, gain) {
    if (!audible() || settings.effects <= 0) return;
    const audio = make(name, false);
    audio.volume = clamp((gain == null ? 0.8 : gain) * settings.effects, 0, 1);
    track(audio, "effects", gain == null ? 0.8 : gain);
    note(name);
    const pending = audio.play();
    if (pending && pending.catch) pending.catch(function () {});
  }

  function playVoice(play) {
    if (currentVoice) {
      currentVoice.pause();
      active.delete(currentVoice);
    }
    const audio = make("voice/" + play.id + "-" + play.index, false);
    audio.volume = clamp(settings.voice, 0, 1);
    currentVoice = audio;
    track(audio, "voice", 1);
    note("voice:" + play.id + "-" + play.index);
    const pending = audio.play();
    if (pending && pending.catch) pending.catch(function () {});
  }

  function say(id) {
    if (!audible() || settings.voice <= 0) return;
    const result = policy.takeVoice(voiceState, id, performance.now());
    voiceState = result.state;
    if (result.play) playVoice(result.play);
  }

  function maybeAnimal(name, now, file, busGain) {
    if (now < (nextAnimal[name] || 0)) return;
    nextAnimal[name] = now + ANIMAL_EVERY[name] * (0.75 + Math.random() * 0.7);
    if (busGain === "music") {
      if (!audible() || settings.music <= 0) return;
      const audio = make(file, false);
      audio.volume = clamp(0.75 * settings.music, 0, 1);
      track(audio, "music", 0.75);
      note(file);
      const pending = audio.play();
      if (pending && pending.catch) pending.catch(function () {});
      return;
    }
    sfx(file, 0.55);
  }

  function sync(world) {
    if (paused || !unlocked) return;
    const targets = policy.ambienceTargets(world || {});
    applyLoop("wind", targets.wind, "music");
    applyLoop("birds", targets.birds, "music");
    applyLoop("crickets", targets.crickets, "music");
    applyLoop("rain", targets.rain, "music");
    applyLoop("tractor", world && world.farming ? 0.62 : 0, "effects");
    const now = performance.now();
    if (world && world.cattle) maybeAnimal("cow", now, "cow", "effects");
    if (world && world.sheep) maybeAnimal("sheep", now, Math.random() < 0.45 ? "sheep-babydoll" : "sheep", "effects");
    maybeAnimal("chicken", now, "chicken", "effects");
    maybeAnimal("dog", now, "dog", "effects");
    if (targets.morning) {
      maybeAnimal("magpie", now, "magpie", "music");
      maybeAnimal("kookaburra", now, "kookaburra", "music");
    }
    if (audible() && settings.voice > 0) {
      const flushed = policy.flushVoice(voiceState, now);
      voiceState = flushed.state;
      if (flushed.play) playVoice(flushed.play);
    }
  }

  function percent(value) {
    return Math.round(clamp(value, 0, 1) * 100);
  }

  function settingsHtml() {
    const muteClass = settings.mute ? "btn red" : "btn";
    const muteLabel = settings.mute ? "Unmute" : "Mute";
    return '<p><b>Sound</b></p>'
      + '<label class="audio-row">Ambience <input data-audio="music" type="range" min="0" max="100" value="' + percent(settings.music) + '"></label>'
      + '<label class="audio-row">Effects <input data-audio="effects" type="range" min="0" max="100" value="' + percent(settings.effects) + '"></label>'
      + '<label class="audio-row">Voice <input data-audio="voice" type="range" min="0" max="100" value="' + percent(settings.voice) + '"></label>'
      + '<button type="button" class="' + muteClass + '" data-audio="mute">' + muteLabel + '</button>';
  }

  function setLevel(key, percentValue) {
    if (key !== "music" && key !== "effects" && key !== "voice") return;
    const value = Number(percentValue);
    if (!Number.isFinite(value)) return;
    const previous = settings[key];
    settings[key] = clamp(value / 100, 0, 1);
    writeStore();
    for (const audio of active) {
      const entry = buses.get(audio);
      if (!entry || entry.bus !== key) continue;
      audio.volume = clamp(entry.gain * settings[key], 0, 1);
      if (settings[key] === 0) {
        audio.pause();
        active.delete(audio);
        if (currentVoice === audio) currentVoice = null;
      }
    }
    for (const name of LOOP_NAMES) {
      const audio = loops[name];
      const bus = name === "tractor" ? "effects" : "music";
      if (!audio || bus !== key) continue;
      const next = previous > 0 ? clamp(audio.volume * settings[key] / previous, 0, 1) : 0;
      audio.volume = next;
      shown[name] = next;
      if (settings[key] === 0) audio.pause();
    }
    if (!audible()) pauseAll();
  }

  function toggleMute() {
    settings.mute = !settings.mute;
    writeStore();
    if (settings.mute) pauseAll();
    return settings.mute;
  }

  setPlaybackSession();
  addEventListener("pointerdown", function () { unlock(); }, true);
  addEventListener("touchend", function () { unlock(); }, true);
  document.addEventListener("visibilitychange", function () {
    paused = document.hidden;
    if (paused) pauseAll();
  });
  addEventListener("pagehide", function () {
    paused = true;
    pauseAll();
  });
  addEventListener("pageshow", function () {
    paused = document.hidden;
    setPlaybackSession();
    if (paused) pauseAll();
  });

  const PRELOAD = ["alert", "birds", "build", "chicken", "coins", "cow", "crickets", "dog", "harvest", "kookaburra", "magpie", "plant", "rain", "sheep", "sheep-babydoll", "tractor", "wind", "voice/autumn-0", "voice/autumn-1", "voice/bus-0", "voice/cattle-0", "voice/cattle-1", "voice/cattle-2", "voice/dog-0", "voice/frost-0", "voice/frost-1", "voice/frost-2", "voice/hail-0", "voice/harvest-0", "voice/harvest-1", "voice/harvest-2", "voice/market-0", "voice/market-1", "voice/market-2", "voice/medal-0", "voice/neighbour-0", "voice/rain-0", "voice/rain-1", "voice/rain-2", "voice/spring-0", "voice/spring-1", "voice/storm-0", "voice/storm-1", "voice/storm-2", "voice/summer-0", "voice/summer-1", "voice/winter-0", "voice/winter-1"];
  if (typeof fetch === "function") {
    for (const name of PRELOAD) {
      const id = "audio:" + name;
      if (window.VELoad) VELoad.track(id);
      fetch(src(name)).then(function (res) { return res.arrayBuffer(); }).catch(function () {}).then(function () { if (window.VELoad) VELoad.settle(id); });
    }
  }
  if (window.VELoad) VELoad.seal();

  window.VEAudio = {
    unlock: unlock,
    sync: sync,
    say: say,
    sfx: sfx,
    setLevel: setLevel,
    toggleMute: toggleMute,
    settingsHtml: settingsHtml,
    settings: function () { return { music: settings.music, effects: settings.effects, voice: settings.voice, mute: settings.mute }; },
    debug: function () {
      const loopState = {};
      for (const name of LOOP_NAMES) {
        const audio = loops[name];
        loopState[name] = audio ? { paused: audio.paused, volume: audio.volume } : null;
      }
      return { unlocked: unlocked, paused: paused, settings: window.VEAudio.settings(), voice: voiceState, loops: loopState, played: played.slice() };
    },
  };
})();
