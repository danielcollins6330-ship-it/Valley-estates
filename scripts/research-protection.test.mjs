import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const expansion = readFileSync(new URL("../assets/expansion.js", import.meta.url), "utf8");
function harness() {
  const nodes = { sheet: { innerHTML: "", querySelectorAll: () => [] }, modal: { style: { display: "none" } } };
  const ctx = vm.createContext({ console }); ctx.window = ctx;
  vm.runInContext(expansion, ctx);
  const G = { age: 1, techs: { crush: 1 }, selB: 2, res: { wood: 200, food: 200, coins: 200 }, buildings: [
    { id: 1, type: "homestead", built: true, research: null },
    { id: 2, type: "winery", built: true, research: null },
    { id: 3, type: "winery", built: true, research: null },
    { id: 4, type: "barn", built: true, research: null },
    { id: 5, type: "barn", built: true, research: null },
  ] };
  let payments = 0;
  Object.assign(ctx, { G, B: { winery: { n: "Winery" }, homestead: { n: "Homestead" } }, TECH: { haul: { at: "barn", cost: { wood: 20 }, age: 0, time: 10 } }, AGES: [{}, { cost: { food: 50 }, time: 10, n: "Settler" }, { cost: { food: 80 }, time: 12, n: "Estate" }, { cost: { food: 100 }, time: 15, n: "Empire" }], panelDirty: false, lastPanel: "", toast() {}, renderPanel() {}, updateBar() {}, closeModal() {}, costStr: () => "cost", $: id => nodes[id], has: (game, type) => game.buildings.some(b => b.built && b.type === type) });
  ctx.canAfford = cost => Object.entries(cost).every(([key, value]) => G.res[key] >= value);
  ctx.pay = cost => { if (!ctx.canAfford(cost)) return false; payments += 1; for (const [key, value] of Object.entries(cost)) G.res[key] -= value; return true; };
  vm.runInContext(html.slice(html.indexOf("function studyDetail(row)"), html.indexOf("function showOrders()")), ctx);
  vm.runInContext(html.slice(html.indexOf("function act(a)"), html.indexOf("function showChoice(event)")), ctx);
  return { ctx, G, nodes, payments: () => payments, active: () => G.buildings.filter(b => b.research) };
}

test("farm desk repeat purchases charge once and start one study", () => {
  const h = harness(); h.ctx.startStudy("basket"); h.ctx.startStudy("basket");
  assert.equal(h.payments(), 1); assert.equal(h.active().length, 1);
  assert.equal(h.G.res.wood, 150); assert.equal(h.G.res.food, 160);
});

test("farm desk and building panel share the same duplicate guard in either order", () => {
  for (const first of ["desk", "panel"]) {
    const h = harness();
    if (first === "desk") { h.ctx.startStudy("basket"); h.G.selB = 3; h.ctx.act("tech:basket"); }
    else { h.ctx.act("tech:basket"); h.ctx.startStudy("basket"); }
    assert.equal(h.payments(), 1, first); assert.equal(h.active().length, 1, first);
  }
});

test("legacy upgrades also cannot be bought twice at different buildings", () => {
  const h = harness(); h.G.selB = 4; h.ctx.act("tech:haul"); h.G.selB = 5; h.ctx.act("tech:haul");
  assert.equal(h.payments(), 1); assert.equal(h.G.res.wood, 180); assert.equal(h.active().length, 1);
});

test("already researched studies and missing prerequisites never spend resources", () => {
  const h = harness(); h.G.techs.basket = 1;
  h.ctx.startStudy("basket"); h.ctx.act("tech:basket"); h.ctx.startStudy("genes"); h.ctx.act("tech:genes");
  assert.equal(h.payments(), 0); assert.equal(h.active().length, 0);
});

test("study progress survives a save round-trip and counts down without unlocking a duplicate", () => {
  const h = harness(); h.ctx.startStudy("basket"); h.active()[0].research.t = 4.2;
  const saved = JSON.parse(JSON.stringify(h.G));
  const progress = h.ctx.VEExpansion.researchProgress(saved, "basket");
  assert.equal(progress.remaining, 12); assert.equal(progress.progress, 4.2 / 16);
  const state = h.ctx.VEExpansion.researchState(saved, "basket");
  assert.equal(state.ok, false); assert.equal(state.researching, true); assert.match(state.reason, /12s remaining/);
  saved.buildings.find(b => b.research).research.t = 15.6;
  assert.equal(h.ctx.VEExpansion.researchProgress(saved, "basket").remaining, 1);
});

test("research sheet shows a disabled progress control then completed state", () => {
  const h = harness(); h.ctx.startStudy("basket"); h.active()[0].research.t = 8; h.ctx.showResearch();
  assert.match(h.nodes.sheet.innerHTML, /data-study-id="basket"[^>]*disabled/);
  assert.match(h.nodes.sheet.innerHTML, /Researching · 8s remaining · 50%/);
  assert.match(h.nodes.sheet.innerHTML, /data-study-progress/);
  h.G.techs.basket = 1; h.active()[0].research = null;
  const row = h.ctx.VEExpansion.researchRows(h.G).find(r => r.id === "basket");
  assert.equal(row.known, true); assert.equal(row.researching, false); assert.equal(row.ok, false);
});

test("live research refresh updates existing controls without replacing the sheet", () => {
  const h = harness(); h.ctx.startStudy("basket"); h.active()[0].research.t = 8;
  const detail = { textContent: "old" }, bar = { style: {}, firstElementChild: { style: {} } };
  const button = { dataset: { studyId: "basket" }, disabled: false, classList: { toggle() {} }, querySelector: key => key === "[data-study-detail]" ? detail : bar };
  h.nodes.sheet.querySelectorAll = () => [button]; h.nodes.modal.style.display = "flex"; h.nodes.sheet.innerHTML = "keep DOM";
  h.ctx.updateResearchSheet();
  assert.equal(button.disabled, true); assert.match(detail.textContent, /8s remaining/); assert.equal(bar.firstElementChild.style.width, "50%"); assert.equal(h.nodes.sheet.innerHTML, "keep DOM");
});

test("advance-age guard does not charge twice or crash at the final age", () => {
  const h = harness(); h.G.selB = 1; h.ctx.act("age"); h.ctx.act("age");
  assert.equal(h.payments(), 1); h.G.age = 3; h.G.buildings[0].research = null;
  assert.doesNotThrow(() => h.ctx.act("age")); assert.equal(h.payments(), 1);
});
