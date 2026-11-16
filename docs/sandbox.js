/* =============================================================================
   ESPELHO DO MOTOR — sandbox de verificação da etapa 2
   -----------------------------------------------------------------------------
   Este ficheiro duplica, de forma consciente e temporária, a lógica de
   src/lib/game/{balance,formulas,rng,combat}.ts porque o sandbox corre como
   ficheiro estático (sem bundler, logo sem resolução do alias `@/`).

   REGRA: a fonte de verdade é SEMPRE src/lib/game/*.ts. Se este ficheiro
   divergir, o errado é este. A integração real (etapa 7) consome o módulo
   TypeScript directamente.
   ========================================================================== */

/* ------------------------------------------------------------------ BALANCE */
const BALANCE = {
  combat: { tickIntervalSec: 1 / 60, maxCatchUpSteps: 240, aoeDamageCapPct: 0.4, maxEventsPerTick: 64 },
  stats: {
    atk: { strFlat: 1, strQuadraticDivisor: 10, dexDivisor: 5, lukDivisor: 5, refineBonusPct: 0.05 },
    matk: { intFlat: 1, intQuadraticDivisor: 7, refineBonusPct: 0.05 },
    hitChance: { basePct: 0.8, minPct: 0.05, maxPct: 1 },
    flee: { maxPct: 0.95, penaltyPerExtraAttacker: 0.1 },
    crit: { base: 1, lukMultiplier: 0.3, maxPct: 1, damageMultiplier: 1.4 },
    attackSpeed: { agiPct: 0.01, dexPct: 0.002, maxAttacksPerSec: 2.5 },
    softDef: { k: 100 },
  },
  elementAffinity: {
    fire: { earth: 1.5, water: 0.5, wind: 1.25, plant: 1.5 },
    water: { fire: 1.5, earth: 1.25, wind: 0.5 },
    earth: { wind: 1.5, fire: 0.5, water: 1.25 },
    wind: { water: 1.5, earth: 0.5, fire: 1.25 },
    holy: { dark: 1.5, undead: 1.5 },
    dark: { holy: 1.5 },
    poison: { plant: 1.5, humanoid: 1.25 },
    neutral: {},
  },
  weaponSizeModifier: {
    dagger: { small: 1, medium: 0.75, large: 0.5 },
    sword: { small: 0.75, medium: 1, large: 0.75 },
    spear: { small: 0.75, medium: 0.75, large: 1 },
    bow: { small: 1, medium: 1, large: 0.75 },
    staff: { small: 0.5, medium: 0.75, large: 1 },
  },
  tierModifier: { normal: 1, elite: 1.15, boss: 1.25 },
};

/* ---------------------------------------------------------------- NUMÉRICOS */
function clamp(v, min, max) { const n = safeNumber(v, min); return n < min ? min : n > max ? max : n; }
function safeNumber(v, fallback = 0) { return Number.isFinite(v) ? v : fallback; }
function floorNonNegative(v) { const n = Math.floor(safeNumber(v)); return n < 0 ? 0 : n; }

/* ----------------------------------------------------------------- FORMULAS */
function computeAtk({ weaponAtk, refineLevel, str, dex, luk }) {
  const rm = 1 + floorNonNegative(refineLevel) * BALANCE.stats.atk.refineBonusPct;
  const sq = Math.pow(floorNonNegative(str / BALANCE.stats.atk.strQuadraticDivisor), 2);
  const atk = safeNumber(weaponAtk) * rm + safeNumber(str) * BALANCE.stats.atk.strFlat + sq +
    floorNonNegative(dex / BALANCE.stats.atk.dexDivisor) + floorNonNegative(luk / BALANCE.stats.atk.lukDivisor);
  return Math.max(1, Math.round(atk));
}

function computeMatk({ weaponMatk, refineLevel, int }) {
  const rm = 1 + floorNonNegative(refineLevel) * BALANCE.stats.matk.refineBonusPct;
  const sq = Math.pow(floorNonNegative(int / BALANCE.stats.matk.intQuadraticDivisor), 2);
  return Math.max(1, Math.round(int * BALANCE.stats.matk.intFlat + sq + safeNumber(weaponMatk) * rm));
}

