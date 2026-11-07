/* =============================================================================
   ESPELHO — demo da etapa 4 (skills, drops, torre)
   Duplica lib/game/{skills,drops,tower}.ts e data/tower.ts para correr sem
   bundler. A fonte de verdade é o TypeScript.
   ========================================================================== */

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_LABEL = { common: 'Comum', uncommon: 'Incomum', rare: 'Rara', epic: 'Épica', legendary: 'Lendária', mythic: 'Mítica' };
const RARITY_COLOR = { common: '156 163 175', uncommon: '74 222 128', rare: '56 189 248', epic: '167 139 250', legendary: '251 191 36', mythic: '244 114 182' };

/* ------------------------------------------------------------------ TORRE */
const BOSS_INTERVAL = 10;
const WAVES_PER_FLOOR = 9;
const BOSS_WAVE = 10;

const FAMILIES = [
  { biome: 'Planície', icon: '🌾', mobs: ['Gosma Verde', 'Javali Selvagem', 'Rato do Campo', 'Sílfide do Prado'], boss: 'Rex Rochoso', bossIcon: '🦖' },
  { biome: 'Floresta', icon: '🌲', mobs: ['Lobo Sombrio', 'Treant', 'Aranha da Mata', 'Lobo de Musgo'], boss: 'T-Rex Ancião', bossIcon: '🦕' },
  { biome: 'Cavernas', icon: '🔥', mobs: ['Salamandra', 'Golem de Pedra', 'Morcego de Magma', 'Cavaleiro de Basalto'], boss: 'Rei Lich', bossIcon: '💀' },
  { biome: 'Pico', icon: '❄️', mobs: ['Sílfide do Gelo', 'Troll de Gelo', 'Lince das Neves', 'Espectro Gélido'], boss: 'Wyrm Congelado', bossIcon: '🐉' },
  { biome: 'Ruínas', icon: '🏛️', mobs: ['Espectro', 'Constructo Guardião', 'Acólito Corrompido', 'Serpente de Pedra'], boss: 'Serafim Caído', bossIcon: '👼' },
  { biome: 'Abismo', icon: '🕳️', mobs: ['Sabujo Abissal', 'Espectro do Vazio', 'Fauce do Abismo', 'Cultista Sombrio'], boss: 'Soberano do Abismo', bossIcon: '👑' },
];

const ITEM_POOL = [
  { name: 'Espada de Ferro', icon: '⚔️', rarity: 'common', slot: 'weapon' },
  { name: 'Arco do Caçador', icon: '🏹', rarity: 'uncommon', slot: 'weapon' },
  { name: 'Cajado Arcano', icon: '🪄', rarity: 'rare', slot: 'weapon' },
  { name: 'Adaga das Sombras', icon: '🗡️', rarity: 'epic', slot: 'weapon' },
  { name: 'Lança do Dragão', icon: '🔱', rarity: 'legendary', slot: 'weapon' },
  { name: 'Cota de Malha', icon: '🥋', rarity: 'uncommon', slot: 'armor' },
  { name: 'Túnica Arcana', icon: '👘', rarity: 'rare', slot: 'armor' },
  { name: 'Placa Abissal', icon: '🛡️', rarity: 'mythic', slot: 'armor' },
  { name: 'Elmo de Ferro', icon: '⛑️', rarity: 'uncommon', slot: 'helmet' },
  { name: 'Capuz Arcano', icon: '🎩', rarity: 'rare', slot: 'helmet' },
  { name: 'Escudo Torre', icon: '🛡️', rarity: 'epic', slot: 'offhand' },
  { name: 'Botas Velozes', icon: '🥾', rarity: 'rare', slot: 'boots' },
  { name: 'Amuleto da Sorte', icon: '💎', rarity: 'epic', slot: 'accessory' },
  { name: 'Capa do Viajante', icon: '🧥', rarity: 'uncommon', slot: 'cloak' },
];

const RARITY_WEIGHTS = [
  { minFloor: 1, weights: { common: 78, uncommon: 18, rare: 3.4, epic: 0.5, legendary: 0.09, mythic: 0.01 } },
  { minFloor: 10, weights: { common: 60, uncommon: 28, rare: 9, epic: 2.4, legendary: 0.5, mythic: 0.1 } },
  { minFloor: 20, weights: { common: 42, uncommon: 34, rare: 17, epic: 5.5, legendary: 1.3, mythic: 0.2 } },
  { minFloor: 30, weights: { common: 28, uncommon: 36, rare: 24, epic: 9, legendary: 2.5, mythic: 0.5 } },
];

