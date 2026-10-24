import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const source = read('assets/entry.js'), html = read('index.html');
function classes() { const set = new Set(); return { add: k => set.add(k), remove: k => set.delete(k), contains: k => set.has(k) }; }
function dom() {
  const listeners = new Map(); const doc = { activeElement: null, documentElement: { classList: classes() }, addEventListener: (k,v) => listeners.set(k,v), removeEventListener: k => listeners.delete(k) };
  function element(tagName) { const attrs = new Map(); return { tagName, attrs, classList: classes(), style: {}, inert: false, isConnected: true, getAttribute: k => attrs.has(k) ? attrs.get(k) : null, setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k), focus() { doc.activeElement = this; } }; }
  const canvas = element('CANVAS'), modal = element('DIV'), heading = element('H1'), first = element('BUTTON'), last = element('A'), boot = element('DIV'), retry = element('BUTTON');
  const nodes = { modal, sheet: { innerHTML: '' }, 'entry-title': heading, 'entry-boot': boot, 'entry-retry': retry };
  modal.querySelectorAll = () => [first,last]; doc.getElementById = key => nodes[key]; doc.body = { classList: classes(), children: [canvas,boot,modal] }; doc.activeElement = canvas;
  const ctx = vm.createContext({ document: doc, addEventListener() {}, location: { reload() {} }, localStorage: new Proxy({}, { get() { throw Error('Entry must never access saved estate data'); } }) }); ctx.window = ctx; vm.runInContext(source, ctx);
  return { ctx, api: ctx.VEEntry, doc, canvas, modal, nodes, heading, first, last, listeners };
}
function game(speed=2, blocked=false) {
  let open=false; const nodes = { bPause: {}, modal: { style: {} } }; const ctx = vm.createContext({ speed, G: { time:0,tutorialSeen:false }, saveBlocked:blocked, recoveryCalls:0, saves:0, pendingDifficulty:'normal', $: key=>nodes[key], showSaveRecovery() { ctx.recoveryCalls++; }, save() { ctx.saves++; }, toast() {}, VEEntry:{ isOpen:()=>open, open(options) { open=true;ctx.options=options; }, close() { open=false; } } }); ctx.window=ctx;
  vm.runInContext(html.slice(html.indexOf('let entryResumeSpeed=1;'), html.indexOf('// ===================== SAVE')),ctx);
  vm.runInContext(html.slice(html.indexOf('function closeModal()'),html.indexOf('function openCrew()')),ctx);
  return ctx;
}
test('welcome has one non-destructive primary action and optional guidance', () => { const h=dom(); const welcome=h.api.renderWelcome(false); assert.match(welcome,/Start your estate/); assert.match(welcome,/How to play/); assert.match(welcome,/Offline play/); assert.match(h.api.renderWelcome(true),/Continue estate/); assert.doesNotMatch(welcome,/data-b="(?:reset|newgame)/); assert.match(welcome,/data-b="diff:easy"/); assert.match(welcome,/data-b="diff:normal"/); assert.match(welcome,/data-b="diff:hard"/); assert.doesNotMatch(h.api.renderWelcome(true),/data-b="diff:/); assert.match(welcome,/aria-label="An illustrated valley estate/); });
test('tutorial is short and re-openable, not a mandatory carousel', () => { const h=dom(); const help=h.api.renderHelp(true); assert.equal((help.match(/<li>/g)||[]).length,3); assert.match(help,/Back to your estate/); assert.match(help,/find these tips again in Menu/); assert.match(html,/data-b="entry-help"/); });
test('entry dialog isolates background controls and restores focus and prior accessibility state', () => { const h=dom(); h.canvas.setAttribute('aria-hidden','false'); h.api.open({}); assert.equal(h.canvas.inert,true); assert.equal(h.canvas.getAttribute('aria-hidden'),'true'); assert.equal(h.modal.getAttribute('aria-modal'),'true'); assert.equal(h.doc.activeElement,h.heading); h.api.close(); assert.equal(h.canvas.inert,false); assert.equal(h.canvas.getAttribute('aria-hidden'),'false'); assert.equal(h.doc.activeElement,h.canvas); assert.equal(h.listeners.has('keydown'),false); assert.equal(h.doc.documentElement.classList.contains('entry-active'),false); });
test('keyboard focus stays inside the entry and Escape has an explicit safe action', () => { const h=dom(); let escaped=0; h.api.open({onEscape:()=>escaped++}); let prevented=0; h.listeners.get('keydown')({key:'Tab',shiftKey:false,preventDefault(){prevented++;}}); assert.equal(h.doc.activeElement,h.first); h.last.focus(); h.listeners.get('keydown')({key:'Tab',shiftKey:false,preventDefault(){prevented++;}}); assert.equal(h.doc.activeElement,h.first); h.listeners.get('keydown')({key:'Escape',preventDefault(){prevented++;}}); assert.equal(escaped,1); assert.equal(prevented,3); });
test('entry pauses simulation and only marks onboarding complete after an explicit start', () => { const h=game(); h.showIntro(); assert.equal(h.speed,0); assert.equal(h.G.tutorialSeen,false); h.showIntro(true); h.finishIntro(); assert.equal(h.speed,2); assert.equal(h.G.tutorialSeen,true); assert.equal(h.saves,1); });
test('help preserves an intentionally paused estate', () => { const h=game(0); h.showIntro(true); h.finishIntro(); assert.equal(h.speed,0); });
test('save recovery cannot be bypassed by entry, help or start controls', () => { const h=game(2,true); h.showIntro(); h.finishIntro(); assert.equal(h.recoveryCalls,2); assert.equal(h.saves,0); assert.equal(h.G.tutorialSeen,false); assert.equal(h.speed,2); });
test('startup completes without an artificial delay and has an actionable non-destructive failure state', () => { const h=dom(); h.doc.body.classList.add('app-booting'); h.api.bootError(); assert.match(h.nodes['entry-boot'].innerHTML,/saved estate has not been reset/); assert.equal(typeof h.nodes['entry-retry'].onclick,'function'); h.api.finishBoot(); assert.equal(h.nodes['entry-boot'].hidden,true); assert.equal(h.doc.body.classList.contains('app-booting'),false); assert.equal(JSON.parse(read('capacitor.config.json')).plugins.SplashScreen.launchShowDuration,0); assert.doesNotMatch(source,/setTimeout|removeItem|setItem/); });
test('returning players retain automatic state restoration and recovery remains authoritative', () => { assert.match(html,/if\(!saveBlocked&&!G.tutorialSeen\)showIntro\(\)/); assert.match(html,/if\(window.VEEntry\)VEEntry.finishBoot\(\)/); assert.match(html,/function showSaveRecovery\(\).*VEEntry.close\(\)/); });
test('launch surface matches the welcome without a branded native splash', () => { const storyboard=read('ios/App/App/Base.lproj/LaunchScreen.storyboard'); assert.doesNotMatch(storyboard,/imageView|image="Splash"|<label/); assert.match(storyboard,/red="0.9568627451"/); assert.equal(JSON.parse(read('capacitor.config.json')).backgroundColor,'#f4f1e8'); });
test('entry supports safe areas, motion preference, readable scaling and minimum hit targets', () => { const css=read('assets/entry.css'); assert.match(css,/safe-area-inset-top/); assert.match(css,/safe-area-inset-bottom/); assert.match(css,/prefers-reduced-motion:reduce/); assert.match(css,/font:-apple-system-body/); assert.match(css,/min-height:52px/); assert.match(css,/min-height:44px/); assert.match(css,/overflow-y:auto/); assert.doesNotMatch(html,/user-scalable=no/); });
test('small-text and button colours meet WCAG AA contrast thresholds', () => { const rgb=hex=>hex.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); const lum=hex=>rgb(hex).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0); const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05); assert.ok(ratio('193b30','f4f1e8')>=4.5); assert.ok(ratio('57685e','f4f1e8')>=4.5); assert.ok(ratio('ffffff','193b30')>=4.5); });

test('hidden game world is not rendered or advanced during the entry flow', () => {
  const start=html.indexOf('function frame(now)');
  const frame=html.slice(start,html.indexOf("addEventListener('resize'",start));
  const ctx=vm.createContext({performance:{now:()=>0},last:0,VEEntry:{isOpen:()=>true},requestAnimationFrame(){ctx.requested=(ctx.requested||0)+1;},requested:0});ctx.window=ctx;
  vm.runInContext(frame+';frame(1000)',ctx);
  assert.equal(ctx.requested,1);assert.equal(ctx.last,1000);
});
