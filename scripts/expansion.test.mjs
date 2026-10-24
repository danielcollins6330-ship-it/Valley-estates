import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = {};
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../assets/expansion.js", import.meta.url), "utf8"), context);
const expansion = context.VEExpansion;

const legacy = {
  tutorialSeen: true,
  season: 0,
  res: { food: 10, wood: 4, wine: 2 },
  stats: { wood: 3, wine: 1 },
  buildings: [
    { type: "homestead", built: true },
    { type: "paddock", built: true, kind: "sheep", count: 3 },
    { type: "vineyard", built: true, grapes: 20 },
  ],
};
expansion.migrateSave(legacy);
assert.equal(legacy.coach, 4);
assert.equal(legacy.res.wool, 0);
assert.equal(legacy.stats.survivedFire, 0);
assert.equal(JSON.stringify(legacy.achievements), "{}");
assert.equal(legacy.buildings[1].health, 86);
assert.equal(legacy.buildings[1].fleece, 0);
assert.equal(legacy.buildings[2].pruned, 0);
assert.equal(legacy.buildings[0].x, undefined);

const fresh = { tutorialSeen: false, buildings: [], res: {}, stats: {} };
expansion.migrateSave(fresh);
assert.equal(fresh.coach, 0);

const renamed = {
  tutorialSeen: true,
  season: 0,
  res: { coins: 0, food: 0, wood: 0 },
  stats: { survivedFire: 0 },
  achievements: { villa: 1 },
  buildings: [{ type: "villa", built: true, guests: 2 }],
};
expansion.migrateSave(renamed);
assert.equal(renamed.buildings[0].type, "valleyvilla");
assert.equal(renamed.buildings[0].guests, 2);
assert.equal(renamed.achievements.valleyvilla, 1);
assert.equal(Object.hasOwn(renamed.achievements, "villa"), false);
assert.equal(expansion.claimAchievements(renamed).length, 0);

assert.equal(expansion.seasonInfo(0).phase, "Budburst");
assert.equal(expansion.seasonInfo(1).voice, "summer");
assert.equal(expansion.seasonInfo(2).phase, "Vintage");
assert.equal(expansion.seasonInfo(3).phase, "Pruning");
assert.equal(expansion.vineRate(3, true, false), 0);
assert.ok(expansion.vineRate(0, true, false) > expansion.vineRate(0, false, false));
assert.ok(expansion.vineRate(1, false, true) < expansion.vineRate(1, false, false));
assert.ok(expansion.gatherRate(1, "field", 3) < expansion.gatherRate(1, "field", 2));

const cellar = { visitT: 0, guests: 0 };
assert.equal(expansion.tickCellar(cellar, 5, { season: 0, wine: 2, winePrice: 35, villa: false, roll: 0 }), null);
const paid = expansion.tickCellar(cellar, 20, { season: 2, wine: 2, winePrice: 35, villa: true, roll: 0 });
assert.equal(paid.wine, 1);
assert.ok(paid.coins > 35);
const winter = { visitT: 100, guests: 0 };
assert.equal(expansion.tickCellar(winter, 1, { season: 3, wine: 4, winePrice: 35, villa: false, roll: 0.9 }), null);

const villa = { guests: 0, stayT: 0 };
const quiet = expansion.tickVilla(villa, 30, { season: 0, open: false, cellar: false });
assert.equal(quiet.arrived, false);
assert.equal(villa.guests, 0);
const stay = expansion.tickVilla(villa, 24, { season: 2, open: true, cellar: true });
assert.equal(stay.arrived, true);
assert.equal(villa.guests, 1);
assert.ok(expansion.tickVilla(villa, 1, { season: 2, open: true, cellar: true }).coins > 0);
assert.ok(expansion.boostedWinePrice(35, true) > 35);
assert.equal(expansion.boostedWinePrice(35, false), 35);

const paddock = { kind: "cattle", count: 2, health: 80, condition: 70, breedT: 54, fleece: 0 };
const born = expansion.tickPaddock(paddock, 2, { tended: true, drought: false, season: 0, food: 40, breedTech: false });
assert.equal(born.some((note) => note.breed), true);
assert.equal(born.find((note) => note.breed).food, 12);
const sick = { kind: "sheep", count: 4, health: 40, condition: 40, breedT: 0, fleece: 90, vetWarned: 0 };
expansion.tickPaddock(sick, 8, { tended: false, drought: true, irrig: false, season: 1, food: 0, breedTech: false });
assert.ok(sick.health < 40);
assert.ok(sick.fleece > 90);
assert.equal(expansion.shearBales(sick.fleece, sick.count) >= 4, true);
assert.equal(expansion.shearBales(10, 3), 0);
assert.ok(expansion.salePrice("cattle", 90, 80) > expansion.salePrice("cattle", 20, 20));
assert.ok(expansion.salePrice("cattle", 80, 70) > expansion.salePrice("sheep", 80, 70));

