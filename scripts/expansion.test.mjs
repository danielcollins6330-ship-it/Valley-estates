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
    { type: "villa", built: true },
  ],
};
let unlocked = expansion.claimAchievements(goals);
assert.equal(JSON.stringify([...unlocked].map((item) => item.id).sort()), JSON.stringify(["cattle10", "villa", "vintage"]));
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

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
for (const needle of ["assets/expansion.js", "cellardoor", "Bruma Villa", "yard", "migrateSave", "coachAdvance", "claimAchievements"]) {
  assert.ok(html.includes(needle), "index missing " + needle);
}
const policy = readFileSync(new URL("../assets/audio-policy.js", import.meta.url), "utf8");
for (const season of ["spring", "summer", "autumn", "winter"]) {
  assert.ok(policy.includes(season + ": 2"), "voice variants missing " + season);
}

console.log("expansion tests passed");
