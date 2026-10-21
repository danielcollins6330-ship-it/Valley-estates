import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = {};
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../assets/audio-policy.js", import.meta.url), "utf8"), context);
const policy = context.VEAudioPolicy;

const parsed = policy.parseSettings({ music: 2, effects: -1, voice: "0.4", mute: true, extra: 1 });
assert.equal(parsed.music, 1);
assert.equal(parsed.effects, 0);
assert.equal(parsed.voice, 0.4);
assert.equal(parsed.mute, true);
assert.equal(policy.parseSettings(null).mute, false);
assert.equal(policy.parseSettings("nope").music, 0.7);

const morning = policy.ambienceTargets({ night: 0.05, p: 0.1, raining: false, storm: false });
assert.ok(morning.birds > 0.8);
assert.equal(morning.crickets, 0);
assert.equal(morning.rain, 0);
assert.equal(morning.morning, true);

const night = policy.ambienceTargets({ night: 0.9, p: 0.8, raining: false, storm: false });
assert.equal(night.birds, 0);
assert.ok(night.crickets > 0.5);
assert.equal(night.morning, false);

const storm = policy.ambienceTargets({ night: 0.2, p: 0.2, raining: true, storm: true });
assert.ok(storm.rain > policy.ambienceTargets({ night: 0.2, p: 0.2, raining: true, storm: false }).rain);
assert.equal(storm.birds, 0);

function played(step, id, index) {
  assert.equal(step.play && step.play.id, id);
  assert.equal(step.play && step.play.index, index);
}

let early = policy.takeVoice(policy.emptyVoice(), "harvest", 1000);
played(early, "harvest", 0);

let state = policy.emptyVoice();
let step = policy.takeVoice(state, "harvest", 100000);
played(step, "harvest", 0);
state = step.state;
step = policy.takeVoice(state, "frost", 100500);
assert.equal(step.play, null);
assert.equal(step.state.pending, "frost");
state = step.state;
step = policy.flushVoice(state, 100500 + policy.VOICE_GAP_MS);
played(step, "frost", 0);
state = step.state;
step = policy.takeVoice(state, "harvest", 200000);
played(step, "harvest", 1);
state = step.state;
step = policy.takeVoice(state, "harvest", 200000 + policy.VOICE_GAP_MS);
assert.equal(step.play, null);
step = policy.takeVoice(state, "harvest", 200000 + policy.VOICE_EVENT_GAP_MS);
played(step, "harvest", 2);
state = step.state;
step = policy.takeVoice(state, "harvest", 200000 + policy.VOICE_EVENT_GAP_MS * 3);
played(step, "harvest", 0);
assert.equal(policy.takeVoice(state, "nope", 900000).play, null);

console.log("audio-policy tests passed");