const goals = {
  season: 2,
  res: { coins: 0, food: 0, wood: 0 },
  stats: { survivedFire: 0 },
  achievements: {},
  buildings: [
    { type: "vineyard", built: true },
    { type: "paddock", built: true, kind: "cattle", count: 6 },
    { type: "paddock", built: true, kind: "cattle", count: 4 },
    { type: "valleyvilla", built: true },
  ],
};
let unlocked = expansion.claimAchievements(goals);
assert.equal(JSON.stringify([...unlocked].map((item) => item.id).sort()), JSON.stringify(["cattle10", "valleyvilla", "vintage"]));
assert.ok(goals.res.coins >= 50 + 80 + 100);
assert.equal(expansion.claimAchievements(goals).length, 0);
goals.stats.survivedFire = 1;
goals.season = 0;
unlocked = expansion.claimAchievements(goals);
assert.equal(unlocked.length, 1);
assert.equal(unlocked[0].id, "bushfire");
assert.equal(goals.res.wood, 60);

const tour = { coach: 0, sel: [], stats: { wood: 0 }, buildings: [] };
assert.equal(expansion.coachAdvance(tour, 3), 0);
tour.sel = [1];
assert.equal(expansion.coachAdvance(tour, 10), 1);
tour.coach = 1;
tour.stats.wood = 8;
assert.equal(expansion.coachAdvance(tour, 25), 2);
tour.coach = 2;
tour.buildings = [{ type: "house" }];
assert.equal(expansion.coachAdvance(tour, 50), 3);
tour.coach = 3;
assert.equal(expansion.coachAdvance(tour, 180), 4);
assert.ok(expansion.coachHint(0).includes("farmhand"));
assert.equal(expansion.coachHint(4), "");

const market = expansion.freshMarket();
const startWine = market.wine;
let steps = 0;
for (let i = 0; i < 8; i += 1) {
  if (expansion.tickMarket(market, 20, () => 0.1 + i * 0.1)) steps += 1;
}
assert.equal(steps, 8);
for (const good of ["wine", "wool", "cattle", "lamb"]) {
  assert.ok(market[good] >= 1, good);
  assert.equal(market.hist[good].length <= 8, true);
}
assert.ok(market.wine !== startWine || market.hist.wine.length > 1);
assert.ok(expansion.chartHtml(market, "wine").includes("height:"));

const tiers = { res: { wine: 4 }, wineTiers: null };
expansion.migrateSave(tiers);
assert.equal(tiers.wineTiers.bronze, 4);
assert.equal(tiers.res.olives, 0);
const cared = { pruned: 1, care: 40 };
assert.equal(expansion.bottleTier([cared], 2, false, true), "gold");
assert.equal(expansion.bottleTier([{ pruned: 0, care: 0 }], 3, true, false), "bronze");
assert.ok(expansion.wineSellPrice(32, "gold", true) > expansion.wineSellPrice(32, "silver", true));
assert.ok(expansion.wineSellPrice(32, "silver", false) > expansion.wineSellPrice(32, "bronze", false));
const cellarPay = expansion.tastingCoins(32, true, 2);
assert.ok(cellarPay < expansion.wineSellPrice(32, "gold", true));
const stock = { res: { wine: 2 }, wineTiers: { bronze: 0, silver: 1, gold: 1 } };
expansion.addBottle(stock, "bronze");
assert.equal(stock.res.wine, 3);
assert.equal(stock.wineTiers.bronze, 1);
expansion.spendWine(stock, 1, "low");
assert.equal(stock.wineTiers.bronze, 0);
assert.equal(stock.wineTiers.gold, 1);

