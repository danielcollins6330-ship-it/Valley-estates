import { test } from 'node:test';
import assert from 'node:assert/strict';
import store from '../assets/save-store.js';

export class MemoryStorage {
  constructor() { this.values = new Map(); this.failRead = false; this.failWrite = null; this.failRemove = null; }
  getItem(key) { if (this.failRead) throw new Error('read blocked'); return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.failWrite === key || this.failWrite === '*') throw new Error('quota'); this.values.set(key, String(value)); }
  removeItem(key) { if (this.failRemove === key) throw new Error('remove blocked'); this.values.delete(key); }
}
export function estate(overrides = {}) {
  return { seed: 12, time: 120, age: 1, uid: 3, cam: { x: 0, y: 0, zoom: 1 }, ter: Array(4096).fill(0), amt: Array(4096).fill(0), var: Array(4096).fill(0), explored: Array(4096).fill(1), res: { food: 200, wood: 200, stone: 60, coins: 0, grapes: 0, wine: 0 }, stats: { wood: 0, stone: 0, food: 0, trained: 0, wine: 0, coins: 0 }, techs: {}, events: {}, sel: [], season: 0, mission: 0, units: [{ id: 2, x: 24, y: 24, task: null, carry: 0 }], buildings: [{ id: 1, type: 'homestead', built: true, x: 20, y: 20, w: 3, h: 3, queue: [], research: null }], ...overrides };
}
const keys = store.getKeys();

test('current and legacy V4 estates validate without requiring new expansion-only fields', () => {
  assert.equal(store.validateSave(estate()), true);
  assert.equal(store.validateSave(estate({ buildings: [{ id: 1, type: 'villa', x: 20, y: 20, w: 4, h: 3, queue: [], research: null }] })), true);
  for (const patch of [{ ter: [] }, { var: null }, { explored: [1] }, { units: null }, { buildings: [] }, { buildings: [null] }, { cam: null }, { time: NaN }, { res: {} }, { stats: {} }]) assert.equal(store.validateSave(estate(patch)), false, JSON.stringify(patch));
});

test('normal saves retain the previous valid estate as backup', () => {
  const storage = new MemoryStorage();
  assert.equal(store.save(estate({ time: 100 }), storage).success, true);
  assert.equal(store.save(estate({ time: 120 }), storage).success, true);
  assert.equal(JSON.parse(storage.getItem(keys.primary)).time, 120);
  assert.equal(JSON.parse(storage.getItem(keys.backup)).time, 100);
});

test('corrupt primary requires a choice and stays unchanged until explicit restore', () => {
  const storage = new MemoryStorage(); store.save(estate(), storage); storage.setItem(keys.primary, '{truncated');
  const result = store.load(storage);
  assert.equal(result.status, 'backup_available'); assert.equal(result.choiceRequired, true); assert.equal(result.backupData.time, 120);
  assert.equal(storage.getItem(keys.primary), '{truncated'); assert.equal(storage.getItem(keys.corrupt), '{truncated');
  assert.equal(store.restoreBackup(storage).success, true); assert.equal(store.load(storage).status, 'ok'); assert.equal(store.getDamagedSave(storage), '{truncated');
});

test('corrupt primary without backup cannot be silently overwritten by an autosave', () => {
  const storage = new MemoryStorage(); storage.setItem(keys.primary, 'BROKEN');
  assert.equal(store.load(storage).status, 'recovery_required');
  assert.equal(store.save(estate(), storage).reason, 'recovery_required');
  assert.equal(storage.getItem(keys.primary), 'BROKEN'); assert.equal(store.getDamagedSave(storage), 'BROKEN');
});

test('missing primary with either valid or damaged backup requires recovery, not a fresh estate', () => {
  for (const backup of [JSON.stringify(estate()), 'BAD BACKUP', '']) {
    const storage = new MemoryStorage(); storage.setItem(keys.backup, backup);
    assert.equal(store.load(storage).choiceRequired, true);
    assert.equal(store.save(estate(), storage).reason, 'recovery_required');
    assert.equal(storage.getItem(keys.backup), backup); assert.equal(storage.getItem(keys.primary), null);
  }
});

test('an empty stored primary is damaged data rather than proof of a new installation', () => {
  const storage = new MemoryStorage(); storage.setItem(keys.primary, '');
  assert.equal(store.load(storage).status, 'recovery_required'); assert.equal(store.load(new MemoryStorage()).status, 'empty');
});

test('invalid in-memory saves cannot replace good primary or backup', () => {
  const storage = new MemoryStorage(); store.save(estate(), storage);
  const before = [...storage.values]; assert.equal(store.save(estate({ ter: [] }), storage).success, false);
  assert.deepEqual([...storage.values], before);
});

test('backup quota failures preserve the prior primary and report failure', () => {
  const storage = new MemoryStorage(); store.save(estate({ time: 100 }), storage); storage.failWrite = keys.backup;
  const result = store.save(estate({ time: 120 }), storage);
  assert.equal(result.success, false); assert.equal(result.reason, 'backup_write_failed');
  assert.equal(JSON.parse(storage.getItem(keys.primary)).time, 100);
});

test('primary write failures leave a recoverable last-known-good backup', () => {
  const storage = new MemoryStorage(); store.save(estate({ time: 100 }), storage); storage.failWrite = keys.primary;
  assert.equal(store.save(estate({ time: 120 }), storage).success, false);
  assert.equal(JSON.parse(storage.getItem(keys.backup)).time, 100);
});

test('read failures and unavailable storage enter recovery instead of reporting an empty game', () => {
  const storage = new MemoryStorage(); storage.failRead = true;
  assert.equal(store.load(storage).status, 'storage_error'); assert.equal(store.load(storage).choiceRequired, true);
  assert.equal(store.save(estate(), storage).success, false);
  assert.equal(store.load(null).status, 'no_storage'); assert.equal(store.load(null).choiceRequired, true);
});

test('restore refuses to destroy original data when the damage archive cannot be written', () => {
  const storage = new MemoryStorage(); store.save(estate(), storage); storage.setItem(keys.primary, 'DAMAGED'); storage.failWrite = keys.corrupt;
  assert.equal(store.restoreBackup(storage).reason, 'archive_failed'); assert.equal(storage.getItem(keys.primary), 'DAMAGED');
});

test('confirmed reset clears primary and all recovery keys without resurrecting the old estate', () => {
  const storage = new MemoryStorage(); store.save(estate(), storage); storage.setItem(keys.corrupt, 'old damage'); storage.setItem('valleyEstatesAudio', 'keep settings');
  assert.equal(store.resetSave(storage).success, true); assert.equal(store.load(storage).status, 'empty');
  for (const key of Object.values(keys)) assert.equal(storage.getItem(key), null);
  assert.equal(storage.getItem('valleyEstatesAudio'), 'keep settings');
});

test('a reset deletion failure retains the primary and does not report success', () => {
  const storage = new MemoryStorage(); store.save(estate(), storage); storage.failRemove = keys.backup;
  assert.equal(store.resetSave(storage).success, false); assert.ok(storage.getItem(keys.primary));
});

test('recovery UI offers restore/export/retry without claiming an archive write always succeeded', () => {
  const html = store.buildRecoveryModalHTML({ status: 'backup_available', backupData: estate(), damagedRaw: 'bad' });
  assert.match(html, /recovery-restore/); assert.match(html, /recovery-export/); assert.match(html, /recovery-retry/); assert.match(html, /recovery-newgame/);
  const unavailable = store.buildRecoveryModalHTML({ status: 'storage_error' }); assert.doesNotMatch(unavailable, /recovery-newgame/);
});
