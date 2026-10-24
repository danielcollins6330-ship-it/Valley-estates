import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function estate(seed = 12) { return { seed, time: 120, age: 1, uid: 3, cam: { x: 0, y: 0, zoom: 1 }, ter: Array(4096).fill(0), amt: Array(4096).fill(0), var: Array(4096).fill(0), explored: Array(4096).fill(1), res: { food: 200, wood: 200, stone: 60, coins: 0, grapes: 0, wine: 0 }, stats: { wood: 0, stone: 0, food: 0, trained: 0, wine: 0, coins: 0 }, techs: {}, events: {}, sel: [], season: 0, mission: 0, units: [{ id: 2, x: 24, y: 24, task: null }], buildings: [{ id: 1, type: 'homestead', built: true, x: 20, y: 20, w: 3, h: 3, queue: [], research: null }] }; }
function harness() {
  const values = new Map(), nodes = { sheet: { innerHTML: '' }, modal: { style: { display: 'none' } }, bPause: { textContent: '⏸' } }, messages = [];
  const storage = { blocked: false, failRemove: null, getItem(key) { if (this.blocked) throw new Error('restricted'); return values.get(key) ?? null; }, setItem(key, value) { if (this.blocked) throw new Error('restricted'); values.set(key, String(value)); }, removeItem(key) { if (this.blocked || this.failRemove === key) throw new Error('restricted'); values.delete(key); } };
  const ctx = vm.createContext({ console: { warn() {} }, localStorage: storage, G: estate(), uid: 3, W: 800, H: 600, TS: 32, cam: { x: 0, y: 0, zoom: 1 }, speed: 1, lastSpeed: 1, SAVE_KEY: 'valleyEstatesV4', throwRender: false, newGameCalls: 0, introCalls: 0, $: id => nodes[id], toast: (...args) => messages.push(args), clampCam() {}, centerOn() {}, markOcc() {}, renderFog() {}, setTask() {}, resize() {}, readA11y: () => ({}), applyA11y() {}, requestAnimationFrame() {}, frame() {}, VE3D: { setQuality() {} }, navigator: {} });
  ctx.window = ctx; ctx.renderMap = () => { if (ctx.throwRender) throw new Error('renderer rejected estate'); };
  ctx.newGame = () => { ctx.newGameCalls += 1; ctx.G = estate(999); ctx.G.time = 0; ctx.G.age = 0; };
  ctx.showIntro = () => { ctx.introCalls += 1; }; ctx.showOffline = () => {};
  ctx.dayKey = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  for (const file of ['../assets/expansion.js', '../assets/save-store.js']) vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), ctx);
  vm.runInContext(html.slice(html.indexOf('// ===================== SAVE ====================='), html.indexOf('// ===================== LOOP =====================')), ctx);
  vm.runInContext(html.slice(html.indexOf('function closeModal()'), html.indexOf('function openCrew()')), ctx);
  vm.runInContext(html.slice(html.indexOf('function showReset()'), html.indexOf('const A11Y_KEY')), ctx);
  return { ctx, values, storage, nodes, messages, blocked: () => vm.runInContext('saveBlocked', ctx), boot: () => vm.runInContext(html.slice(html.indexOf('resize();const initialLoad=load();'), html.indexOf('// test hooks')), ctx) };
}
const PRIMARY = 'valleyEstatesV4', BACKUP = PRIMARY + '_backup', CORRUPT = PRIMARY + '_corrupt';

test('corrupt-save startup renders recovery with a paused placeholder, not a replacement save', () => {
  const h = harness(); h.values.set(PRIMARY, 'ORIGINAL DAMAGED DATA'); h.boot();
  assert.equal(h.blocked(), true); assert.equal(h.ctx.speed, 0); assert.equal(h.ctx.newGameCalls, 1); assert.equal(h.ctx.introCalls, 0);
  assert.match(h.nodes.sheet.innerHTML, /Estate save needs attention/); assert.equal(h.nodes.modal.style.display, 'flex');
  assert.equal(h.ctx.save(), false); assert.equal(h.values.get(PRIMARY), 'ORIGINAL DAMAGED DATA');
});

test('closing or clicking outside recovery cannot bypass the save lock', () => {
  const h = harness(); h.values.set(PRIMARY, 'BAD'); h.ctx.load(); h.ctx.closeModal();
  assert.equal(h.nodes.modal.style.display, 'flex'); assert.equal(h.blocked(), true);
});