const dry = { techs: {}, buildings: [] };
assert.ok(expansion.droughtMul(dry) < expansion.droughtMul({ techs: {}, buildings: [{ type: "dam", built: true }] }));
assert.ok(expansion.droughtMul({ techs: {}, buildings: [{ type: "dam", built: true }, { type: "tank", built: true }] }) > 0.85);
assert.equal(expansion.droughtMul({ techs: { irrig: 1 }, buildings: [] }), 1);
assert.ok(expansion.workMul({ buildings: [{ type: "machine", built: true }], time: 0, events: {} }) > 1);
assert.equal(expansion.tractorMul({ buildings: [] }, "vineyard"), 1);
assert.ok(expansion.tractorMul({ buildings: [{ type: "tractorshed", built: true }] }, "field") > 1.4);
assert.ok(expansion.tractorMul({ buildings: [{ type: "tractorshed", built: true }] }, "vineyard") > 1.4);
assert.equal(expansion.tractorMul({ buildings: [{ type: "tractorshed", built: true }] }, "paddock"), 1);
assert.equal(expansion.tractorMul({ buildings: [{ type: "tractorshed", built: false }] }, "olive"), 1);
assert.ok(expansion.oliveRate(2, false) > expansion.oliveRate(2, true));
assert.ok(expansion.oliveRate(3, false) < expansion.oliveRate(0, false));

const sheep = { kind: "sheep", count: 3, health: 80, condition: 70, breedT: 0, fleece: 10, vetWarned: 0 };
expansion.tickPaddock(sheep, 10, { tended: true, drought: false, season: 0, food: 0, breedTech: false, shed: true });
const plain = { kind: "sheep", count: 3, health: 80, condition: 70, breedT: 0, fleece: 10, vetWarned: 0 };
expansion.tickPaddock(plain, 10, { tended: true, drought: false, season: 0, food: 0, breedTech: false, shed: false });
assert.ok(sheep.fleece > plain.fleece);

const eventGame = {
  time: 10,
  res: { wine: 2, coins: 0, food: 40, wood: 10, wool: 0, olives: 0 },
  wineTiers: { bronze: 2, silver: 0, gold: 0 },
  buildings: [
    { type: "vineyard", built: true, grapes: 40 },
    { type: "paddock", built: true, kind: "sheep", count: 3 },
  ],
  events: {},
};
assert.equal(expansion.applyChoice(eventGame, "medal", "enter").ok, true);
assert.equal(eventGame.res.wine, 1);
assert.equal(eventGame.res.coins, 70);
assert.equal(expansion.applyChoice(eventGame, "hail", "ride").ok, true);
assert.ok(eventGame.buildings[0].grapes < 40);
assert.equal(expansion.applyChoice(eventGame, "dog", "ignore").ok, true);
assert.equal(eventGame.buildings[1].count, 2);
assert.equal(expansion.applyChoice({ res: { wine: 0, food: 0, wood: 0 }, wineTiers: { bronze: 0, silver: 0, gold: 0 }, buildings: [] }, "medal", "enter").ok, false);
const rolled = expansion.rollChoice(() => 0);
assert.equal(rolled.id, expansion.CHOICES[0].id);

const away = {
  buildings: [
    { type: "valleyvilla", built: true, guests: 4 },
    { type: "cellardoor", built: true },
    { type: "olive", built: true },
    { type: "paddock", built: true, kind: "sheep", count: 2 },
  ],
};
assert.equal(expansion.offlineGrant(away, 30), null);
const grant = expansion.offlineGrant(away, 3 * 3600);
assert.ok(grant.coins > 0 && grant.coins <= 160);
assert.ok(grant.olives > 0);
const capped = expansion.offlineGrant(away, 20 * 3600);
assert.equal(capped.capped, true);
assert.ok(capped.seconds <= 4 * 3600);
assert.ok(expansion.offlineText(grant).includes("While you were away"));
const purse = { res: { coins: 1, wool: 0, olives: 0 } };
expansion.applyOffline(purse, grant);
assert.ok(purse.res.coins > 1);

const daily = { res: { coins: 0, food: 0 } };
const first = expansion.dailyReward(daily, "2026-10-22", "2026-10-21");
assert.equal(first.streak, 1);
assert.equal(expansion.dailyReward(daily, "2026-10-22", "2026-10-21"), null);
const next = expansion.dailyReward(daily, "2026-10-23", "2026-10-22");
assert.equal(next.streak, 2);
assert.ok(next.coins > first.coins);
const broken = { res: { coins: 0, food: 0 }, dailyDay: "2026-10-01", dailyStreak: 6 };
assert.equal(expansion.dailyReward(broken, "2026-10-22", "2026-10-21").streak, 1);

