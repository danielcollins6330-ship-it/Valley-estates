(function (root) {
  const SEASONS = [
    { id: "spring", name: "Spring", phase: "Budburst", e: "🌸", voice: "spring" },
    { id: "summer", name: "Summer", phase: "Dry season", e: "☀️", voice: "summer" },
    { id: "autumn", name: "Autumn", phase: "Vintage", e: "🍂", voice: "autumn" },
    { id: "winter", name: "Winter", phase: "Pruning", e: "❄️", voice: "winter" },
  ];

  const ACHIEVEMENTS = [
    { id: "vintage", title: "First vintage", hint: "Reach autumn with a vineyard.", reward: { coins: 50 } },
    { id: "cattle10", title: "10 Speckle Park", hint: "Own 10 Speckle Park cattle.", reward: { coins: 80 } },
    { id: "valleyvilla", title: "Open Valley Villa", hint: "Build the Valley Villa.", reward: { coins: 100, food: 40 } },
    { id: "bushfire", title: "Survived a bushfire", hint: "See a bushfire burn out.", reward: { wood: 60, coins: 30 } },
  ];

  const COACH = [
    "Tour: tap a farmhand in a straw hat.",
    "Tour: tap a tree so they chop wood.",
    "Tour: tap 🔨 and build a Cottage.",
    "Tour: seasons change the work. Follow the goals.",
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function seasonInfo(season) {
    const index = ((Number(season) % 4) + 4) % 4;
    return SEASONS[index];
  }

  function freshExtras(type) {
    if (type === "paddock" || type === "broadacre") return { health: 86, condition: 72, fleece: 0, breedT: 0 };
    if (type === "cellardoor") return { guests: 0, visitT: 0 };
    if (type === "valleyvilla") return { guests: 0, stayT: 0 };
    if (type === "vineyard") return { pruned: 0, care: 0, weeds: 0 };
    if (type === "field") return { weeds: 0 };
    if (type === "olive") return { olives: 0 };
    return {};
  }

  function decorateBuilding(building) {
    const extra = freshExtras(building.type);
    for (const key of Object.keys(extra)) {
      if (building[key] == null) building[key] = extra[key];
    }
    if (building.type === "paddock" || building.type === "broadacre") {
      building.health = clamp(Number(building.health) || 0, 0, 100);
      building.condition = clamp(Number(building.condition) || 0, 0, 100);
      building.fleece = clamp(Number(building.fleece) || 0, 0, 100);
    }
    return building;
  }

  function migrateSave(game) {
    if (!game || typeof game !== "object") return game;
    game.res = game.res || {};
    if (game.res.wool == null) game.res.wool = 0;
    game.stats = game.stats || {};
    if (game.stats.tastings == null) game.stats.tastings = 0;
    if (game.stats.soldStock == null) game.stats.soldStock = 0;
    if (game.stats.survivedFire == null) game.stats.survivedFire = 0;
    game.achievements = game.achievements && typeof game.achievements === "object" ? game.achievements : {};
    if (game.coach == null) game.coach = game.tutorialSeen ? 4 : 0;
    if (game.coachTime == null) game.coachTime = game.coach >= 4 ? 180 : 0;
    if (game.res.olives == null) game.res.olives = 0;
    if (!game.market || typeof game.market !== "object") game.market = freshMarket();
    else ensureMarket(game.market);
    ensureTiers(game);
    if (game.dailyStreak == null) game.dailyStreak = 0;
    if (game.choice) game.choice = null;
    if (game.festivalYear == null) game.festivalYear = -1;
    if (game.showYear == null) game.showYear = -1;
    for (const building of game.buildings || []) {
      if (building && building.type === "villa") building.type = "valleyvilla";
      decorateBuilding(building);
    }
    if (game.achievements.villa != null) {
      if (game.achievements.valleyvilla == null) game.achievements.valleyvilla = game.achievements.villa;
      delete game.achievements.villa;
    }
    if (!game.gear || typeof game.gear !== "object") game.gear = {};
    game.order = game.order && typeof game.order === "object" && game.order.good ? game.order : null;
    if (game.nextOrder == null) game.nextOrder = 40;
    (game.units || []).forEach((unit, index) => decorateHand(unit, index));
    return game;
  }

  const NAMES = ["Ned", "Mae", "Tom", "Ada", "Jo", "Kit", "Sam", "Evie", "Gus", "Pat", "Lou", "Tess", "Hugh", "Ida", "Cal", "Bess", "Otto", "Nia", "Wes", "Rio"];
  const SKILLS = ["vines", "stock", "build"];
  const RESEARCH = [
    { id: "crush", name: "Foot Treading", branch: "Presses", age: 0, at: "homestead", requires: [], cost: { food: 30 }, time: 12, benefit: "The first press. Unlocks a basket press." },
    { id: "basket", name: "Basket Press", branch: "Presses", age: 1, at: "winery", requires: ["crush"], cost: { wood: 50, food: 40 }, time: 16, benefit: "Bottling is a little faster." },
    { id: "press", name: "Better Presses", branch: "Presses", age: 2, at: "winery", requires: ["basket"], cost: { wood: 120, coins: 40 }, time: 22, benefit: "Bottles score one step higher." },
    { id: "reserve", name: "Reserve Press", branch: "Presses", age: 3, at: "winery", requires: ["press"], cost: { stone: 80, coins: 140 }, time: 28, benefit: "Another quality step, and bottling is quicker." },
    { id: "channels", name: "Water Channels", branch: "Water", age: 0, at: "barn", requires: [], cost: { wood: 40 }, time: 12, benefit: "Fields yield a little more. Unlocks irrigation." },
    { id: "irrig", name: "Irrigation", branch: "Water", age: 1, at: "dam", requires: ["channels"], cost: { wood: 80, stone: 60 }, time: 22, benefit: "Fields and vines ignore drought." },
    { id: "drip", name: "Drip Lines", branch: "Water", age: 2, at: "dam", requires: ["irrig"], cost: { wood: 60, stone: 70 }, time: 20, benefit: "Watered crops yield a little more." },
    { id: "trough", name: "Night Watering", branch: "Water", age: 3, at: "dam", requires: ["drip"], cost: { stone: 50, coins: 80 }, time: 24, benefit: "Frost takes fewer grapes." },
    { id: "pasture", name: "Pasture Improvement", branch: "Pasture", age: 1, at: "paddock", requires: [], cost: { food: 80, wood: 30 }, time: 16, benefit: "Stock hold their condition." },
    { id: "graze", name: "Rotational Grazing", branch: "Pasture", age: 2, at: "paddock", requires: ["pasture"], cost: { food: 120, coins: 30 }, time: 20, benefit: "Paddocks produce a little more." },
    { id: "shade", name: "Shade and Troughs", branch: "Pasture", age: 3, at: "paddock", requires: ["graze"], cost: { wood: 70, stone: 40 }, time: 22, benefit: "Drought is kinder to the stock." },
    { id: "breed", name: "Selective Breeding", branch: "Genetics", age: 2, at: "paddock", requires: ["pasture"], cost: { food: 200, coins: 80 }, time: 25, benefit: "Paddocks produce more, and breeding can improve." },
    { id: "genes", name: "Breeding Genetics", branch: "Genetics", age: 3, at: "paddock", requires: ["breed"], cost: { food: 180, coins: 120 }, time: 28, benefit: "Healthy stock breed a little faster." },
  ];
  const ORDERS = [
    { good: "silver", qty: 2, reward: 110, limit: 150, label: "Silver wine" },
    { good: "wool", qty: 8, reward: 42, limit: 120, label: "Wool" },
    { good: "olives", qty: 8, reward: 24, limit: 130, label: "Olives" },
  ];

  function researchById(id) {
    return RESEARCH.find((node) => node.id === id) || null;
  }

  function researchAt(type) {
    return RESEARCH.filter((node) => node.at === type);
  }

  function researchProgress(game, id) {
    const host = ((game && game.buildings) || []).find((building) => building && building.research && building.research.id === id);
    if (!host) return null;
    const study = host.research;
    const node = researchById(id);
    const duration = Number(study.total);
    const total = Number.isFinite(duration) && duration > 0 ? duration : (node ? node.time : 1);
    const elapsed = clamp(Number(study.t) || 0, 0, total);
    return { hostId: host.id, total: total, elapsed: elapsed, progress: elapsed / total, remaining: Math.ceil(total - elapsed) };
  }

  function researchState(game, id) {
    const node = researchById(id);
    if (!node) return { ok: false, reason: "Unknown study" };
    const known = game && game.techs ? game.techs : {};
    if (known[id]) return { ok: false, reason: "Already known" };
    const active = researchProgress(game, id);
    if (active) return { ok: false, reason: "Researching: " + active.remaining + "s remaining", researching: true, progress: active.progress, remaining: active.remaining };
    for (const req of node.requires) {
      if (!known[req]) {
        const prior = researchById(req);
        return { ok: false, reason: "Needs " + (prior ? prior.name : req) };
      }
    }
    if (((game && game.age) || 0) < node.age) return { ok: false, reason: "Later age" };
    return { ok: true, reason: node.benefit };
  }

  function researchRows(game) {
    return RESEARCH.map((node) => {
      const state = researchState(game, node.id);
      return {
        id: node.id,
        name: node.name,
        branch: node.branch,
        age: node.age,
        at: node.at,
        cost: node.cost,
        time: node.time,
        benefit: node.benefit,
        known: !!(game && game.techs && game.techs[node.id]),
        researching: !!state.researching,
        progress: state.progress || 0,
        remaining: state.remaining || 0,
        ok: state.ok,
        reason: state.reason,
      };
    });
  }

  function pressTimeMul(techs) {
    const known = techs || {};
    let mul = 1;
    if (known.basket) mul *= 0.9;
    if (known.reserve) mul *= 0.88;
    return mul;
  }

  function qualityBonus(techs) {
    const known = techs || {};
    return (known.press ? 1 : 0) + (known.reserve ? 1 : 0);
  }

  function grazeMul(techs) {
    return techs && techs.graze ? 1.15 : 1;
  }

  function geneMul(techs) {
    return techs && techs.genes ? 1.2 : 1;
  }

  function channelMul(techs) {
    return techs && techs.channels ? 1.05 : 1;
  }

  function dripMul(techs) {
    return techs && techs.drip && techs.irrig ? 1.08 : 1;
  }

  function frostKeep(techs) {
    return techs && techs.trough ? 0.72 : 0.5;
  }

  const PRIORITIES = ["auto", "vines", "stock", "build"];

  function decorateHand(unit, index, skill) {
    if (!unit || typeof unit !== "object") return unit;
    if (!unit.name) unit.name = NAMES[(index | 0) % NAMES.length];
    if (SKILLS.includes(skill)) unit.skill = skill;
    if (!SKILLS.includes(unit.skill)) unit.skill = SKILLS[(index | 0) % SKILLS.length];
    if (!PRIORITIES.includes(unit.priority)) unit.priority = "auto";
    if (unit.hold == null) unit.hold = false;
    return unit;
  }

  function nextHand(units, skill) {
    const list = units || [];
    const used = new Set(list.map((unit) => unit && unit.name));
    const spare = NAMES.find((name) => !used.has(name));
    const name = spare || NAMES[list.length % NAMES.length] + " " + (list.length + 1);
    const picked = SKILLS.includes(skill) ? skill : SKILLS[list.length % SKILLS.length];
    return { name: name, skill: picked };
  }

  function setSkill(unit, skill) {
    if (!unit || !SKILLS.includes(skill)) return false;
    unit.skill = skill;
    return true;
  }

  function workSkill(unit, source) {
    if (!unit) return 1;
    if (unit.skill === "vines" && (source === "vineyard" || source === "olive")) return 1.22;
    if (unit.skill === "stock" && source === "paddock") return 1.22;
    if (unit.skill === "build" && source === "build") return 1.22;
    return 1;
  }

  function skillLabel(skill) {
    if (skill === "vines") return "Vines";
    if (skill === "stock") return "Stock";
    if (skill === "build") return "Building";
    return "Hand";
  }

  function setPriority(unit, priority) {
    if (!unit || !PRIORITIES.includes(priority)) return false;
    unit.priority = priority;
    unit.hold = false;
    return true;
  }

  function priorityLabel(priority) {
    if (priority === "auto") return "Auto";
    return skillLabel(priority);
  }

  function jobFocus(unit) {
    if (!unit) return "vines";
    if (PRIORITIES.includes(unit.priority) && unit.priority !== "auto") return unit.priority;
    return SKILLS.includes(unit.skill) ? unit.skill : "vines";
  }

  function activityLabel(unit) {
    if (!unit) return "Idle";
    if (unit.phase === "return" || (unit.task && unit.task.type === "deposit")) return "Carrying home";
    if (!unit.task) return unit.hold ? "Standing by" : "Looking for work";
    const task = unit.task;
    if (task.type === "build") return "Building";
    if (task.type === "move") return "Walking";
    if (task.type === "gather") {
      if (task.res === "wood") return "Chopping wood";
      if (task.res === "stone") return "Mining stone";
      return "Foraging";
    }
    if (task.type === "farm") {
      if (task.res === "grapes") return "Tending vines";
      if (task.res === "olives") return "Picking olives";
      if (task.res === "wool") return "Tending sheep";
      return "Tending stock";
    }
    return "Working";
  }

  function buildingDist(unit, building) {
    const x = (building.x || 0) + (building.w || 1) / 2;
    const y = (building.y || 0) + (building.h || 1) / 2;
    return Math.hypot(x - (unit.x || 0), y - (unit.y || 0));
  }

  function nearestOpen(unit, list, busy) {
    const open = list.filter((building) => !busy.has(building.id));
    const pool = open.length ? open : list;
    pool.sort((a, b) => buildingDist(unit, a) - buildingDist(unit, b));
    return pool[0] || null;
  }

  function pickJob(game, unit) {
    if (!unit || unit.task || unit.hold || (unit.carry || 0) > 0) return null;
    const focus = jobFocus(unit);
    const buildings = game && game.buildings ? game.buildings : [];
    const busy = new Set();
    for (const other of game && game.units ? game.units : []) {
      if (other && other.task && other.task.bid != null) busy.add(other.task.bid);
    }
    if (focus === "vines") {
      const vines = buildings.filter((building) => building && building.built && building.type === "vineyard" && (building.grapes || 0) >= 1);
      const olives = buildings.filter((building) => building && building.built && building.type === "olive" && (building.olives || 0) >= 1);
      const target = nearestOpen(unit, vines, busy) || nearestOpen(unit, olives, busy);
      if (!target) return null;
      return { type: "farm", bid: target.id, res: target.type === "olive" ? "olives" : "grapes" };
    }
    if (focus === "stock") {
      const pads = buildings.filter((building) => building && building.built && (building.type === "paddock" || building.type === "broadacre") && building.kind && (building.count || 0) > 0);
      const target = nearestOpen(unit, pads, busy);
      if (!target) return null;
      return { type: "farm", bid: target.id, res: target.kind === "sheep" ? "wool" : "food" };
    }
    if (focus === "build") {
      const sites = buildings.filter((building) => building && !building.built);
      const target = nearestOpen(unit, sites, busy);
      if (!target) return null;
      return { type: "build", bid: target.id };
    }
    return null;
  }

  function yearLength(seasonLen) {
    return (seasonLen || 120) * 4;
  }

  function yearIndex(time, seasonLen) {
    return Math.floor(Math.max(0, Number(time) || 0) / yearLength(seasonLen));
  }

  function festivalPhase(time, seasonLen) {
    const len = seasonLen || 120;
    const into = ((Number(time) || 0) % yearLength(len) + yearLength(len)) % yearLength(len);
    const season = Math.floor(into / len);
    const through = into % len;
    // The last hours of autumn fall at night on the 60s day cycle, so the festival
    // sits in the ripe part of vintage while the light is still up, and the
    // wine show is the morning after.
    if (season === 2 && through >= 70 && through < 90) return "festival";
    if (season === 3 && through >= 8 && through < 26) return "show";
    return null;
  }

  function showBonus(game) {
    const tiers = game && game.wineTiers ? game.wineTiers : {};
    const gold = tiers.gold | 0;
    const silver = tiers.silver | 0;
    const bronze = tiers.bronze | 0;
    const raw = gold * 48 + silver * 22 + bronze * 8;
    let place = "Crowd favourite";
    if (gold >= 1) place = "Gold medal";
    else if (silver >= 1) place = "Silver medal";
    else if (bronze >= 1) place = "Bronze mention";
    return {
      coins: raw > 0 ? Math.min(180, raw) : 20,
      tourists: Math.min(8, 2 + gold + Math.ceil(silver / 2)),
      place: place,
    };
  }

  function tickFestival(game, dt, seasonLen) {
    const phase = festivalPhase(game.time, seasonLen);
    const year = yearIndex(game.time, seasonLen);
    const notes = [];
    if (game.festivalYear == null) game.festivalYear = -1;
    if (game.showYear == null) game.showYear = -1;
    if (phase === "festival" && game.festivalYear !== year) {
      game.festivalYear = year;
      notes.push({ kind: "festival", text: "🎉 Harvest festival. Tourists are walking the vines." });
    }
    if (phase === "show" && game.showYear !== year) {
      game.showYear = year;
      const bonus = showBonus(game);
      notes.push({
        kind: "show",
        text: "🏆 Wine show: " + bonus.place + ". +" + bonus.coins + "🪙",
        coins: bonus.coins,
        place: bonus.place,
      });
    }
    const open = (game.buildings || []).some((building) => building && building.built && (building.type === "vineyard" || building.type === "cellardoor" || building.type === "valleyvilla"));
    const drip = open && phase === "festival" ? (Number(dt) || 0) * 1.6 : 0;
    return { phase: phase, drip: drip, notes: notes };
  }

  function birdBite(building, dt, scared) {
    if (scared || !building || building.type !== "vineyard") return 0;
    if ((building.grapes || 0) < 12) return 0;
    return Math.min(0.4, Math.max(0, dt) * 0.12);
  }

  function isDusk(phase) {
    return phase > 0.55 && phase < 0.78;
  }

  function rollOrder(game, rand, now) {
    const pick = ORDERS[Math.floor(rand() * ORDERS.length) % ORDERS.length];
    const age = (game && game.age) || 0;
    const extra = age >= 2 ? 1 : 0;
    const unit = Math.round(pick.reward / pick.qty);
    return {
      good: pick.good,
      qty: pick.qty + extra,
      reward: pick.reward + extra * unit + (age >= 3 ? 12 : 0),
      until: now + pick.limit,
      label: pick.label,
    };
  }

  function orderHave(game, order) {
    if (!order) return 0;
    if (order.good === "silver") return (game.wineTiers && game.wineTiers.silver) || 0;
    if (order.good === "wool") return (game.res && game.res.wool) || 0;
    if (order.good === "olives") return (game.res && game.res.olives) || 0;
    return 0;
  }

  function orderReady(game, order) {
    return !!(order && orderHave(game, order) >= order.qty && game.time <= order.until);
  }

  function deliverOrder(game) {
    const order = game && game.order;
    if (!order) return { ok: false, coins: 0, text: "No open order." };
    if (game.time > order.until) return { ok: false, coins: 0, text: "That buyer has left." };
    if (!orderReady(game, order)) return { ok: false, coins: 0, text: "Not enough " + order.label.toLowerCase() + " yet." };
    if (order.good === "silver") spendTier(game, "silver", order.qty);
    else game.res[order.good] = (game.res[order.good] || 0) - order.qty;
    game.res.coins = (game.res.coins || 0) + order.reward;
    const coins = order.reward;
    const text = order.label + " delivered. +" + coins + " coins.";
    game.order = null;
    game.nextOrder = game.time + 45;
    return { ok: true, coins: coins, text: text };
  }

  function tickOrder(game, now) {
    if (!game || !game.order) return null;
    if (now <= game.order.until) return null;
    game.order = null;
    game.nextOrder = now + 30;
    return "missed";
  }

  function a11yClasses(opts) {
    const list = [];
    if (!opts) return list;
    if (opts.text === "large") list.push("text-lg");
    else if (opts.text === "small") list.push("text-sm");
    if (opts.cb) list.push("cb");
    if (opts.lefty) list.push("lefty");
    return list;
  }

  function vineRate(season, pruned, drought) {
    if (season === 3) return 0;
    let rate = 0.35;
    if (season === 0) rate *= pruned ? 1.65 : 1.12;
    if (season === 1) rate *= drought ? 0.45 : 0.95;
    if (season === 2) rate *= 0.15;
    return rate;
  }

  function gatherRate(rate, source, season) {
    if (source !== "field" && source !== "vineyard" && source !== "paddock" && source !== "olive") return rate;
    let next = rate;
    if (season === 3) next *= source === "paddock" ? 0.75 : 0.35;
    if (season === 2 && (source === "field" || source === "vineyard" || source === "olive")) next *= 1.3;
    if (season === 0 && (source === "vineyard" || source === "olive")) next *= 1.25;
    if (season === 1 && source === "paddock") next *= 0.85;
    return next;
  }

  function tastingCoins(winePrice, hasVilla, season) {
    let coins = Math.round(Number(winePrice) * 0.92);
    if (hasVilla) coins = Math.round(coins * 1.08);
    if (season === 2) coins = Math.round(coins * 1.12);
    if (season === 3) coins = Math.round(coins * 0.62);
    return Math.max(8, coins);
  }

  function visitorGap(season) {
    if (season === 3) return 36;
    if (season === 2) return 20;
    return 26;
  }

  function tickCellar(building, dt, ctx) {
    building.visitT = (building.visitT || 0) + dt;
    if (building.visitT < visitorGap(ctx.season)) return null;
    building.visitT = 0;
    if (ctx.wine < 1) return null;
    if (ctx.season === 3 && ctx.roll > 0.35) return null;
    return { wine: 1, coins: tastingCoins(ctx.winePrice, ctx.villa, ctx.season) };
  }

  function villaRate(guests, season) {
    const busy = season === 2 ? 1.25 : season === 3 ? 0.55 : 1;
    return Math.max(0, guests) * 0.15 * busy;
  }

  function tickVilla(building, dt, ctx) {
    const coins = villaRate(building.guests || 0, ctx.season) * dt;
    building.stayT = (building.stayT || 0) + dt;
    let arrived = false;
    if (ctx.open && building.stayT >= 24) {
      building.stayT = 0;
      const cap = ctx.cellar ? 6 : 3;
      if ((building.guests || 0) < cap) {
        building.guests = (building.guests || 0) + 1;
        arrived = true;
      }
    }
    return { coins: coins, arrived: arrived };
  }

  function boostedWinePrice(price, hasVilla) {
    return hasVilla ? Math.round(price * 1.12) : price;
  }

  function tickPaddock(building, dt, ctx) {
    const notes = [];
    const tended = !!ctx.tended;
    let health = Number(building.health);
    if (!Number.isFinite(health)) health = 86;
    let condition = Number(building.condition);
    if (!Number.isFinite(condition)) condition = 72;
    let drift = tended ? 1.5 : -0.65;
    if (ctx.drought && !ctx.irrig) drift -= 2.1 * (ctx.shade ? 0.55 : 1);
    if (ctx.season === 3) drift -= 0.3;
    if (ctx.season === 1) drift -= 0.22;
    health = clamp(health + drift * dt, 0, 100);
    condition = clamp(condition + ((tended ? 1.1 : -0.45) + (health > 70 ? 0.25 : -0.15) + (ctx.pasture ? 0.35 : 0)) * dt, 0, 100);
    if (health < 32 && !building.vetWarned) {
      building.vetWarned = 1;
      notes.push({
        t: (building.kind === "sheep" ? "🐑 Babydoll sheep" : "🐄 Speckle Park cattle") + " need the vet.",
        c: "warn",
        say: building.kind === "cattle" ? "cattle" : null,
      });
    }
    if (health > 68) building.vetWarned = 0;
    if (ctx.mower) condition = clamp(condition + 0.45 * dt, 0, 100);
    if (building.kind === "sheep") {
      const grow = (ctx.season === 3 ? 0.1 : ctx.season === 0 ? 0.48 : 0.32) * (ctx.shed ? 1.45 : 1) * dt;
      building.fleece = clamp((building.fleece || 0) + grow, 0, 100);
    }
    if (ctx.mower && (building.count || 0) > 0) building.hay = (building.hay || 0) + dt * 0.08 * building.count;
    if (building.count >= 2 && building.count < stockCap(building) && health > 55 && condition > 45) {
      const genePace = typeof ctx.genes === "number" ? ctx.genes : ctx.genes ? geneMul({ genes: 1 }) : 1;
      const pace = (ctx.breedTech ? 1.4 : 1) * (ctx.season === 0 ? 1.35 : ctx.season === 3 ? 0.3 : 1) * genePace;
      building.breedT = (building.breedT || 0) + dt * pace;
      if (building.breedT >= 55 && ctx.food >= 12) {
        building.breedT = 0;
        notes.push({
          breed: true,
          food: 12,
          t: building.kind === "cattle" ? "🐄 A Speckle Park calf was born." : "🐑 A Babydoll lamb was born.",
          c: "good",
        });
      }
    }
    building.health = health;
    building.condition = condition;
    return notes;
  }

  function salePrice(kind, health, condition) {
    const base = kind === "cattle" ? 48 : 22;
    const factor = (0.4 + clamp(health, 0, 100) / 170) * (0.5 + clamp(condition, 0, 100) / 160);
    return Math.max(6, Math.round(base * factor));
  }

  function shearBales(fleece, count, baler) {
    if (fleece < 50 || count < 1) return 0;
    const bales = Math.max(1, Math.round(fleece / 50) * count);
    return baler ? Math.max(bales + 1, Math.round(bales * 1.5)) : bales;
  }

  const MARKET_BASE = { wine: 32, wool: 3, cattle: 46, lamb: 24 };
  const MARKET_MIN = { wine: 18, wool: 2, cattle: 26, lamb: 12 };
  const MARKET_MAX = { wine: 54, wool: 6, cattle: 70, lamb: 40 };
  const TIER_MULT = { bronze: 1, silver: 1.28, gold: 1.62 };
  const CHOICES = [
    {
      id: "medal",
      title: "Wine show",
      line: "The Ferguson Valley show wants a bottle.",
      voice: "medal",
      choices: [
        { id: "enter", label: "Enter a bottle", result: "The judges pinned a medal on it.", patch: { wine: -1, coins: 70 } },
        { id: "skip", label: "Keep the bottle", result: "You kept it for the cellar door.", patch: {} },
      ],
    },
    {
      id: "bus",
      title: "Tourist bus",
      line: "A tourist bus is at the gate.",
      voice: "bus",
      choices: [
        { id: "open", label: "Pour two tastings", result: "The bus paid and drank two bottles.", patch: { wine: -2, coins: 90 } },
        { id: "wave", label: "Wave them on", result: "You waved the bus through.", patch: { coins: 10 } },
      ],
    },
    {
      id: "dog",
      title: "Stray dog",
      line: "A stray dog is in the sheep paddock.",
      voice: "dog",
      choices: [
        { id: "feed", label: "Feed it and lead it out", result: "The dog followed you out. The sheep are fine.", patch: { food: -18 } },
        { id: "ignore", label: "Leave it", result: "The dog took a lamb before it left.", patch: { sheep: -1 } },
      ],
    },
    {
      id: "hail",
      title: "Hailstorm",
      line: "Hail is coming over the ridge.",
      voice: "hail",
      choices: [
        { id: "cover", label: "Cover the vines", result: "The nets held. The grapes are safe.", patch: { wood: -24 } },
        { id: "ride", label: "Ride it out", result: "Hail shredded a lot of the fruit.", patch: { grapeLoss: 0.45 } },
      ],
    },
    {
      id: "neighbour",
      title: "Neighbour",
      line: "The neighbour wants to borrow the tractor.",
      voice: "neighbour",
      choices: [
        { id: "lend", label: "Lend the tractor", result: "They brought wood and a few coins back with it.", patch: { wood: 30, coins: 25, slow: 50 } },
        { id: "refuse", label: "Need it today", result: "You kept the tractor.", patch: {} },
      ],
    },
  ];

  function freshMarket() {
    return {
      wine: MARKET_BASE.wine,
      wool: MARKET_BASE.wool,
      cattle: MARKET_BASE.cattle,
      lamb: MARKET_BASE.lamb,
      clock: 0,
      hist: {
        wine: [MARKET_BASE.wine],
        wool: [MARKET_BASE.wool],
        cattle: [MARKET_BASE.cattle],
        lamb: [MARKET_BASE.lamb],
      },
    };
  }

  function ensureMarket(market) {
    const fresh = freshMarket();
    for (const key of ["wine", "wool", "cattle", "lamb"]) {
      const value = Number(market[key]);
      market[key] = Number.isFinite(value) ? clamp(Math.round(value), MARKET_MIN[key], MARKET_MAX[key]) : fresh[key];
      if (!market.hist || typeof market.hist !== "object" || Array.isArray(market.hist)) market.hist = {};
      if (!Array.isArray(market.hist[key]) || !market.hist[key].length) market.hist[key] = [market[key]];
      market.hist[key] = market.hist[key].slice(-8);
    }
    if (!Number.isFinite(market.clock)) market.clock = 0;
    return market;
  }

  function tickMarket(market, dt, rand) {
    ensureMarket(market);
    market.clock += dt;
    if (market.clock < 18) return false;
    market.clock = 0;
    for (const key of ["wine", "wool", "cattle", "lamb"]) {
      const base = MARKET_BASE[key];
      const noise = (rand() - 0.5) * base * 0.22;
      const next = market[key] + (base - market[key]) * 0.35 + noise;
      market[key] = clamp(Math.round(next), MARKET_MIN[key], MARKET_MAX[key]);
      market.hist[key] = market.hist[key].concat(market[key]).slice(-8);
    }
    return true;
  }

  function quote(market, good) {
    ensureMarket(market);
    return market[good];
  }

  function chartHtml(market, good) {
    ensureMarket(market);
    const values = market.hist[good] || [market[good]];
    const max = Math.max.apply(null, values.concat(1));
    return values.map((value) => '<i style="height:' + Math.max(8, Math.round((value / max) * 100)) + '%"></i>').join("");
  }

  function ensureTiers(game) {
    const wine = Math.max(0, Math.floor(Number(game.res && game.res.wine) || 0));
    if (!game.wineTiers || typeof game.wineTiers !== "object") game.wineTiers = { bronze: wine, silver: 0, gold: 0 };
    for (const key of ["bronze", "silver", "gold"]) {
      game.wineTiers[key] = Math.max(0, Math.floor(Number(game.wineTiers[key]) || 0));
    }
    let sum = game.wineTiers.bronze + game.wineTiers.silver + game.wineTiers.gold;
    if (sum < wine) game.wineTiers.bronze += wine - sum;
    if (sum > wine) {
      let extra = sum - wine;
      for (const key of ["bronze", "silver", "gold"]) {
        const take = Math.min(game.wineTiers[key], extra);
        game.wineTiers[key] -= take;
        extra -= take;
      }
    }
    return game.wineTiers;
  }

  function vineScore(vine, season, drought, tended) {
    let score = 1;
    if (vine && vine.pruned && (season === 0 || season === 2)) score += 2;
    if (season === 2) score += 2;
    if (season === 1 && !drought) score += 1;
    if (drought) score -= 2;
    if (tended) score += 1;
    if (vine && (vine.care || 0) > 30) score += 1;
    return score;
  }

  function tierFromScore(score) {
    if (score >= 5) return "gold";
    if (score >= 3) return "silver";
    return "bronze";
  }

  function bottleTier(vines, season, drought, tended, bonus) {
    const list = vines && vines.length ? vines : [{}];
    const score = list.reduce((sum, vine) => sum + vineScore(vine, season, drought, tended), 0) / list.length;
    return tierFromScore(score + (Number(bonus) || 0));
  }

  function addBottle(game, tier) {
    ensureTiers(game);
    const key = TIER_MULT[tier] ? tier : "bronze";
    game.res.wine = (game.res.wine || 0) + 1;
    game.wineTiers[key] += 1;
    return key;
  }

  function spendWine(game, count, order) {
    ensureTiers(game);
    const keys = order === "best" ? ["gold", "silver", "bronze"] : ["bronze", "silver", "gold"];
    const spent = { bronze: 0, silver: 0, gold: 0 };
    let left = count;
    for (const key of keys) {
      const take = Math.min(game.wineTiers[key], left);
      game.wineTiers[key] -= take;
      spent[key] = take;
      left -= take;
    }
    const used = count - left;
    game.res.wine = Math.max(0, (game.res.wine || 0) - used);
    return spent;
  }

  function spendTier(game, tier, count) {
    ensureTiers(game);
    const key = TIER_MULT[tier] ? tier : "bronze";
    const take = Math.min(game.wineTiers[key], count);
    game.wineTiers[key] -= take;
    game.res.wine = Math.max(0, (game.res.wine || 0) - take);
    return take;
  }

  function wineSellPrice(marketPrice, tier, hasVilla) {
    const mult = TIER_MULT[tier] || 1;
    return boostedWinePrice(Math.round(Number(marketPrice) * mult), hasVilla);
  }

  function stockQuote(kind, health, condition, marketPrice) {
    const base = kind === "cattle" ? MARKET_BASE.cattle : MARKET_BASE.lamb;
    const listed = Number(marketPrice) || base;
    return Math.max(6, Math.round(salePrice(kind, health, condition) * (listed / base)));
  }

  function droughtMul(game) {
    if (game.techs && game.techs.irrig) return 1;
    let mul = 0.5;
    if (built(game, "dam")) mul = 0.72;
    if (built(game, "tank")) mul = Math.min(0.94, mul + 0.22);
    return mul;
  }

  function workMul(game) {
    let mul = built(game, "machine") ? 1.22 : 1;
    if (game.events && game.events.borrow && game.time < game.events.borrow) mul *= 0.85;
    return mul;
  }

  function tractorMul(game, source) {
    if (source !== "field" && source !== "vineyard" && source !== "olive") return 1;
    return built(game, "tractorshed") ? 1.45 : 1;
  }

  const GEAR = [
    { id: "sprayer", name: "Sprayer", age: 1, cost: { coins: 90 }, effect: "Weeds spread slower and cost less to spray off." },
    { id: "mower", name: "Hay mower", age: 1, cost: { coins: 110 }, effect: "Paddocks hold condition and drop a little hay." },
    { id: "baler", name: "Baler", age: 1, cost: { coins: 120, wood: 40 }, effect: "Shearing turns fleece into more wool." },
    { id: "seeder", name: "Seeder", age: 1, cost: { coins: 100, wood: 30 }, effect: "Wheat harvests faster and replants for less wood." },
    { id: "combine", name: "Combine harvester", age: 2, cost: { coins: 280, wood: 80, stone: 40 }, effect: "Grain comes off the wheat much faster. The Valley Empire then opens a larger paddock." },
  ];

  function gearById(id) {
    return GEAR.find((item) => item.id === id) || null;
  }

  function ownsGear(game, id) {
    return !!(game && game.gear && game.gear[id]);
  }

  function buyGear(game, id) {
    const item = gearById(id);
    if (!item) return { ok: false, text: "That attachment is not in the shed." };
    if (!built(game, "tractorshed")) return { ok: false, text: "Build the Tractor Shed first." };
    if ((game.age || 0) < item.age) return { ok: false, text: "A later age unlocks that." };
    if (ownsGear(game, id)) return { ok: false, text: item.name + " is already fitted." };
    if (!game.gear || typeof game.gear !== "object") game.gear = {};
    game.gear[id] = 1;
    return { ok: true, cost: item.cost, text: item.name + " fitted. " + item.effect };
  }

  function tickWeeds(plot, dt, ctx) {
    const pressure = ctx && ctx.pressure != null ? ctx.pressure : 1;
    const grow = (ctx && ctx.sprayer ? 0.3 : 1) * (ctx && ctx.tended ? 0.7 : 1) * pressure * 0.9;
    plot.weeds = clamp((Number(plot.weeds) || 0) + grow * dt, 0, 100);
    return plot.weeds;
  }

  function weedYield(weeds) {
    const level = clamp(Number(weeds) || 0, 0, 100);
    if (level < 18) return 1;
    return clamp(1 - (level - 18) / 150, 0.48, 1);
  }

  function weedClearCost(plot, sprayer) {
    const level = Number(plot && plot.weeds) || 0;
    if (level < 12) return 0;
    return Math.max(6, Math.round(level * 0.4 * (sprayer ? 0.4 : 1)));
  }

  function clearWeeds(plot, sprayer) {
    const cost = weedClearCost(plot, sprayer);
    if (!cost) return 0;
    plot.weeds = sprayer ? 0 : Math.max(0, (plot.weeds || 0) * 0.2);
    return cost;
  }

  function fieldMul(game) {
    let mul = ownsGear(game, "seeder") ? 1.28 : 1;
    if (ownsGear(game, "combine")) mul *= 1.85;
    return mul;
  }

  function stockCap(building) {
    return building && building.type === "broadacre" ? 14 : 8;
  }

  function seedWood(game, drill) {
    if (ownsGear(game, "seeder")) return drill ? 8 : 12;
    return drill ? 20 : 30;
  }

  function oliveRate(season, drought) {
    if (season === 3) return 0.02;
    let rate = season === 2 ? 0.11 : season === 0 ? 0.07 : 0.05;
    if (drought) rate *= 0.45;
    return rate;
  }

  function tickCare(vine, dt, tended, drought) {
    const drift = (tended ? 1.4 : -0.35) + (drought ? -1.6 : 0);
    vine.care = clamp((vine.care || 0) + drift * dt, 0, 100);
    return vine.care;
  }

  function choiceById(id) {
    return CHOICES.find((choice) => choice.id === id) || null;
  }

  function rollChoice(rand) {
    const index = Math.floor(rand() * CHOICES.length) % CHOICES.length;
    return CHOICES[index];
  }

  function canAffordPatch(game, patch) {
    if ((patch.wine || 0) < 0 && (game.res.wine || 0) < -patch.wine) return false;
    if ((patch.food || 0) < 0 && (game.res.food || 0) < -patch.food) return false;
    if ((patch.wood || 0) < 0 && (game.res.wood || 0) < -patch.wood) return false;
    return true;
  }

  function applyChoice(game, eventId, choiceId) {
    const event = choiceById(eventId);
    if (!event) return null;
    const choice = event.choices.find((item) => item.id === choiceId);
    if (!choice) return null;
    const patch = choice.patch || {};
    if (!canAffordPatch(game, patch)) return { ok: false, text: "You can't cover that just now." };
    game.res = game.res || {};
    for (const key of ["coins", "food", "wood", "wool", "olives"]) {
      if (!patch[key]) continue;
      game.res[key] = Math.max(0, (game.res[key] || 0) + patch[key]);
    }
    if (patch.wine) spendWine(game, -patch.wine, "low");
    if (patch.sheep) {
      const paddock = (game.buildings || []).find((building) => (building.type === "paddock" || building.type === "broadacre") && building.kind === "sheep" && building.count > 0);
      if (paddock) paddock.count = Math.max(0, paddock.count + patch.sheep);
    }
    if (patch.grapeLoss) {
      for (const building of game.buildings || []) {
        if (building.type === "vineyard") building.grapes = Math.max(0, (building.grapes || 0) * (1 - patch.grapeLoss));
      }
    }
    if (patch.slow) {
      game.events = game.events || {};
      game.events.borrow = (game.time || 0) + patch.slow;
    }
    return { ok: true, text: choice.result, voice: event.voice, title: event.title };
  }

  function offlineGrant(game, elapsedSec) {
    const seconds = Math.max(0, Math.min(4 * 3600, Number(elapsedSec) || 0));
    if (seconds < 90) return null;
    const guests = (game.buildings || []).reduce((sum, building) => {
      if (building.type !== "valleyvilla" || !building.built) return sum;
      return sum + (building.guests || 0);
    }, 0);
    const cellar = (game.buildings || []).some((building) => building.type === "cellardoor" && building.built) ? 1 : 0;
    const sheep = (game.buildings || []).some((building) => (building.type === "paddock" || building.type === "broadacre") && building.kind === "sheep" && building.count > 0);
    const groves = (game.buildings || []).filter((building) => building.type === "olive" && building.built).length;
    const perMin = guests * 0.05 + cellar * 0.1 + (sheep ? 0.04 : 0) + groves * 0.05;
    const coins = Math.min(160, Math.round((seconds / 60) * perMin));
    const wool = sheep ? Math.min(8, Math.floor(seconds / 500)) : 0;
    const olives = groves ? Math.min(16, Math.floor(seconds / 240) * groves) : 0;
    if (coins + wool + olives <= 0) return null;
    return { seconds: seconds, coins: coins, wool: wool, olives: olives, capped: Number(elapsedSec) > 4 * 3600 };
  }

  function applyOffline(game, grant) {
    if (!grant) return;
    game.res = game.res || {};
    game.res.coins = (game.res.coins || 0) + grant.coins;
    game.res.wool = (game.res.wool || 0) + grant.wool;
    game.res.olives = (game.res.olives || 0) + grant.olives;
  }

  function dailyReward(game, dayKey, yesterdayKey) {
    if (!dayKey || game.dailyDay === dayKey) return null;
    const streak = game.dailyDay === yesterdayKey ? (game.dailyStreak || 1) + 1 : 1;
    game.dailyDay = dayKey;
    game.dailyStreak = streak;
    const coins = Math.min(48, 10 + streak * 4);
    const food = 15 + Math.min(25, streak * 3);
    game.res = game.res || {};
    game.res.coins = (game.res.coins || 0) + coins;
    game.res.food = (game.res.food || 0) + food;
    return { streak: streak, coins: coins, food: food };
  }

  function offlineText(grant) {
    if (!grant) return "";
    const hours = Math.floor(grant.seconds / 3600);
    const mins = Math.floor((grant.seconds % 3600) / 60);
    const when = hours ? hours + "h " + mins + "m" : mins + "m";
    const bits = [];
    if (grant.coins) bits.push("+" + grant.coins + "🪙");
    if (grant.wool) bits.push("+" + grant.wool + "🧶");
    if (grant.olives) bits.push("+" + grant.olives + "🫒");
    return "While you were away (" + when + (grant.capped ? ", capped at 4h" : "") + "): " + bits.join(" ");
  }

  function built(game, type) {
    return (game.buildings || []).some((building) => building.type === type && building.built);
  }

  function cattleTotal(game) {
    return (game.buildings || []).reduce((sum, building) => {
      if ((building.type !== "paddock" && building.type !== "broadacre") || building.kind !== "cattle") return sum;
      return sum + (building.count || 0);
    }, 0);
  }

  function achievementMet(game, id) {
    if (id === "vintage") return game.season === 2 && built(game, "vineyard");
    if (id === "cattle10") return cattleTotal(game) >= 10;
    if (id === "valleyvilla") return built(game, "valleyvilla");
    if (id === "bushfire") return (game.stats && game.stats.survivedFire >= 1) || false;
    return false;
  }

  function giveReward(res, reward) {
    for (const key of Object.keys(reward)) res[key] = (res[key] || 0) + reward[key];
  }

  function rewardText(reward) {
    const names = { coins: "🪙", food: "🌾", wood: "🪵", wine: "🍷", wool: "🧶" };
    return Object.entries(reward).map(([key, value]) => "+" + value + (names[key] || key)).join(" ");
  }

  function claimAchievements(game) {
    game.achievements = game.achievements || {};
    game.res = game.res || {};
    const unlocked = [];
    for (const achievement of ACHIEVEMENTS) {
      if (game.achievements[achievement.id]) continue;
      if (!achievementMet(game, achievement.id)) continue;
      game.achievements[achievement.id] = 1;
      giveReward(game.res, achievement.reward);
      unlocked.push(achievement);
    }
    return unlocked;
  }

  function achievementHtml(game) {
    const owned = game.achievements || {};
    return ACHIEVEMENTS.map((achievement) => {
      const done = !!owned[achievement.id];
      return (done ? "🏅 " : "▫️ ") + achievement.title + (done ? " — claimed" : " — " + achievement.hint);
    }).join("<br>");
  }

  function coachHint(step) {
    if (step == null || step >= COACH.length) return "";
    return COACH[step];
  }

  function coachAdvance(game, seconds) {
    let step = game.coach | 0;
    if (step >= 4 || seconds >= 180) return 4;
    const house = (game.buildings || []).some((building) => building.type === "house");
    const wood = !!(game.stats && game.stats.wood >= 5);
    const selected = !!(game.sel && game.sel.length);
    if (step === 0 && seconds >= 8 && (selected || seconds >= 45)) step = 1;
    if (step === 1 && seconds >= 20 && (wood || seconds >= 90)) step = 2;
    if (step === 2 && seconds >= 40 && (house || seconds >= 140)) step = 3;
    if (step === 3 && seconds >= 175) step = 4;
    return step;
  }

  root.VEExpansion = {
    SEASONS: SEASONS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    seasonInfo: seasonInfo,
    migrateSave: migrateSave,
    decorateBuilding: decorateBuilding,
    vineRate: vineRate,
    gatherRate: gatherRate,
    tastingCoins: tastingCoins,
    tickCellar: tickCellar,
    tickVilla: tickVilla,
    boostedWinePrice: boostedWinePrice,
    tickPaddock: tickPaddock,
    salePrice: salePrice,
    shearBales: shearBales,
    claimAchievements: claimAchievements,
    achievementHtml: achievementHtml,
    rewardText: rewardText,
    coachHint: coachHint,
    coachAdvance: coachAdvance,
    cattleTotal: cattleTotal,
    tickMarket: tickMarket,
    quote: quote,
    chartHtml: chartHtml,
    freshMarket: freshMarket,
    vineScore: vineScore,
    tierFromScore: tierFromScore,
    bottleTier: bottleTier,
    addBottle: addBottle,
    spendWine: spendWine,
    spendTier: spendTier,
    wineSellPrice: wineSellPrice,
    stockQuote: stockQuote,
    droughtMul: droughtMul,
    workMul: workMul,
    tractorMul: tractorMul,
    GEAR: GEAR,
    gearById: gearById,
    ownsGear: ownsGear,
    buyGear: buyGear,
    tickWeeds: tickWeeds,
    weedYield: weedYield,
    weedClearCost: weedClearCost,
    clearWeeds: clearWeeds,
    fieldMul: fieldMul,
    stockCap: stockCap,
    seedWood: seedWood,
    oliveRate: oliveRate,
    tickCare: tickCare,
    rollChoice: rollChoice,
    choiceById: choiceById,
    applyChoice: applyChoice,
    offlineGrant: offlineGrant,
    applyOffline: applyOffline,
    offlineText: offlineText,
    dailyReward: dailyReward,
    RESEARCH: RESEARCH,
    researchById: researchById,
    researchAt: researchAt,
    researchProgress: researchProgress,
    researchState: researchState,
    researchRows: researchRows,
    pressTimeMul: pressTimeMul,
    qualityBonus: qualityBonus,
    grazeMul: grazeMul,
    geneMul: geneMul,
    channelMul: channelMul,
    dripMul: dripMul,
    frostKeep: frostKeep,
    decorateHand: decorateHand,
    nextHand: nextHand,
    setSkill: setSkill,
    workSkill: workSkill,
    skillLabel: skillLabel,
    setPriority: setPriority,
    priorityLabel: priorityLabel,
    jobFocus: jobFocus,
    activityLabel: activityLabel,
    pickJob: pickJob,
    yearIndex: yearIndex,
    festivalPhase: festivalPhase,
    showBonus: showBonus,
    tickFestival: tickFestival,
    birdBite: birdBite,
    isDusk: isDusk,
    rollOrder: rollOrder,
    orderHave: orderHave,
    orderReady: orderReady,
    deliverOrder: deliverOrder,
    tickOrder: tickOrder,
    a11yClasses: a11yClasses,
    CHOICES: CHOICES,
    MARKET_BASE: MARKET_BASE,
  };
})(typeof window !== "undefined" ? window : globalThis);