function computeHitChance(hit, flee) {
  const fleePct = Math.min(safeNumber(flee) / 100, BALANCE.stats.flee.maxPct);
  return clamp(BALANCE.stats.hitChance.basePct + safeNumber(hit) / 100 - fleePct,
    BALANCE.stats.hitChance.minPct, BALANCE.stats.hitChance.maxPct);
}

function computeAttackSpeed({ baseAttacksPerSec, agi, dex }) {
  const mult = 1 + safeNumber(agi) * BALANCE.stats.attackSpeed.agiPct + safeNumber(dex) * BALANCE.stats.attackSpeed.dexPct;
  return clamp(safeNumber(baseAttacksPerSec) * mult, 0.1, BALANCE.stats.attackSpeed.maxAttacksPerSec);
}

function attackIntervalSec(aps) { return 1 / Math.max(0.1, safeNumber(aps, 0.1)); }
function computeCrit(luk, bonus = 0) { return clamp(BALANCE.stats.crit.base + luk * BALANCE.stats.crit.lukMultiplier + bonus, 0, 100); }
function softDefReduction(def) { const d = Math.max(0, safeNumber(def)); return d / (d + BALANCE.stats.softDef.k); }
function mitigate(raw, defence) { return Math.max(1, Math.round(safeNumber(raw) * (1 - softDefReduction(defence)))); }
function elementMultiplier(attacker, defender) {
  const row = BALANCE.elementAffinity[attacker];
  if (!row) return 1;
  const v = row[defender];
  return typeof v === 'number' ? v : 1;
}
function weaponSizeMultiplier(weaponType, size) {
  const t = BALANCE.weaponSizeModifier[weaponType];
  return t && typeof t[size] === 'number' ? t[size] : 1;
}
function tierMultiplier(tier) { return BALANCE.tierModifier[tier] ?? 1; }

function computeDamage(input) {
  const elem = elementMultiplier(input.attackerElement, input.defenderElement);
  const elemRace = elementMultiplier(input.attackerElement, input.defenderRace);
  const size = input.weaponType ? weaponSizeMultiplier(input.weaponType, input.defenderSize) : 1;
  const tier = tierMultiplier(input.defenderTier);
  const crit = input.isCrit ? BALANCE.stats.crit.damageMultiplier : 1;
  const bonus = 1 + safeNumber(input.damageBonusPct);
  const scaled = safeNumber(input.rawDamage) * elem * elemRace * size * tier * crit * bonus;
  const mitigated = mitigate(scaled, input.defence);
  const cap = input.isAoe ? Math.max(1, Math.floor(safeNumber(input.defenderMaxHp) * BALANCE.combat.aoeDamageCapPct)) : Infinity;
  const capped = mitigated > cap;
  return { amount: Math.max(1, Math.min(mitigated, cap)), mitigated, capped };
}