const activeWine = expansion.wineSellPrice(32, "bronze", false) * 2;
const tastingPerMin = expansion.tastingCoins(32, true, 2) * (60 / 26);
assert.ok(tastingPerMin < activeWine * 1.4);
const livestockPerMin = expansion.stockQuote("cattle", 80, 70, 46) * (60 / 70);
assert.ok(livestockPerMin < activeWine);
assert.ok(expansion.oliveRate(2, false) * 60 / 8 * expansion.quote(expansion.freshMarket(), "wine") < activeWine * 8);

const ages = new Set(expansion.RESEARCH.map((node) => node.age));
assert.equal(JSON.stringify([...ages].sort()), JSON.stringify([0, 1, 2, 3]));
for (const branch of ["Presses", "Water", "Pasture", "Genetics"]) {
  assert.ok(expansion.RESEARCH.some((node) => node.branch === branch), branch);
}
assert.equal(expansion.researchState({ age: 0, techs: {} }, "crush").ok, true);
assert.equal(expansion.researchState({ age: 0, techs: {} }, "basket").reason, "Needs Foot Treading");
assert.equal(expansion.researchState({ age: 0, techs: { crush: 1 } }, "basket").reason, "Later age");
assert.equal(expansion.researchState({ age: 1, techs: {} }, "irrig").ok, false);
assert.equal(expansion.researchState({ age: 1, techs: { channels: 1 } }, "irrig").ok, true);
assert.equal(expansion.researchState({ age: 2, techs: {} }, "genes").ok, false);
assert.equal(expansion.researchState({ age: 3, techs: { pasture: 1, breed: 1 } }, "genes").ok, true);
assert.equal(expansion.researchState({ age: 3, techs: { irrig: 1 } }, "irrig").reason, "Already known");
assert.equal(expansion.qualityBonus({ press: 1, reserve: 1 }), 2);
const press = expansion.pressTimeMul({ basket: 1, reserve: 1 });
assert.ok(press > 0.7 && press < 1);
assert.ok(expansion.geneMul({ genes: 1 }) <= 1.25);
assert.ok(expansion.grazeMul({ graze: 1 }) <= 1.2);
assert.equal(expansion.frostKeep({}), 0.5);
assert.equal(expansion.frostKeep({ trough: 1 }), 0.72);
assert.equal(expansion.dripMul({ drip: 1 }), 1);
assert.equal(expansion.dripMul({ drip: 1, irrig: 1 }), 1.08);
assert.equal(expansion.channelMul({ channels: 1 }), 1.05);
const lowVines = [{ pruned: 0, care: 0 }];
assert.equal(expansion.bottleTier(lowVines, 1, true, false, 0), "bronze");
assert.equal(expansion.bottleTier(lowVines, 1, true, false, 4), "silver");

const hands = expansion.nextHand([], "vines");
const second = expansion.nextHand([{ name: hands.name }], "stock");
assert.notEqual(hands.name, second.name);
assert.equal(hands.skill, "vines");
assert.equal(expansion.setSkill({ skill: "vines" }, "pilot"), false);
assert.equal(expansion.workSkill({ skill: "vines" }, "vineyard"), 1.22);
assert.equal(expansion.workSkill({ skill: "vines" }, "olive"), 1.22);
assert.equal(expansion.workSkill({ skill: "vines" }, "paddock"), 1);
assert.equal(expansion.workSkill({ skill: "stock" }, "paddock"), 1.22);
assert.equal(expansion.workSkill({ skill: "build" }, "build"), 1.22);
assert.equal(expansion.birdBite({ type: "vineyard", grapes: 20 }, 1, true), 0);
assert.equal(expansion.birdBite({ type: "vineyard", grapes: 10 }, 1, false), 0);
const bite = expansion.birdBite({ type: "vineyard", grapes: 20 }, 1, false);
assert.ok(bite > 0 && bite <= 0.4);
assert.equal(expansion.isDusk(0.6), true);
assert.equal(expansion.isDusk(0.4), false);
assert.equal(expansion.isDusk(0.9), false);