/* -------------------------------------------------------------------- RNG */
function createRng(seed) {
  let s0 = (seed >>> 0) || 0x9e3779b9;
  let s1 = (s0 ^ 0x9e3779b9) >>> 0;
  let s2 = (s0 ^ 0x243f6a88) >>> 0;
  let s3 = (s0 ^ 0xb7e15162) >>> 0;
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;
  const next = () => {
    const t = s0 ^ ((s0 << 11) & 0xffffffff);
    s0 = s1; s1 = s2; s2 = s3;
    s3 = (s3 ^ (s3 >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    return s3 / 4294967296;
  };
  return {
    next,
    int: (min, max) => { const lo = Math.ceil(min), hi = Math.floor(max); return hi < lo ? lo : lo + Math.floor(next() * (hi - lo + 1)); },
    chance: (p) => (p <= 0 ? false : p >= 1 ? true : next() < p),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (items) => {
      const usable = items.filter((i) => i.weight > 0);
      const total = usable.reduce((s, i) => s + i.weight, 0);
      let roll = next() * total;
      for (const it of usable) { roll -= it.weight; if (roll <= 0) return it.value; }
      return usable[usable.length - 1].value;
    },
  };
}

/* ---------------------------------------------------------------- DROPS */
function rarityWeightsForFloor(floor) {
  let lower = RARITY_WEIGHTS[0];
  let upper = RARITY_WEIGHTS[RARITY_WEIGHTS.length - 1];
  RARITY_WEIGHTS.forEach((tier, index) => {
    if (floor >= tier.minFloor) {
      lower = tier;
      upper = RARITY_WEIGHTS[index + 1] ?? tier;
    }
  });
  if (lower === upper || upper.minFloor === lower.minFloor) return lower.weights;
  const progress = Math.min(1, (floor - lower.minFloor) / (upper.minFloor - lower.minFloor));
  const out = {};
  for (const rarity of RARITY_ORDER) {
    out[rarity] = lower.weights[rarity] + (upper.weights[rarity] - lower.weights[rarity]) * progress;
  }
  return out;
}

function rollRarity(floor, rng) {
  const weights = rarityWeightsForFloor(floor);
  return rng.weighted(RARITY_ORDER.map((rarity) => ({ value: rarity, weight: Math.max(0, weights[rarity]) })));
}

function raiseRarity(rarity, steps) {
  const index = Math.min(RARITY_ORDER.length - 1, Math.max(0, RARITY_ORDER.indexOf(rarity) + steps));
  return RARITY_ORDER[index];
}

const AFFIX_POOL = ['atk', 'crit', 'maxHp', 'def', 'attackSpeed', 'dropBonus'];
const AFFIX_COUNT = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

function rollAffixes(rarity, rng) {
  const count = AFFIX_COUNT[rarity];
  const pool = [...AFFIX_POOL];
  const out = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const index = rng.int(0, pool.length - 1);
    const stat = pool.splice(index, 1)[0];
    out.push({ stat, value: rng.int(1, 34), tier: rng.int(1, 5) });
  }
  return out;
}

function rollDrops({ floor, isBoss, firstClear, dropBonus }, rng) {
  const items = [];
  const gold = rng.chance(isBoss ? 1 : 0.6) ? rng.int(10, 30) * Math.max(1, floor) * (isBoss ? 4 : 1) : 0;
  const baseChance = isBoss ? 1 : 0.25;
  const chance = Math.min(1, baseChance * (1 + Math.min(0.75, dropBonus / 100)));

  if (firstClear && isBoss) {
    const rare = ITEM_POOL.filter((item) => RARITY_ORDER.indexOf(item.rarity) >= 3);
    const chosen = rng.pick(rare);
    items.push({ ...chosen, rarity: raiseRarity(chosen.rarity, 2), affixes: rollAffixes(chosen.rarity, rng), refine: 0 });
  }

  if (rng.chance(chance)) {
    const rarity = isBoss ? raiseRarity(rollRarity(floor, rng), 2) : rollRarity(floor, rng);
    const candidates = ITEM_POOL.filter((item) => RARITY_ORDER.indexOf(item.rarity) <= RARITY_ORDER.indexOf(rarity));
    const chosen = candidates.length ? rng.pick(candidates) : ITEM_POOL[0];
    items.push({ ...chosen, rarity, affixes: rollAffixes(rarity, rng), refine: 0 });
  }

  return { items, gold };
}

/* ---------------------------------------------------------------- TORRE */
function familyFor(floor) {
  return FAMILIES[Math.min(FAMILIES.length - 1, Math.floor((floor - 1) / 5))];
}
function isBossFloor(floor) { return floor % BOSS_INTERVAL === 0; }
function wavesForFloor(floor) { return isBossFloor(floor) ? BOSS_WAVE : WAVES_PER_FLOOR; }

/* ---------------------------------------------------------------- ESTADO */
const S = {
  phase: 'idle',
  floor: 1,
  wave: 1,
  highest: 1,
  checkpoint: 1,
  cleared: [],
  mode: 'advance',
  gold: 0,
  loot: [],
  log: [],
  effects: [],
  units: [],
  running: false,
  seed: 20261106,
  rng: createRng(20261106),
  ticks: 0,
};

const $ = (id) => document.getElementById(id);

function log(text, kind = '') {
  S.log.unshift({ text, kind, at: S.ticks });
  if (S.log.length > 60) S.log.pop();
}

function buildUnits() {
  const family = familyFor(S.floor);
  const boss = isBossFloor(S.floor) && S.wave >= BOSS_WAVE;
  const heroLevel = 20 + S.floor * 2;

  S.units = [
    { id: 'h1', name: 'Paladino', icon: '🛡️', team: 'squad', pos: 'front', hp: 1, maxHp: 1, mp: 1, maxMp: 1, shield: 0, level: heroLevel, fx: [] },
    { id: 'h2', name: 'Atirador', icon: '🏹', team: 'squad', pos: 'mid', hp: 1, maxHp: 1, mp: 1, maxMp: 1, shield: 0, level: heroLevel, fx: [] },
    { id: 'h3', name: 'Sacerdote', icon: '✨', team: 'squad', pos: 'back', hp: 1, maxHp: 1, mp: 1, maxMp: 1, shield: 0, level: heroLevel, fx: [] },
    { id: 'h4', name: 'Arquimago', icon: '🔮', team: 'squad', pos: 'back', hp: 1, maxHp: 1, mp: 1, maxMp: 1, shield: 0, level: heroLevel, fx: [] },
  ];

  const mobName = boss ? family.boss : family.mobs[S.wave % family.mobs.length];
  const mobIcon = boss ? family.bossIcon : family.icon;
  const count = boss ? 1 : 2;
  for (let i = 0; i < count; i += 1) {
    S.units.push({
      id: `e${i}`, name: mobName, icon: mobIcon, team: 'enemy', pos: 'front',
      hp: 1, maxHp: 1, mp: 0, maxMp: 0, shield: 0, level: S.floor * 2, fx: [], boss,
    });
  }

  // HP/MP base — só para a demo visual do combate
  for (const unit of S.units) {
    const base = unit.team === 'squad' ? 2400 : boss ? 9000 + S.floor * 400 : 700 + S.floor * 120;
    unit.maxHp = base;
    unit.hp = base;
    unit.maxMp = unit.team === 'squad' ? 300 : 0;
    unit.mp = unit.maxMp;
  }
}

/* ------------------------------------------------------------- SIMULAÇÃO */
function tick(dt) {
  S.ticks += 1;

  // Efeitos activos: DoT/HoT de demo
  for (const effect of S.effects) {
    effect.remaining -= dt;
    if (effect.remaining <= 0) continue;
    const target = S.units.find((unit) => unit.id === effect.targetId);
    if (!target) continue;
    effect.tickAcc += dt;
    if (effect.tickAcc >= effect.interval) {
      effect.tickAcc = 0;
      if (effect.kind === 'dot') {
        target.hp = Math.max(0, target.hp - effect.tickValue);
        log(`☠ ${effect.skill} → ${target.name} −${Math.round(effect.tickValue)}`, 'dmg');
      } else if (effect.kind === 'hot') {
        target.hp = Math.min(target.maxHp, target.hp + effect.tickValue);
        log(`✚ ${effect.skill} → ${target.name} +${Math.round(effect.tickValue)}`, 'heal');
      }
    }
  }
  S.effects = S.effects.filter((effect) => effect.remaining > 0);
  for (const unit of S.units) unit.fx = S.effects.filter((effect) => effect.targetId === unit.id);

  if (!S.running || S.phase !== 'fighting' && S.phase !== 'boss') return;

  // Auto-ataques simplificados
  const heroes = S.units.filter((unit) => unit.team === 'squad' && unit.hp > 0);
  const foes = S.units.filter((unit) => unit.team === 'enemy' && unit.hp > 0);

  for (const hero of heroes) {
    if (!foes.length) break;
    const target = foes.reduce((low, unit) => (unit.hp < low.hp ? unit : low));
    const damage = Math.round((hero.icon === '🔮' ? 620 : hero.icon === '🏹' ? 540 : hero.icon === '✨' ? 260 : 300) * (0.85 + S.rng.next() * 0.3));
    target.hp = Math.max(0, target.hp - damage);
    if (hero.icon === '✨') {
      const hurt = heroes.reduce((low, unit) => (unit.hp / unit.maxHp < low.hp / low.maxHp ? unit : low));
      hurt.hp = Math.min(hurt.maxHp, hurt.hp + damage * 1.4);
    }
  }

  for (const foe of foes) {
    if (!heroes.length) break;
    const target = heroes[0];
    const damage = Math.round((foe.boss ? 320 : 120) * (0.85 + S.rng.next() * 0.3));
    target.hp = Math.max(0, target.hp - damage);
  }

  const foesAlive = S.units.filter((unit) => unit.team === 'enemy' && unit.hp > 0);
  const heroesAlive = S.units.filter((unit) => unit.team === 'squad' && unit.hp > 0);

  if (heroesAlive.length === 0) {
    applyWipe();
    return;
  }

  if (foesAlive.length === 0) {
    onWaveClear();
  }
}

function onWaveClear() {
  const boss = isBossFloor(S.floor) && S.wave >= BOSS_WAVE;
  const drop = rollDrops({ floor: S.floor, isBoss: boss, firstClear: !S.cleared.includes(S.floor), dropBonus: 10 }, S.rng);
  S.gold += drop.gold;
  for (const item of drop.items) S.loot.unshift(item);
  if (S.loot.length > 24) S.loot.length = 24;

  if (drop.items.length) {
    for (const item of drop.items) {
      log(`🎁 ${item.name} (${RARITY_LABEL[item.rarity]})`, '');
    }
  }
  if (drop.gold) log(`💰 +${drop.gold} gold`, 'heal');

  if (boss) {
    log(`🏆 CHEFE ${familyFor(S.floor).boss} derrotado — andar ${S.floor} concluído!`, 'boss');
    completeFloor();
    return;
  }

  if (S.wave >= wavesForFloor(S.floor)) {
    completeFloor();
    return;
  }

  S.wave += 1;
  log(`▶ Wave ${S.wave}/${wavesForFloor(S.floor)} — ${familyFor(S.floor).mobs[S.wave % 4]}`, '');
  buildUnits();
  if (isBossFloor(S.floor) && S.wave >= BOSS_WAVE) S.phase = 'boss';
}

function completeFloor() {
  if (!S.cleared.includes(S.floor)) S.cleared.push(S.floor);
  S.highest = Math.max(S.highest, S.floor);
  S.checkpoint = Math.max(S.checkpoint, S.floor);

  if (S.mode === 'farm') {
    S.wave = 1;
    S.phase = 'fighting';
    buildUnits();
    return;
  }

  S.floor += 1;
  S.wave = 1;
  S.phase = 'floor_clear';
  log(`🏢 Andar ${S.floor} — ${familyFor(S.floor).biome} (checkpoint ${S.checkpoint})`, 'boss');
  buildUnits();
  setTimeout(() => {
    S.phase = isBossFloor(S.floor) ? 'boss' : 'fighting';
    render();
  }, 400);
}

function applyWipe() {
  const respawn = S.mode === 'farm' ? S.floor : S.checkpoint;
  log(`💀 Wipe — a voltar ao checkpoint (andar ${respawn})`, 'boss');
  S.phase = 'checkpoint';
  S.floor = respawn;
  S.wave = 1;
  buildUnits();
  setTimeout(() => {
    S.phase = isBossFloor(S.floor) ? 'boss' : 'fighting';
    render();
  }, 600);
}

/* --------------------------------------------------------------- RENDER */
function renderUnits() {
  const lanes = { front: [], mid: [], back: [] };
  for (const unit of S.units) {
    if (unit.team === 'enemy') lanes.front.push(unit);
    else lanes[unit.pos].push(unit);
  }

  $('units').innerHTML = ['front', 'mid', 'back'].map((pos) => `
    <div>
      <div class="lane-h">${pos === 'front' ? '⚔️ Front' : pos === 'mid' ? '🛡️ Mid' : '✨ Back'}</div>
      ${lanes[pos].map((unit) => `
        <div class="unit ${unit.team === 'enemy' ? 'foe' : ''} ${unit.hp > 0 ? '' : 'dead'}">
          <div class="top">
            <span>${unit.icon} ${unit.name}</span>
            <small>Lv.${unit.level}</small>
          </div>
          <div class="bar hp"><i style="width:${Math.max(0, (unit.hp / unit.maxHp) * 100)}%"></i></div>
          ${unit.maxMp > 0 ? `<div class="bar mp"><i style="width:${(unit.mp / unit.maxMp) * 100}%"></i></div>` : ''}
          ${unit.shield > 0 ? `<div class="bar sh"><i style="width:${Math.min(100, unit.shield)}%"></i></div>` : ''}
          <div class="effects">
            ${(unit.fx ?? []).map((fx) => `<span class="fx" style="color:${fx.kind === 'dot' ? '#f87171' : '#4ade80'}">${fx.skill} ${fx.remaining.toFixed(1)}s</span>`).join('')}
          </div>
        </div>`).join('') || '<div style="height:8px"></div>'}
    </div>`).join('');
}

function render() {
  const family = familyFor(S.floor);
  const totalWaves = wavesForFloor(S.floor);

  $('p-floor').textContent = `andar ${S.floor}`;
  $('p-wave').textContent = `wave ${S.wave}/${totalWaves}`;
  $('p-phase').textContent = S.phase;
  $('p-checkpoint').textContent = `checkpoint ${S.checkpoint}`;
  $('p-gold').textContent = `${S.gold.toLocaleString('pt-BR')} gold`;

  $('f-num').textContent = S.floor;
  $('f-name').textContent = `${family.biome} ${S.floor}`;
  $('f-biome').textContent = isBossFloor(S.floor) ? `andar de chefe · ${family.boss}` : `mobs: ${family.mobs.join(' · ')}`;
  $('f-prog').style.width = `${Math.round((S.wave / totalWaves) * 100)}%`;
  $('f-wave').textContent = `${S.wave} / ${totalWaves}`;

  const phaseEl = $('p-phase');
  phaseEl.className = `pill ${S.phase === 'boss' ? 'boss' : S.phase === 'checkpoint' ? 'wipe' : ''}`;

  $('hud').innerHTML = [
    `<span class="stat">MODO <b>${S.mode}</b></span>`,
    `<span class="stat">FASE <b>${S.phase}</b></span>`,
    `<span class="stat">ANDARES CONCLUÍDOS <b>${S.cleared.length}</b></span>`,
    `<span class="stat">MELHOR <b>${S.highest}</b></span>`,
    `<span class="stat">EFEITOS <b>${S.effects.length}</b></span>`,
  ].join('');

  renderUnits();

  $('log').innerHTML = S.log.slice(0, 22).map((entry) => `<div><span class="t">${String(entry.at).padStart(5, '0')}</span> <span class="${entry.kind}">${entry.text}</span></div>`).join('');
  $('p-log').textContent = String(S.log.length);

  $('loot').innerHTML = S.loot.length === 0
    ? '<div class="mt" style="color:#475569">Derrota waves para gerar loot.</div>'
    : S.loot.map((item) => `
      <div class="item" style="border-color:rgb(${RARITY_COLOR[item.rarity]} / .5)">
        <div class="ic" style="box-shadow:0 0 12px -3px rgb(${RARITY_COLOR[item.rarity]})">${item.icon}</div>
        <div>
          <div class="nm" style="color:rgb(${RARITY_COLOR[item.rarity]})">${item.name}</div>
          <div class="mt">${RARITY_LABEL[item.rarity]} · ${item.slot}${item.affixes.length ? ` · ${item.affixes.length} afixos` : ''}</div>
        </div>
      </div>`).join('');

  $('fx-list').innerHTML = S.effects.length === 0
    ? '<span style="color:#475569">Nenhum efeito activo.</span>'
    : S.effects.map((fx) => `<div>${fx.kind === 'dot' ? '☠' : '✚'} <b>${fx.skill}</b> → ${fx.targetId} <span style="color:#475569">${fx.remaining.toFixed(1)}s</span></div>`).join('');
  $('p-fx').textContent = String(S.effects.length);

  $('btn-boss').style.display = isBossFloor(S.floor) ? 'inline-block' : 'none';
  $('btn-auto').textContent = S.running ? '⏸ Pausar' : '▶ Auto-batalha';
}

/* ------------------------------------------------------------ CONTROLO */
$('btn-auto').addEventListener('click', () => {
  S.running = !S.running;
  if (S.running && S.phase === 'idle') {
    S.phase = isBossFloor(S.floor) ? 'boss' : 'fighting';
    log(`▶ Combate iniciado no andar ${S.floor}`, '');
  }
  render();
});

$('btn-wave').addEventListener('click', () => {
  // Avança uma wave inteira instantaneamente (para explorar a máquina de estados).
  S.running = false;
  if (S.phase === 'idle') S.phase = isBossFloor(S.floor) ? 'boss' : 'fighting';
  if (S.phase === 'checkpoint') S.phase = 'fighting';
  if (isBossFloor(S.floor) && S.wave >= BOSS_WAVE) {
    log('⚠ A wave do chefe exige o botão "Desafiar chefe" ou auto-batalha.', 'boss');
    render();
    return;
  }
  onWaveClear();
  render();
});

$('btn-boss').addEventListener('click', () => {
  S.wave = BOSS_WAVE;
  S.phase = 'boss';
  S.running = true;
  buildUnits();
  log(`☠ CHEFE ${familyFor(S.floor).boss} — andar ${S.floor}`, 'boss');
  render();
});

$('btn-wipe').addEventListener('click', () => {
  S.running = false;
  applyWipe();
  render();
});

$('btn-farm').addEventListener('click', () => {
  S.mode = S.mode === 'farm' ? 'advance' : 'farm';
  log(`🌾 Modo ${S.mode}`, '');
  render();
});

$('btn-reset').addEventListener('click', () => {
  Object.assign(S, {
    phase: 'idle', floor: 1, wave: 1, highest: 1, checkpoint: 1, cleared: [],
    mode: 'advance', gold: 0, loot: [], log: [], effects: [], running: false, ticks: 0,
    seed: Math.floor(Math.random() * 1e9),
  });
  S.rng = createRng(S.seed);
  buildUnits();
  log(`↻ Reiniciado (seed ${S.seed})`, '');
  render();
});

/* --------------------------------------------------------------- TABELAS */
function renderRarityTable() {
  const floors = [1, 10, 20, 30];
  const rows = RARITY_ORDER.map((rarity) => `
    <tr>
      <td style="color:rgb(${RARITY_COLOR[rarity]})">${RARITY_LABEL[rarity]}</td>
      ${floors.map((floor) => `<td class="r">${rarityWeightsForFloor(floor)[rarity].toFixed(2)}</td>`).join('')}
    </tr>`).join('');
  $('rarity-table').querySelector('tbody').innerHTML = rows;
}

function renderRaces() {
  const races = [
    ['Humano', '+6% EXP · +2 drop'],
    ['Anão', '+6% HP · +14 DEF'],
    ['Elfo', '+16 FLEE · +6 HIT'],
    ['Goblin', '+12% ASPD · +3 crit'],
    ['Orc', '+6% ATK · +25% ATK c/ HP baixo'],
    ['Tauren', '+12% HP · +6 DEF'],
    ['Pandaren', '+1.5% regen/s · +15% resist.'],
    ['Morto-Vivo', '+5% roubo de vida · +10 MDEF'],
    ['Troll', '+3% regen/s · +20% dur. buffs'],
  ];
  $('race-list').innerHTML = races.map(([name, mods]) => `
    <div style="display:flex;justify-content:space-between;gap:8px">
      <span style="color:#e2e8f0">${name}</span>
      <span style="font-family:var(--mono);font-size:9.5px;color:#64748b">${mods}</span>
    </div>`).join('');
  $('p-races').textContent = `${races.length} raças`;
}

/* ----------------------------------------------------------------- LOOP */
let last = 0;
function frame(ts) {
  if (!last) last = ts;
  const delta = Math.min((ts - last) / 1000, 0.2);
  last = ts;
  tick(delta);
  render();
  requestAnimationFrame(frame);
}

buildUnits();
renderRarityTable();
renderRaces();
log(`▶ Aetheria — andar 1 · ${familyFor(1).biome}`, '');
render();
requestAnimationFrame(frame);