/* ---------------------------------------------------------------------- RNG */
function createRng(seed) {
  let s0 = (seed >>> 0) || 0x9e3779b9;
  let s1 = (s0 ^ 0x9e3779b9) >>> 0;
  let s2 = (s0 ^ 0x243f6a88) >>> 0;
  let s3 = (s0 ^ 0xb7e15162) >>> 0;
  let cursor = 0;
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;
  const next = () => {
    const t = s0 ^ ((s0 << 11) & 0xffffffff);
    s0 = s1; s1 = s2; s2 = s3;
    s3 = (s3 ^ (s3 >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    cursor += 1;
    return s3 / 4294967296;
  };
  return {
    next,
    int: (min, max) => { const lo = Math.ceil(min), hi = Math.floor(max); return hi < lo ? lo : lo + Math.floor(next() * (hi - lo + 1)); },
    chance: (p) => (p <= 0 ? false : p >= 1 ? true : next() < p),
    pick: (arr) => { if (!arr.length) throw new Error('rng.pick vazio'); return arr[Math.floor(next() * arr.length)]; },
    weighted: (items) => {
      const usable = items.filter((i) => i.weight > 0);
      const total = usable.reduce((s, i) => s + i.weight, 0);
      if (!usable.length || total <= 0) throw new Error('rng.weighted sem peso');
      let roll = next() * total;
      for (const it of usable) { roll -= it.weight; if (roll <= 0) return it.value; }
      return usable[usable.length - 1].value;
    },
    getState: () => ({ seed, s0, s1, s2, s3, cursor }),
  };
}

/* -------------------------------------------------------------------- STUBS */
const CLASS_BASE = {
  warrior: { hp: 220, mp: 40, aps: 0.85, castSec: 0 },
  hunter: { hp: 150, mp: 60, aps: 1.15, castSec: 0 },
  cleric: { hp: 160, mp: 140, aps: 0.8, castSec: 1.2 },
  mage: { hp: 130, mp: 180, aps: 0.75, castSec: 2 },
};

function buildStats(cls, level, attrs, weapon) {
  const base = CLASS_BASE[cls];
  const levelScale = 1 + (level - 1) * 0.08;
  const atk = computeAtk({ weaponAtk: weapon.atk, refineLevel: weapon.refine, str: attrs.str, dex: attrs.dex, luk: attrs.luk });
  const matk = computeMatk({ weaponMatk: weapon.matk, refineLevel: weapon.refine, int: attrs.int });
  const isMagic = cls === 'mage' || cls === 'cleric';
  return {
    maxHp: Math.round(base.hp * levelScale * (1 + attrs.vit * 0.01)),
    maxMp: Math.round(base.mp * levelScale),
    atk: isMagic ? matk : atk,
    matk,
    def: Math.round(weapon.def + attrs.vit * 0.5),
    mdef: Math.round(attrs.int * 0.5),
    hit: level + attrs.dex,
    flee: level + attrs.agi,
    crit: computeCrit(attrs.luk),
    attackSpeed: computeAttackSpeed({ baseAttacksPerSec: base.aps, agi: attrs.agi, dex: attrs.dex }),
  };
}

const ROSTER = [
  { id: 'h1', name: 'Paladino', cls: 'warrior', position: 'front', role: 'tank', icon: '🛡️', level: 25,
    attrs: { str: 34, agi: 12, vit: 40, int: 8, dex: 18, luk: 10 }, weapon: { atk: 96, matk: 0, def: 42, refine: 3 } },
  { id: 'h2', name: 'Atirador de Elite', cls: 'hunter', position: 'mid', role: 'dps', icon: '🏹', level: 25,
    attrs: { str: 12, agi: 34, vit: 14, int: 6, dex: 38, luk: 18 }, weapon: { atk: 110, matk: 0, def: 14, refine: 2 } },
  { id: 'h3', name: 'Sacerdote Divino', cls: 'cleric', position: 'back', role: 'healer', icon: '✨', level: 25,
    attrs: { str: 6, agi: 10, vit: 24, int: 42, dex: 22, luk: 8 }, weapon: { atk: 40, matk: 88, def: 12, refine: 1 } },
  { id: 'h4', name: 'Arquimago', cls: 'mage', position: 'back', role: 'dps', icon: '🔮', level: 25,
    attrs: { str: 4, agi: 12, vit: 16, int: 46, dex: 20, luk: 10 }, weapon: { atk: 36, matk: 120, def: 10, refine: 2 } },
];

const MOBS = [
  { name: 'Lobo Sombrio', icon: '🐺', size: 'medium', race: 'beast', element: 'dark', hp: 620, atk: 58, def: 22 },
  { name: 'Golem de Pedra', icon: '🗿', size: 'large', race: 'elemental', element: 'earth', hp: 900, atk: 46, def: 55 },
  { name: 'Espectro', icon: '👻', size: 'medium', race: 'undead', element: 'dark', hp: 540, atk: 66, def: 14 },
  { name: 'Salamandra', icon: '🦎', size: 'small', race: 'beast', element: 'fire', hp: 480, atk: 72, def: 18 },
  { name: 'Treant', icon: '🌳', size: 'large', race: 'plant', element: 'earth', hp: 1100, atk: 38, def: 60 },
];
const BOSSES = [
  { name: 'Rex Rochoso', icon: '🦖', size: 'large', race: 'dragon', element: 'earth', hp: 5400, atk: 120, def: 70 },
  { name: 'T-Rex Ancião', icon: '🦕', size: 'large', race: 'dragon', element: 'fire', hp: 6800, atk: 145, def: 82 },
  { name: 'Necromante', icon: '💀', size: 'medium', race: 'undead', element: 'dark', hp: 5000, atk: 160, def: 55 },
];

/* --------------------------------------------------------------- COMBATE */
function makeHero(def) {
  const stats = buildStats(def.cls, def.level, def.attrs, def.weapon);
  return {
    id: def.id, name: def.name, icon: def.icon, team: 'squad', position: def.position, role: def.role,
    level: def.level, hp: stats.maxHp, maxHp: stats.maxHp, mp: stats.maxMp, maxMp: stats.maxMp,
    shield: 0, stats, isAlive: true, attackCooldownSec: 0, tier: 'normal', element: 'neutral',
  };
}

function makeEnemy(mob, floor, wave, isBoss) {
  const scale = 1 + (floor - 1) * 0.18;
  const hp = Math.round(mob.hp * scale * (isBoss ? 8 : 1));
  const atk = Math.round(mob.atk * (1 + (floor - 1) * 0.12) * (isBoss ? 2.2 : 1));
  const def = Math.round(mob.def * (1 + (floor - 1) * 0.08));
  return {
    id: `${isBoss ? 'boss' : 'mob'}-${floor}-${wave}`,
    name: mob.name, icon: mob.icon, team: 'enemy', position: 'front', role: 'dps',
    level: floor * 2, hp, maxHp: hp, mp: 0, maxMp: 0, shield: 0, isAlive: true,
    attackCooldownSec: 0, tier: isBoss ? 'boss' : 'normal', element: mob.element,
    size: mob.size, race: mob.race,
    stats: { maxHp: hp, maxMp: 0, atk, matk: atk, def, mdef: Math.round(def * 0.7), hit: floor * 2 + 20, flee: 5,
      crit: 5, attackSpeed: isBoss ? 0.7 : 0.8 },
  };
}

function isAlive(a) { return a.hp > 0 && a.isAlive; }
function aliveOf(list, team) { return list.filter((a) => a.team === team && isAlive(a)); }

function pickTarget(enemies) {
  const alive = enemies.filter(isAlive);
  if (!alive.length) return null;
  for (const pos of ['front', 'mid', 'back']) {
    const c = alive.filter((a) => a.position === pos);
    if (c.length) return c.reduce((low, a) => (a.hp < low.hp ? a : low));
  }
  return alive[0];
}

function applyDamageTo(a, amount) {
  const inc = Math.max(0, Math.round(amount));
  const absorbed = Math.min(a.shield, inc);
  const hp = Math.max(0, a.hp - (inc - absorbed));
  return { ...a, shield: a.shield - absorbed, hp, isAlive: hp > 0 };
}
function applyHealTo(a, amount) {
  const hp = Math.min(a.maxHp, a.hp + Math.max(0, Math.round(amount)));
  return { ...a, hp, isAlive: hp > 0 };
}

function recordDamage(metrics, sourceId, targetId, amount, isCrit, isMiss) {
  const per = { ...metrics.perActor };
  const s = per[sourceId] ?? { damageDealt: 0, damageTaken: 0, healingDone: 0, critCount: 0, hitCount: 0, missCount: 0, dps: 0, dpsSharePct: 0, critRatePct: 0 };
  const t = per[targetId] ?? { damageDealt: 0, damageTaken: 0, healingDone: 0, critCount: 0, hitCount: 0, missCount: 0, dps: 0, dpsSharePct: 0, critRatePct: 0 };
  per[sourceId] = { ...s, damageDealt: s.damageDealt + amount, hitCount: s.hitCount + (isMiss ? 0 : 1), missCount: s.missCount + (isMiss ? 1 : 0), critCount: s.critCount + (isCrit ? 1 : 0) };
  per[targetId] = { ...t, damageTaken: t.damageTaken + amount };
  return { ...metrics, totalDamage: metrics.totalDamage + amount, totalDamageTaken: metrics.totalDamageTaken + amount, perActor: per };
}

function finaliseMetrics(metrics, elapsed) {
  const safe = Math.max(1, elapsed);
  const per = {};
  for (const [id, a] of Object.entries(metrics.perActor)) {
    const attempts = a.hitCount + a.missCount;
    per[id] = { ...a, dps: a.damageDealt / safe,
      dpsSharePct: metrics.totalDamage > 0 ? (a.damageDealt / metrics.totalDamage) * 100 : 0,
      critRatePct: attempts > 0 ? (a.critCount / attempts) * 100 : 0 };
  }
  return { ...metrics, elapsedSec: safe, perActor: per };
}

function emptyMetrics() { return { totalDamage: 0, totalHealing: 0, totalDamageTaken: 0, elapsedSec: 0, perActor: {} }; }

/* ------------------------------------------------------------- GAME STATE */
const S = {
  floor: 1, wave: 1, wavesPerFloor: 9, bossFloorInterval: 10,
  combatants: [], metrics: emptyMetrics(), elapsed: 0, waveElapsed: 0,
  phase: 'idle', running: true, seed: 0, rng: null, events: [],
  floats: [], log: [], ticks: 0, checkHash: true, hashOk: true,
};

function isBossFloor() { return S.floor % S.bossFloorInterval === 0; }
function bossWave() { return S.wavesPerFloor + 1; }

function startWave() {
  const heroes = ROSTER.map(makeHero);
  const boss = isBossFloor() && S.wave >= bossWave();
  const mob = boss ? BOSSES[(S.floor / S.bossFloorInterval - 1) % BOSSES.length] : MOBS[(S.floor + S.wave) % MOBS.length];
  const count = boss ? 1 : 2;
  const enemies = [];
  for (let i = 0; i < count; i += 1) enemies.push(makeEnemy(mob, S.floor, S.wave, boss));
  S.combatants = [...heroes, ...enemies];
  S.metrics = emptyMetrics();
  S.elapsed = 0;
  S.waveElapsed = 0;
  S.phase = boss ? 'boss_fight' : 'fighting';
  S.events = [];
  logEvent(boss ? `⚠ CHEFE: ${mob.name} (andar ${S.floor})` : `▶ Wave ${S.wave}/${S.wavesPerFloor} — ${mob.name} ×${count}`);
}

function nextWave() {
  if (S.wave >= (isBossFloor() ? bossWave() : S.wavesPerFloor)) {
    if (isBossFloor() && S.wave >= bossWave()) {
      logEvent(`🏆 Andar ${S.floor} conquistado!`);
      S.floor += 1;
      S.wave = 1;
    } else if (!isBossFloor()) {
      S.wave += 1;
    } else {
      S.wave += 1;
    }
  } else {
    S.wave += 1;
  }
  startWave();
}

function logEvent(text) {
  S.log.unshift(text);
  if (S.log.length > 40) S.log.pop();
}

function advance(dt) {
  if (!S.running || S.phase === 'idle') return;
  const events = [];
  let list = S.combatants.map((a) => ({ ...a, attackCooldownSec: Math.max(0, a.attackCooldownSec - dt) }));
  let metrics = S.metrics;
  S.elapsed += dt;
  S.waveElapsed += dt;

  for (const attacker of list) {
    if (!isAlive(attacker) || attacker.attackCooldownSec > 0) continue;
    const foes = aliveOf(list, attacker.team === 'squad' ? 'enemy' : 'squad');
    const target = pickTarget(foes);
    if (!target) continue;

    const isMagic = attacker.team === 'squad' && (attacker.role === 'healer' || attacker.icon === '🔮');
    const hitChance = computeHitChance(attacker.stats.hit, target.stats.flee);
    const isMiss = !S.rng.chance(hitChance);
    let amount = 0, isCrit = false;

    if (!isMiss) {
      isCrit = S.rng.chance(attacker.stats.crit / 100);
      const res = computeDamage({
        rawDamage: isMagic ? attacker.stats.matk : attacker.stats.atk,
        attackerElement: isMagic ? 'holy' : 'neutral',
        defenderElement: target.element ?? 'neutral',
        defenderRace: target.race ?? 'humanoid',
        defenderSize: target.size ?? 'medium',
        defenderTier: target.tier ?? 'normal',
        weaponType: null, defence: isMagic ? target.stats.mdef : target.stats.def,
        isCrit, isAoe: false, defenderMaxHp: target.maxHp, damageBonusPct: 0,
      });
      amount = res.amount;
      metrics = recordDamage(metrics, attacker.id, target.id, amount, isCrit, false);
    }

    events.push({ kind: isMiss ? 'miss' : 'dmg', sourceId: attacker.id, targetId: target.id, amount, isCrit });

    list = list.map((a) => {
      if (a.id === attacker.id) return { ...a, attackCooldownSec: attackIntervalSec(attacker.stats.attackSpeed) };
      if (a.id === target.id && !isMiss) {
        const d = applyDamageTo(a, amount);
        if (!d.isAlive && a.isAlive && a.team === 'enemy') logEvent(`☠ ${a.name} derrotado`);
        return d;
      }
      return a;
    });
  }

  S.combatants = list;
  S.metrics = finaliseMetrics(metrics, S.elapsed);

  for (const ev of events) S.floats.push({ ...ev, t: performance.now() });

  const squadAlive = aliveOf(list, 'squad').length;
  const foesAlive = aliveOf(list, 'enemy').length;

  if (squadAlive === 0) {
    S.phase = 'wipe';
    logEvent('💀 Wipe — squad eliminado. A voltar ao checkpoint.');
    setTimeout(() => { S.floor = Math.max(1, S.floor - 1); S.wave = 1; startWave(); }, 1400);
  } else if (foesAlive === 0 && (S.phase === 'fighting' || S.phase === 'boss_fight')) {
    S.phase = 'wave_clear';
    setTimeout(() => { if (S.phase === 'wave_clear') nextWave(); }, 700);
  }
}

/* -------------------------------------------------------------- RENDER */
const $ = (id) => document.getElementById(id);

function render() {
  const isBoss = isBossFloor() && S.wave >= bossWave();
  $('p-floor').textContent = `ANDAR ${S.floor}`;
  $('p-wave').textContent = `WAVE ${S.wave}/${isBoss ? bossWave() : S.wavesPerFloor}`;
  $('p-seed').textContent = `seed ${S.seed}`;
  $('p-time').textContent = `${S.elapsed.toFixed(1)}s`;

  const heroes = S.combatants.filter((a) => a.team === 'squad');
  const foes = S.combatants.filter((a) => a.team === 'enemy');
  const cp = Math.round(heroes.reduce((sum, h) => sum + h.stats.atk * 2 + h.stats.maxHp * 0.6 + h.stats.def * 2, 0));

  $('hud').innerHTML = [
    `<span class="stat">SQUAD <b>${heroes.length}/4</b></span>`,
    `<span class="stat">CP <b>${cp.toLocaleString('pt-BR')}</b></span>`,
    `<span class="stat">FASE <b>${S.phase}</b></span>`,
    `<span class="stat">INIMIGOS <b>${foes.filter(isAlive).length}</b></span>`,
  ].join('');

  // Boss bar
  const boss = foes.find((f) => f.tier === 'boss');
  if (boss) {
    $('bossbar').style.display = 'block';
    $('boss-name').textContent = `💀 ${boss.name} · Lv.${boss.level}`;
    $('boss-hp-txt').textContent = `${Math.round(boss.hp).toLocaleString('pt-BR')} / ${boss.maxHp.toLocaleString('pt-BR')}`;
    $('boss-hp-bar').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  } else {
    $('bossbar').style.display = 'none';
  }

  // Lanternas
  const lanes = { front: [], mid: [], back: [] };
  for (const a of S.combatants) {
    if (a.team === 'enemy') lanes.front.push(a);
    else lanes[a.position].push(a);
  }
  for (const [pos, items] of Object.entries(lanes)) {
    $(`lane-${pos}`).innerHTML = items.map((a) => unitHtml(a)).join('') || '<div style="height:6px"></div>';
  }

  // Damage meter
  const rows = S.combatants
    .filter((a) => a.team === 'squad')
    .map((h) => {
      const m = S.metrics.perActor[h.id] ?? { dps: 0, dpsSharePct: 0, damageDealt: 0, critRatePct: 0 };
      return `<tr>
        <td>${h.icon} ${h.name}<div class="share"><i style="width:${m.dpsSharePct.toFixed(0)}%"></i></div></td>
        <td class="num">${m.dps.toFixed(1)}</td>
        <td class="num">${m.dpsSharePct.toFixed(1)}%</td>
        <td class="num">${Math.round(m.damageDealt).toLocaleString('pt-BR')}</td>
        <td class="num">${m.critRatePct.toFixed(0)}%</td>
      </tr>`;
    })
    .join('');
  $('meter-body').innerHTML = rows;

  // Log
  $('log').innerHTML = S.log.slice(0, 18).map((l) => `<div>${l}</div>`).join('');
  $('p-events').textContent = String(S.log.length);

  $('hash-note').innerHTML = S.checkHash
    ? `RNG xorshift128 · tick 1/60s · ${S.ticks} ticks · hash <b style="color:${S.hashOk ? '#4ade80' : '#ef4444'}">${stateHash()}</b>`
    : 'Verificação desligada.';
}

function unitHtml(a) {
  const hpPct = Math.max(0, (a.hp / a.maxHp) * 100);
  const mpPct = a.maxMp > 0 ? Math.max(0, (a.mp / a.maxMp) * 100) : 0;
  const low = hpPct < 35;
  const floats = S.floats.filter((f) => f.targetId === a.id).slice(-3).map((f) => {
    const cls = f.kind === 'miss' ? 'miss' : f.isCrit ? 'crit' : 'dmg';
    const txt = f.kind === 'miss' ? 'MISS' : f.isCrit ? `✦${Math.round(f.amount)}` : Math.round(f.amount);
    return `<span class="float ${cls}">${txt}</span>`;
  }).join('');
  return `<div class="unit ${a.team === 'enemy' ? 'foe' : ''} ${isAlive(a) ? '' : 'dead'}">
    ${floats}
    <div class="av">${a.icon}</div>
    <div class="unit-meta">
      <div class="unit-name">${a.name} <small>Lv.${a.level}</small></div>
      <div class="bars">
        <div class="bar hp ${low ? 'low' : ''}"><i style="width:${hpPct}%"></i></div>
        ${a.maxMp > 0 ? `<div class="bar mp"><i style="width:${mpPct}%"></i></div>` : ''}
      </div>
    </div>
  </div>`;
}

/** FNV-1a sobre o estado essencial: detecta divergência de determinismo. */
function stateHash() {
  const payload = `${S.floor}:${S.wave}:${S.ticks}:` +
    S.combatants.map((a) => `${a.id}=${Math.round(a.hp)}`).join('|') +
    `:${Math.round(S.metrics.totalDamage)}`;
  let h = 2166136261;
  for (let i = 0; i < payload.length; i += 1) { h ^= payload.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* ---------------------------------------------------------------- LOOP */
let last = 0, acc = 0, fpsSamples = [];

function frame(ts) {
  if (!last) last = ts;
  const delta = Math.min(Math.max((ts - last) / 1000, 0), 0.25);
  last = ts;
  acc += delta;

  const step = BALANCE.combat.tickIntervalSec;
  let steps = 0;
  while (acc >= step && steps < BALANCE.combat.maxCatchUpSteps) { acc -= step; advance(step); S.ticks += 1; steps += 1; }

  const now = performance.now();
  S.floats = S.floats.filter((f) => now - f.t < 900);

  fpsSamples = [...fpsSamples, delta > 0 ? 1 / delta : 0].slice(-30);
  $('p-fps').textContent = `${Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length)} FPS`;

  render();
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------- CONTROLS */
$('btn-toggle').addEventListener('click', () => {
  S.running = !S.running;
  $('btn-toggle').textContent = S.running ? '⏸ Pausar' : '▶ Retomar';
});
$('btn-restart').addEventListener('click', () => {
  S.floor = 1; S.wave = 1; S.ticks = 0; S.log = [];
  S.rng = createRng(S.seed);
  startWave();
});
$('btn-step').addEventListener('click', () => {
  for (let i = 0; i < 60; i += 1) { advance(BALANCE.combat.tickIntervalSec); S.ticks += 1; }
});
$('btn-seed').addEventListener('click', () => {
  S.seed = Math.floor(Math.random() * 1e9);
  S.rng = createRng(S.seed);
  S.ticks = 0;
  startWave();
});
$('sw-hash').addEventListener('click', (e) => {
  S.checkHash = !S.checkHash;
  e.currentTarget.classList.toggle('on', S.checkHash);
});

/* ----------------------------------------------------------------- BOOT */
S.seed = 20261106;
S.rng = createRng(S.seed);
startWave();
requestAnimationFrame(frame);