test('restore recovers the actual estate, retains damaged raw data and unlocks saving', () => {
  const h = harness(); h.values.set(PRIMARY, 'BAD'); h.values.set(BACKUP, JSON.stringify(estate(456))); h.ctx.load();
  h.ctx.handleSaveRecovery('recovery-restore');
  assert.equal(h.blocked(), false); assert.equal(h.ctx.G.seed, 456); assert.equal(h.values.get(CORRUPT), 'BAD');
  assert.equal(JSON.parse(h.values.get(PRIMARY)).seed, 456); assert.equal(h.nodes.modal.style.display, 'none');
});

test('renderer/load exceptions still enter recovery even for structurally valid JSON', () => {
  const h = harness(); const raw = JSON.stringify(estate(100)); h.values.set(PRIMARY, raw); h.values.set(BACKUP, JSON.stringify(estate(200))); h.ctx.throwRender = true;
  assert.equal(h.ctx.load(), 'recovery'); assert.equal(h.blocked(), true); assert.equal(h.values.get(PRIMARY), raw);
  h.ctx.throwRender = false; h.ctx.handleSaveRecovery('recovery-restore');
  assert.equal(h.ctx.G.seed, 200); assert.equal(h.blocked(), false); assert.equal(h.values.get(CORRUPT), raw);
});

test('unavailable device storage is not treated as a new installation', () => {
  const h = harness(); h.values.set(PRIMARY, JSON.stringify(estate())); h.storage.blocked = true; h.boot();
  assert.equal(h.blocked(), true); assert.equal(h.ctx.speed, 0); assert.match(h.nodes.sheet.innerHTML, /storage is unavailable/); assert.equal(h.ctx.save(), false);
});

test('new-estate recovery asks for confirmation before deleting any save keys', () => {
  const h = harness(); h.values.set(PRIMARY, 'BAD'); h.ctx.load(); h.ctx.handleSaveRecovery('recovery-newgame');
  assert.match(h.nodes.sheet.innerHTML, /Erase this estate and its backup/); assert.match(h.nodes.sheet.innerHTML, /newgame-yes/); assert.equal(h.values.get(PRIMARY), 'BAD');
  h.ctx.handleSaveRecovery('recovery-back'); assert.match(h.nodes.sheet.innerHTML, /Estate save needs attention/);
});

test('confirmed reset starts a fresh estate and cannot restore the previous one', () => {
  const h = harness(); h.values.set(PRIMARY, 'BAD'); h.values.set(BACKUP, JSON.stringify(estate(456))); h.ctx.load();
  assert.equal(h.ctx.resetEstate(), true); assert.equal(h.blocked(), false); assert.equal(h.ctx.G.seed, 999); assert.equal(h.values.has(CORRUPT), false);
  assert.equal(JSON.parse(h.values.get(PRIMARY)).seed, 999); assert.equal(JSON.parse(h.values.get(BACKUP)).seed, 999);
});

test('failed reset leaves the existing estate and recovery lock intact', () => {
  const h = harness(); h.values.set(PRIMARY, 'BAD'); h.values.set(BACKUP, JSON.stringify(estate())); h.ctx.load(); h.storage.failRemove = BACKUP;
  assert.equal(h.ctx.resetEstate(), false); assert.equal(h.ctx.newGameCalls, 0); assert.equal(h.values.get(PRIMARY), 'BAD'); assert.equal(h.blocked(), true);
});

test('normal first-run startup saves a usable estate and includes the recovery loader in bundles', () => {
  const h = harness(); h.boot(); assert.equal(h.blocked(), false); assert.equal(h.ctx.newGameCalls, 1); assert.equal(h.ctx.introCalls, 1);
  assert.ok(h.ctx.VESaveStore.validateSave(JSON.parse(h.values.get(PRIMARY))));
  assert.match(html, /<script src="assets\/save-store.js"><\/script>/); assert.match(html, /const dt=saveBlocked\?0:real\*speed/); assert.match(html, /addEventListener\('pagehide',save\)/);
});


test('a backup that also fails to hydrate cannot overwrite the archived original or enable autosave', () => {
  const h = harness(); h.values.set(PRIMARY, 'ORIGINAL BAD SAVE'); h.values.set(BACKUP, JSON.stringify(estate(456))); h.ctx.load(); h.ctx.throwRender = true;
  h.ctx.handleSaveRecovery('recovery-restore');
  assert.equal(h.blocked(), true); assert.equal(h.values.get(CORRUPT), 'ORIGINAL BAD SAVE'); assert.equal(h.ctx.save(), false);
  assert.doesNotMatch(h.nodes.sheet.innerHTML, /data-b="recovery-restore"/);
});