const earlyOrder = expansion.rollOrder({ age: 0 }, () => 0, 20);
assert.equal(earlyOrder.good, "silver");
assert.equal(earlyOrder.qty, 2);
assert.equal(earlyOrder.reward, 110);
const lateOrder = expansion.rollOrder({ age: 3 }, () => 0, 20);
assert.equal(lateOrder.qty, 3);
const silverPrice = expansion.wineSellPrice(32, "silver", false);
assert.ok(lateOrder.reward > silverPrice * lateOrder.qty);
assert.ok(lateOrder.reward < silverPrice * lateOrder.qty * 1.6);
const woolOrder = expansion.rollOrder({ age: 3 }, () => 0.4, 0);
assert.equal(woolOrder.good, "wool");
assert.ok(woolOrder.reward < 6 * woolOrder.qty * 2);
const cellarOrder = {
  time: 10,
  res: { coins: 0, wine: 2, wool: 0, olives: 0 },
  wineTiers: { bronze: 0, silver: 2, gold: 0 },
  order: { good: "silver", qty: 2, reward: 110, until: 50, label: "Silver wine" },
};
assert.equal(expansion.deliverOrder(cellarOrder).ok, true);
assert.equal(cellarOrder.res.coins, 110);
assert.equal(cellarOrder.wineTiers.silver, 0);
assert.equal(cellarOrder.order, null);
assert.equal(cellarOrder.nextOrder, 55);
const shortOrder = {
  time: 10,
  res: { coins: 5, wine: 0 },
  wineTiers: { bronze: 0, silver: 0, gold: 0 },
  order: { good: "silver", qty: 2, reward: 110, until: 50, label: "Silver wine" },
};
assert.equal(expansion.deliverOrder(shortOrder).ok, false);
assert.equal(shortOrder.res.coins, 5);
const missed = {
  time: 80,
  res: { wine: 2 },
  wineTiers: { bronze: 0, silver: 2, gold: 0 },
  order: { good: "silver", qty: 2, reward: 110, until: 40, label: "Silver wine" },
};
assert.equal(expansion.tickOrder(missed, 80), "missed");
assert.equal(missed.order, null);
assert.equal(missed.wineTiers.silver, 2);
assert.equal(JSON.stringify(expansion.a11yClasses({ text: "large", cb: true, lefty: true })), JSON.stringify(["text-lg", "cb", "lefty"]));

const namedSave = {
  tutorialSeen: true,
  res: { wine: 1 },
  stats: {},
  buildings: [{ type: "villa", built: true }],
  units: [{ id: 1 }, { id: 2, skill: "nope" }],
  order: { qty: 1 },
};
expansion.migrateSave(namedSave);
assert.equal(namedSave.units[0].name, "Ned");
assert.equal(namedSave.units[0].skill, "vines");
assert.equal(namedSave.units[0].priority, "auto");
assert.equal(namedSave.units[0].hold, false);
assert.equal(namedSave.units[1].name, "Mae");
assert.equal(namedSave.units[1].skill, "stock");
assert.equal(namedSave.festivalYear, -1);
assert.equal(namedSave.showYear, -1);
assert.equal(namedSave.order, null);
assert.equal(namedSave.nextOrder, 40);
assert.equal(namedSave.buildings[0].type, "valleyvilla");
const keptOrder = { tutorialSeen: true, res: { wine: 0 }, stats: {}, buildings: [], units: [], order: { good: "wool", qty: 8, reward: 42, until: 10, label: "Wool" }, nextOrder: 12 };
expansion.migrateSave(keptOrder);
assert.equal(keptOrder.order.good, "wool");
assert.equal(keptOrder.nextOrder, 12);

const idleHand = { skill: "vines", priority: "auto", hold: false, x: 0, y: 0, carry: 0 };
assert.equal(expansion.activityLabel(idleHand), "Looking for work");
assert.equal(expansion.activityLabel({ hold: true }), "Standing by");
assert.equal(expansion.activityLabel({ task: { type: "farm", res: "grapes" }, phase: "work" }), "Tending vines");
assert.equal(expansion.activityLabel({ task: { type: "farm", res: "wool" }, phase: "return" }), "Carrying home");
assert.equal(expansion.setPriority(idleHand, "pilot"), false);
assert.equal(expansion.setPriority(idleHand, "stock"), true);
assert.equal(idleHand.priority, "stock");
assert.equal(expansion.jobFocus(idleHand), "stock");
idleHand.priority = "auto";
assert.equal(expansion.jobFocus(idleHand), "vines");
const yard = {
  units: [idleHand, { task: { bid: 2 } }],
  buildings: [
    { id: 1, type: "vineyard", built: true, grapes: 20, x: 4, y: 1, w: 2, h: 2 },
    { id: 2, type: "vineyard", built: true, grapes: 40, x: 1, y: 1, w: 2, h: 2 },
    { id: 3, type: "paddock", built: true, kind: "sheep", count: 3, x: 8, y: 2, w: 3, h: 3 },
    { id: 4, type: "paddock", built: true, kind: "cattle", count: 2, x: 2, y: 8, w: 3, h: 3 },
    { id: 5, type: "house", built: false, x: 6, y: 6, w: 2, h: 2 },
    { id: 6, type: "olive", built: true, olives: 0, x: 0, y: 9, w: 2, h: 2 },
  ],
};
assert.equal(expansion.pickJob(yard, idleHand).bid, 1);
assert.equal(expansion.pickJob(yard, idleHand).res, "grapes");
idleHand.priority = "stock";
assert.equal(expansion.pickJob(yard, idleHand).res, "wool");
assert.equal(expansion.pickJob(yard, idleHand).bid, 3);
idleHand.priority = "build";
assert.equal(expansion.pickJob(yard, idleHand).type, "build");
assert.equal(expansion.pickJob(yard, idleHand).bid, 5);
idleHand.hold = true;
assert.equal(expansion.pickJob(yard, idleHand), null);
idleHand.hold = false;
idleHand.task = { type: "move" };
assert.equal(expansion.pickJob(yard, idleHand), null);
assert.equal(expansion.festivalPhase(100, 120), null);
assert.equal(expansion.festivalPhase(300, 120), null);
assert.equal(expansion.festivalPhase(320, 120), "festival");
assert.equal(expansion.festivalPhase(372, 120), "show");
assert.equal(expansion.festivalPhase(800, 120), "festival");
assert.equal(expansion.yearIndex(800, 120), 1);
const emptyShow = expansion.showBonus({ wineTiers: { bronze: 0, silver: 0, gold: 0 } });
assert.equal(emptyShow.coins, 20);
assert.equal(emptyShow.place, "Crowd favourite");
const goldShow = expansion.showBonus({ wineTiers: { bronze: 0, silver: 0, gold: 1 } });
assert.equal(goldShow.place, "Gold medal");
assert.equal(goldShow.coins, 48);
const cappedShow = expansion.showBonus({ wineTiers: { bronze: 0, silver: 0, gold: 10 } });
assert.equal(cappedShow.coins, 180);
const festGame = {
  time: 320,
  festivalYear: -1,
  showYear: -1,
  wineTiers: { bronze: 1, silver: 1, gold: 0 },
  buildings: [{ type: "vineyard", built: true }],
};
const opened = expansion.tickFestival(festGame, 2, 120);
assert.equal(opened.phase, "festival");
assert.equal(opened.notes.length, 1);
assert.ok(opened.drip > 0);
assert.equal(expansion.tickFestival(festGame, 2, 120).notes.length, 0);
festGame.time = 372;
const judged = expansion.tickFestival(festGame, 1, 120);
assert.equal(judged.phase, "show");
assert.equal(judged.notes[0].place, "Silver medal");
assert.equal(judged.notes[0].coins, 30);
assert.equal(expansion.tickFestival(festGame, 1, 120).notes.length, 0);

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.equal(html.includes("hctx.fillText(text,item.sx"), false);
assert.ok(html.includes("VEExpansion.activityLabel(u)"));
for (const needle of ["assets/expansion.js", "assets/haptics.js", "cellardoor", "Valley Villa", "yard", "olive", "sellwine", "migrateSave", "coachAdvance", "claimAchievements", "Erase this estate", "Colour-blind icons", "Farmhands", "bCrew", "Four ages", "Harvest festival", "Wine show", "Tractor Shed"]) {
  assert.ok(html.includes(needle), "index missing " + needle);
}
const bannedNames = ["bru" + "ma", "little " + "ridge"];
for (const file of ["../index.html", "../assets/expansion.js", "../game3d.js", "../README.md", "../scripts/play-round3.mjs"]) {
  const text = readFileSync(new URL(file, import.meta.url), "utf8").toLowerCase();
  for (const word of bannedNames) assert.equal(text.includes(word), false, file + " contains a real property name");
}
const policy = readFileSync(new URL("../assets/audio-policy.js", import.meta.url), "utf8");
for (const season of ["spring", "summer", "autumn", "winter"]) {
  assert.ok(policy.includes(season + ": 2"), "voice variants missing " + season);
}

console.log("expansion tests passed");
