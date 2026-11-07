/* =============================================================================
   ESPELHO DOS CATÁLOGOS — demo da etapa 3
   -----------------------------------------------------------------------------
   Duplica (conscientemente) src/data/{races,classes,skills,items,tower}.ts e
   src/lib/game/paperdoll.ts para correr sem bundler. A fonte de verdade é
   sempre o TypeScript; se divergir, o errado é este ficheiro.
   ========================================================================== */

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_LABEL = {
  common: 'Comum', uncommon: 'Incomum', rare: 'Rara',
  epic: 'Épica', legendary: 'Lendária', mythic: 'Mítica',
};
const RARITY_COLOR = {
  common: '156 163 175', uncommon: '74 222 128', rare: '56 189 248',
  epic: '167 139 250', legendary: '251 191 36', mythic: '244 114 182',
};
const RARITY_GLOW = {
  common: 'rgb(156 163 175 / 0.35)', uncommon: 'rgb(74 222 128 / 0.45)', rare: 'rgb(56 189 248 / 0.5)',
  epic: 'rgb(167 139 250 / 0.55)', legendary: 'rgb(251 191 36 / 0.6)', mythic: 'rgb(244 114 182 / 0.65)',
};
const LAYER_ORDER = ['aura', 'wings', 'body', 'armor', 'helmet', 'weapon', 'vfx'];

/* --------------------------------------------------------------- ÂNCORAS */
const ZERO_ANCHOR = { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false };
const CANVAS = { width: 256, height: 256, displayScale: 1 };

function buildPaperdoll(slug) {
  return {
    bodyLayer: { src: `/assets/paperdoll/races/${slug}.png`, sheet: { frameWidth: 256, frameHeight: 256, columns: 4, rows: 1, fps: 8 } },
    canvas: CANVAS,
    anchors: { aura: ZERO_ANCHOR, wings: ZERO_ANCHOR, body: ZERO_ANCHOR, armor: ZERO_ANCHOR, helmet: ZERO_ANCHOR, weapon: ZERO_ANCHOR, vfx: ZERO_ANCHOR },
    animations: ['idle', 'attack', 'hit', 'cast', 'death'],
  };
}

const RACES = [
  { id: 'race.human', name: 'Humano', slug: 'human', mods: ['+6% EXP', '+2% drop'], attr: '+1 em tudo', palette: { skin: '#e8c39e', hair: '#4a3728', primary: '#3b82f6', accent: '#93c5fd' }, unlock: 'default' },
  { id: 'race.dwarf', name: 'Anão', slug: 'dwarf', mods: ['+6% HP', '+14 DEF'], attr: '+3 VIT', palette: { skin: '#d9a87c', hair: '#a16207', primary: '#b45309', accent: '#fbbf24' }, unlock: 'default' },
  { id: 'race.elf', name: 'Elfo', slug: 'elf', mods: ['+16 FLEE', '+6 HIT'], attr: '+2 AGI +2 DEX', palette: { skin: '#f2d9c0', hair: '#e8e8e8', primary: '#10b981', accent: '#6ee7b7' }, unlock: 'default' },
  { id: 'race.goblin', name: 'Goblin', slug: 'goblin', mods: ['+12% ASPD', '+3 crit'], attr: '+2 AGI +2 DEX', palette: { skin: '#7cb342', hair: '#3e2723', primary: '#65a30d', accent: '#bef264' }, unlock: 'default' },
  { id: 'race.orc', name: 'Orc', slug: 'orc', mods: ['+6% ATK', '+25% ATK c/ HP baixo'], attr: '+3 STR', palette: { skin: '#6b8f3a', hair: '#1c1917', primary: '#7f1d1d', accent: '#f97316' }, unlock: 'default' },
  { id: 'race.tauren', name: 'Tauren', slug: 'tauren', mods: ['+12% HP', '+6 DEF'], attr: '+4 VIT', palette: { skin: '#8d6e63', hair: '#4e342e', primary: '#78350f', accent: '#fcd34d' }, unlock: 'default' },
  { id: 'race.pandaren', name: 'Pandaren', slug: 'pandaren', mods: ['+1.5% regen/s', '+15% resist. controlo'], attr: '+2 VIT +2 STR', palette: { skin: '#f5f0e1', hair: '#1f2937', primary: '#0f766e', accent: '#5eead4' }, unlock: 'market' },
  { id: 'race.undead', name: 'Renascido', slug: 'undead', mods: ['+4% roubo de vida', '+10 MDEF'], attr: '+2 INT +2 LUK', palette: { skin: '#9ca3af', hair: '#1e1b4b', primary: '#6d28d9', accent: '#a78bfa' }, unlock: 'achievement' },
  { id: 'race.troll', name: 'Troll', slug: 'troll', mods: ['+3% regen/s', '+20% dur. buffs'], attr: '+2 AGI +2 VIT', palette: { skin: '#4d7c0f', hair: '#1c1917', primary: '#365314', accent: '#a3e635' }, unlock: 'market' },
].map((race) => ({ ...race, paperdoll: buildPaperdoll(race.slug) }));

/* ---------------------------------------------------------- SLOT → CAMADA */
const SLOT_BINDINGS = [
  { slot: 'aura', layer: 'aura', zOffset: 0 },
  { slot: 'wings', layer: 'wings', zOffset: 0 },
  { slot: 'cloak', layer: 'body', zOffset: -20 },
  { slot: 'boots', layer: 'armor', zOffset: -10 },
  { slot: 'armor', layer: 'armor', zOffset: 0 },
  { slot: 'helmet', layer: 'helmet', zOffset: 0 },
  { slot: 'weapon', layer: 'weapon', zOffset: 0 },
  { slot: 'offhand', layer: 'weapon', zOffset: -5 },
  { slot: 'accessory', layer: 'vfx', zOffset: 0 },
];

/* ------------------------------------------------------------------ ITENS */
const ITEMS = [
  { id: 'item.wpn.iron_sword', slot: 'weapon', name: 'Espada de Ferro', rarity: 'common', icon: 'sword', glow: null, layer: 'weapon', folder: 'weapon' },
  { id: 'item.wpn.hunter_bow', slot: 'weapon', name: 'Arco do Caçador', rarity: 'uncommon', icon: 'bow', glow: null, layer: 'weapon', folder: 'weapon' },
  { id: 'item.wpn.arcane_staff', slot: 'weapon', name: 'Cajado Arcano', rarity: 'rare', icon: 'staff', glow: RARITY_GLOW.rare, layer: 'weapon', folder: 'weapon' },
  { id: 'item.wpn.shadow_dagger', slot: 'weapon', name: 'Adaga das Sombras', rarity: 'epic', icon: 'dagger', glow: RARITY_GLOW.epic, layer: 'weapon', folder: 'weapon' },
  { id: 'item.wpn.dragon_spear', slot: 'weapon', name: 'Lança do Dragão', rarity: 'legendary', icon: 'spear', glow: RARITY_GLOW.legendary, layer: 'weapon', folder: 'weapon' },
  { id: 'item.wpn.iron_mace', slot: 'weapon', name: 'Maça de Guerra', rarity: 'uncommon', icon: 'mace', glow: null, layer: 'weapon', folder: 'weapon' },
  { id: 'item.arm.leather_vest', slot: 'armor', name: 'Colete de Couro', rarity: 'common', icon: 'vest', glow: null, layer: 'armor', folder: 'armor' },
  { id: 'item.arm.plate_mail', slot: 'armor', name: 'Cota de Malha', rarity: 'uncommon', icon: 'mail', glow: null, layer: 'armor', folder: 'armor' },
  { id: 'item.arm.arcane_robe', slot: 'armor', name: 'Túnica Arcana', rarity: 'rare', icon: 'robe', glow: RARITY_GLOW.rare, layer: 'armor', folder: 'armor' },
  { id: 'item.arm.abyssal_plate', slot: 'armor', name: 'Placa Abissal', rarity: 'mythic', icon: 'abyss', glow: RARITY_GLOW.mythic, layer: 'armor', folder: 'armor' },
  { id: 'item.arm.scout_garb', slot: 'armor', name: 'Traje de Batedor', rarity: 'uncommon', icon: 'garb', glow: null, layer: 'armor', folder: 'armor' },
  { id: 'item.hlm.leather_cap', slot: 'helmet', name: 'Gorro de Couro', rarity: 'common', icon: 'cap', glow: null, layer: 'helmet', folder: 'helmet' },
  { id: 'item.hlm.iron_helm', slot: 'helmet', name: 'Elmo de Ferro', rarity: 'uncommon', icon: 'helm', glow: null, layer: 'helmet', folder: 'helmet' },
  { id: 'item.hlm.arcane_hood', slot: 'helmet', name: 'Capuz Arcano', rarity: 'rare', icon: 'hood', glow: RARITY_GLOW.rare, layer: 'helmet', folder: 'helmet' },
  { id: 'item.off.wooden_shield', slot: 'offhand', name: 'Escudo de Madeira', rarity: 'common', icon: 'shield', glow: null, layer: 'weapon', folder: 'weapon' },
  { id: 'item.off.tower_shield', slot: 'offhand', name: 'Escudo Torre', rarity: 'epic', icon: 'tower_shield', glow: RARITY_GLOW.epic, layer: 'weapon', folder: 'weapon' },
  { id: 'item.off.grimoire', slot: 'offhand', name: 'Grimório', rarity: 'rare', icon: 'grimoire', glow: RARITY_GLOW.rare, layer: 'weapon', folder: 'weapon' },
  { id: 'item.clk.traveler_cloak', slot: 'cloak', name: 'Capa do Viajante', rarity: 'uncommon', icon: 'cloak', glow: null, layer: 'body', folder: 'armor' },
  { id: 'item.bts.swift_boots', slot: 'boots', name: 'Botas Velozes', rarity: 'rare', icon: 'boots', glow: RARITY_GLOW.rare, layer: 'armor', folder: 'armor' },
  { id: 'item.acc.lucky_charm', slot: 'accessory', name: 'Amuleto da Sorte', rarity: 'epic', icon: 'charm', glow: RARITY_GLOW.epic, layer: 'vfx', folder: 'aura' },
];
const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

/* ---------------------------------------------------------------- CLASSES */
const BASE_CLASSES = [
  { id: 'warrior', name: 'Guerreiro', role: 'tank', main: 'STR', icon: '⚔️', specs: ['paladin', 'berserker'] },
  { id: 'hunter', name: 'Caçador', role: 'dps', main: 'DEX', icon: '🏹', specs: ['sharpshooter', 'assassin'] },
  { id: 'cleric', name: 'Clérigo', role: 'healer', main: 'INT', icon: '✨', specs: ['divine_priest', 'inquisitor'] },
  { id: 'mage', name: 'Mago', role: 'dps', main: 'INT', icon: '🔮', specs: ['archmage', 'warlock'] },
];
const SPECS = [
  { id: 'paladin', name: 'Paladino', base: 'warrior', icon: '🛡️', focus: 'Suporte sagrado e escudos' },
  { id: 'berserker', name: 'Berserker', base: 'warrior', icon: '🪓', focus: 'Roubo de vida e dano' },
  { id: 'sharpshooter', name: 'Atirador de Elite', base: 'hunter', icon: '🎯', focus: 'Crítico à distância' },
  { id: 'assassin', name: 'Assassino', base: 'hunter', icon: '🗡️', focus: 'Esquiva e veneno' },
  { id: 'divine_priest', name: 'Sacerdote Divino', base: 'cleric', icon: '💫', focus: 'Cura e protecção' },
  { id: 'inquisitor', name: 'Inquisidor', base: 'cleric', icon: '⚡', focus: 'Dano sagrado híbrido' },
  { id: 'archmage', name: 'Arquimago', base: 'mage', icon: '🌋', focus: 'Área e haste' },
  { id: 'warlock', name: 'Bruxo', base: 'mage', icon: '👁️', focus: 'DoT, debuffs, invocações' },
];
const TALENT_TREES = ['burst', 'utility', 'sustain'];

/* ----------------------------------------------------------------- SKILLS */
const SCALE = { common: 1, uncommon: 1.12, rare: 1.24, epic: 1.38, legendary: 1.55, mythic: 1.79 };
const SKILL_SEEDS = [
  ['paladin', 'Martelo da Justiça', 'ATK com stun de 2s', 250, 'rare', 14, 30, 0],
  ['paladin', 'Escudo Divino', 'Imunidade a dano por 4s', 200, 'epic', 45, 60, 0],
  ['paladin', 'Aura de Devoção', 'DEF do squad +15%', 15, 'uncommon', 30, 40, 0],
  ['paladin', 'Muralha de Fé', 'Passiva: DEF física', 10, 'common', 0, 0, 0],
  ['berserker', 'Fúria Sangrenta', 'Roubo de vida crescente', 15, 'rare', 25, 30, 0],
  ['berserker', 'Redemoinho', 'ATK em área, cura por alvo', 250, 'epic', 10, 30, 0],
  ['berserker', 'Rugido Desafiador', 'Provoca e reduz ATK', 10, 'uncommon', 12, 15, 0],
  ['berserker', 'Sede de Sangue', 'Passiva: roubo de vida', 8, 'rare', 0, 0, 0],
  ['sharpshooter', 'Tiro Mortal', 'ATK com crítico garantido', 420, 'epic', 8, 30, 0],
  ['sharpshooter', 'Marcar Alvo', 'Dano extra do squad', 10, 'rare', 16, 20, 0],
  ['sharpshooter', 'Rajada Tripla', '3 flechas de ATK', 150, 'uncommon', 5, 15, 0],
  ['sharpshooter', 'Mira Firme', 'Passiva: crit por segundo', 3, 'common', 0, 0, 0],
  ['assassin', 'Golpe Furtivo', 'ATK triplo no primeiro golpe', 420, 'epic', 8, 30, 0],
  ['assassin', 'Lâmina Envenenada', 'Veneno por segundo, 6s', 60, 'rare', 10, 20, 0],
  ['assassin', 'Passo das Sombras', 'Esquiva por 4s', 30, 'uncommon', 15, 20, 0],
  ['assassin', 'Venenos Letais', 'Passiva: dano de veneno', 15, 'common', 0, 0, 0],
  ['divine_priest', 'Cura Maior', 'MATK em cura no aliado', 420, 'epic', 6, 35, 1.2],
  ['divine_priest', 'Cura em Grupo', 'MATK em cura no squad', 250, 'legendary', 12, 60, 1.5],
  ['divine_priest', 'Renovar', 'Cura por segundo, 8s', 60, 'rare', 8, 25, 0],
  ['divine_priest', 'Graça Divina', 'Passiva: cura aumentada', 10, 'common', 0, 0, 0],
  ['inquisitor', 'Chama Sagrada', 'MATK, 50% vira cura', 300, 'epic', 8, 30, 0.5],
  ['inquisitor', 'Julgamento', 'MATK extra em chefes', 420, 'legendary', 10, 35, 0],
  ['inquisitor', 'Silenciar', 'Interrompe cast, 2s', 150, 'rare', 18, 25, 0],
  ['inquisitor', 'Dogma', 'Passiva: dano sagrado', 10, 'common', 0, 0, 0],
  ['archmage', 'Explosão Arcana', 'MATK em área', 300, 'epic', 10, 35, 1],
  ['archmage', 'Meteoro', 'MATK em área, cast longo', 800, 'mythic', 25, 80, 3],
  ['archmage', 'Barreira de Mana', 'Escudo no squad', 200, 'rare', 20, 45, 0],
  ['archmage', 'Sobrecarga Arcana', 'Passiva: MATK', 10, 'common', 0, 0, 0],
  ['warlock', 'Seta Sombria', 'MATK directo', 420, 'epic', 8, 30, 0.5],
  ['warlock', 'Corrupção', 'MATK por segundo, 8s', 60, 'rare', 12, 25, 0],
  ['warlock', 'Drenar Vida', 'MATK, cura 30% do dano', 250, 'legendary', 10, 30, 1],
  ['warlock', 'Mestre das Maldições', 'Passiva: duração de DoT', 20, 'common', 0, 0, 0],
];
const SKILLS = SKILL_SEEDS.map(([spec, name, desc, base, rarity, cd, mp, cast]) => ({
  spec, name, desc, rarity, cooldown: cd, mp, cast,
  values: RARITY_ORDER.reduce((acc, r) => ({ ...acc, [r]: Math.round(base * SCALE[r]) }), {}),
}));

/* ------------------------------------------------------------------ TORRE */
const BIOMES = {
  meadow: { name: 'Planície', element: 'neutral', icon: '🌾' },
  forest: { name: 'Floresta', element: 'earth', icon: '🌲' },
  cavern: { name: 'Cavernas', element: 'fire', icon: '🔥' },
  frozen: { name: 'Pico', element: 'water', icon: '❄️' },
  ruins: { name: 'Ruínas', element: 'holy', icon: '🏛️' },
  abyss: { name: 'Abismo', element: 'dark', icon: '🕳️' },
};
const FAMILIES = [
  { biome: 'meadow', mobs: ['Gosma Verde', 'Javali Selvagem'], boss: 'Rex Rochoso', icon: '🦖' },
  { biome: 'forest', mobs: ['Lobo Sombrio', 'Treant'], boss: 'T-Rex Ancião', icon: '🦕' },
  { biome: 'cavern', mobs: ['Salamandra', 'Golem de Pedra'], boss: 'Rei Lich', icon: '💀' },
  { biome: 'frozen', mobs: ['Sílfide do Gelo', 'Troll de Gelo'], boss: 'Wyrm Congelado', icon: '🐉' },
  { biome: 'ruins', mobs: ['Espectro', 'Constructo Guardião'], boss: 'Serafim Caído', icon: '👼' },
  { biome: 'abyss', mobs: ['Sabujo Abissal', 'Espectro do Vazio'], boss: 'Soberano do Abismo', icon: '👑' },
];
const FLOORS = Array.from({ length: 30 }, (_, i) => {
  const floor = i + 1;
  const family = FAMILIES[Math.min(5, Math.floor(i / 5))];
  return { floor, biome: family.biome, mobs: family.mobs, boss: family.boss, bossIcon: family.icon, isBoss: floor % 10 === 0 };
});

/* ============================== RESOLVER ============================== */
function highestRarity(rarities) {
  let best = null;
  for (const rarity of rarities) {
    if (best === null || RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf(best)) best = rarity;
  }
  return best;
}

function resolvePaperdoll({ race, equipment }) {
  const layers = [];
  const slots = [];

  const bodyAnchor = race.paperdoll.anchors.body;
  layers.push({
    key: 'body', src: race.paperdoll.bodyLayer.src, anchor: bodyAnchor,
    tint: race.palette.skin, order: LAYER_ORDER.indexOf('body'), zOffset: 0, slot: null,
    color: race.palette.primary,
  });

  for (const binding of SLOT_BINDINGS) {
    const itemId = equipment[binding.slot];
    if (!itemId) continue;
    const item = ITEM_BY_ID.get(itemId);
    if (!item) continue;
    layers.push({
      key: binding.layer,
      src: `/assets/paperdoll/${item.folder}/${item.icon}.png`,
      anchor: race.paperdoll.anchors[binding.layer] ?? ZERO_ANCHOR,
      tint: null,
      order: LAYER_ORDER.indexOf(binding.layer),
      zOffset: binding.zOffset,
      slot: binding.slot,
      color: item.glow ?? `rgb(${RARITY_COLOR[item.rarity]})`,
      name: item.name,
    });
    slots.push({ slot: binding.slot, name: item.name, rarity: item.rarity, layer: binding.layer });
  }

  layers.sort((a, b) => (a.order === b.order ? a.zOffset - b.zOffset : a.order - b.order));
  const glowRarity = highestRarity(slots.map((slot) => slot.rarity));
  return { layers, slots, glow: glowRarity ? RARITY_GLOW[glowRarity] : null, glowRarity };
}

/* ================================ ESTADO ============================== */
const STATE = {
  raceId: 'race.human',
  equipment: {
    weapon: 'item.wpn.iron_sword',
    armor: 'item.arm.leather_vest',
    helmet: 'item.hlm.leather_helmet' in ITEM_BY_ID ? 'item.hlm.leather_helmet' : 'item.hlm.leather_cap',
    offhand: null, cloak: null, boots: null, accessory: null, aura: null, wings: null,
  },
  specTab: 'archmage',
  floor: 1,
};

const $ = (id) => document.getElementById(id);

/* =============================== RENDER =============================== */
function renderRaces() {
  $('race-list').innerHTML = RACES.map((race) => `
    <div class="race ${race.id === STATE.raceId ? 'active' : ''}" data-race="${race.id}">
      <div style="font-size:26px">${raceEmoji(race.slug)}</div>
      <div class="nm">${race.name}</div>
      <div class="rs">${race.unlock}</div>
    </div>`).join('');

  for (const node of document.querySelectorAll('[data-race]')) {
    node.addEventListener('click', () => {
      STATE.raceId = node.getAttribute('data-race');
      render();
    });
  }
}

function raceEmoji(slug) {
  const map = { human: '🧑', dwarf: '🧔', elf: '🧝', goblin: '👺', orc: '👹', tauren: '🐂', pandaren: '🐼', undead: '💀', troll: '🧌' };
  return map[slug] ?? '🧑';
}

function renderSlots() {
  const race = RACES.find((r) => r.id === STATE.raceId);
  const options = Object.keys(STATE.equipment);
  $('slot-list').innerHTML = options.map((slot) => {
    const itemId = STATE.equipment[slot];
    const item = itemId ? ITEM_BY_ID.get(itemId) : null;
    const available = ITEMS.filter((candidate) => candidate.slot === slot);
    return `<div class="slot ${item ? 'on' : ''}" data-slot="${slot}">
      <div class="lbl">${slot}</div>
      <div class="it" style="color:${item ? `rgb(${RARITY_COLOR[item.rarity]})` : '#475569'}">${item ? item.name : '—'}</div>
      <div class="rar" style="color:${item ? `rgb(${RARITY_COLOR[item.rarity]})` : '#334155'}">${item ? RARITY_LABEL[item.rarity] : `${available.length} disp.`}</div>
    </div>`;
  }).join('');

  for (const node of document.querySelectorAll('[data-slot]')) {
    node.addEventListener('click', () => {
      const slot = node.getAttribute('data-slot');
      const available = ITEMS.filter((candidate) => candidate.slot === slot).map((candidate) => candidate.id);
      const current = STATE.equipment[slot];
      const index = current ? available.indexOf(current) : -1;
      STATE.equipment[slot] = index + 1 >= available.length ? null : available[index + 1];
      render();
    });
  }
  return race;
}

function renderAvatar(race) {
  const resolved = resolvePaperdoll({ race, equipment: STATE.equipment });
  const box = $('avatar');
  const px = 256;
  const scale = px / race.paperdoll.canvas.width;

  box.style.boxShadow = resolved.glow
    ? `inset 0 0 30px ${resolved.glow}, 0 0 24px ${resolved.glow}, inset 0 0 0 1px #334155`
    : 'inset 0 0 0 1px #334155';

  box.innerHTML = resolved.layers.map((layer) => {
    const x = layer.anchor.x * scale;
    const y = layer.anchor.y * scale;
    return `<div class="layer" style="
      left:${x}px;top:${y}px;width:${px}px;height:${px};
      display:grid;place-items:center;
      background:${layer.key === 'body'
        ? `radial-gradient(circle at 50% 34%, ${layer.color} 0%, transparent 68%)`
        : `radial-gradient(circle at 50% 50%, ${layer.color}44 0%, transparent 62%)`};
      ${layer.key === 'body' ? `border-radius:50% 50% 46% 46%;` : ''}
      z-index:${layer.order * 10 + layer.zOffset};
    ">${layer.key === 'body'
      ? `<span style="font-size:96px;filter:drop-shadow(0 0 12px ${race.palette.accent})">${raceEmoji(race.slug)}</span>`
      : `<span style="font-size:${layer.key === 'weapon' ? 54 : 34}px;opacity:.92">${layerGlyph(layer)}</span>`}
    </div>`;
  }).join('');

  $('p-glow').textContent = resolved.glowRarity ? `glow: ${RARITY_LABEL[resolved.glowRarity]}` : 'sem glow';

  $('layer-list').innerHTML = resolved.layers.map((layer, index) => `
    <div><b>${String(index + 1).padStart(2, '0')}</b> ${layer.key.padEnd(8)} ${layer.slot ? `slot=${layer.slot}` : 'base'} <span class="z">z=${layer.order * 10 + layer.zOffset}</span>${layer.name ? ` · ${layer.name}` : ''}</div>
  `).join('');

  renderSizes(race);
}

function layerGlyph(layer) {
  const map = {
    weapon: '⚔️', helmet: '⛑️', armor: '🥋', offhand: '🛡️', cloak: '🧥', boots: '🥾',
    accessory: '💎', aura: '🔆', wings: '🪽', vfx: '✨',
  };
  return map[layer.slot ?? layer.key] ?? '◆';
}

function renderSizes(race) {
  const sizes = [['sm', 48], ['md', 96], ['lg', 160], ['xl', 256]];
  $('size-row').innerHTML = sizes.map(([label, px]) => `
    <div>
      <div class="avatar" style="width:${px}px;height:${px}px;box-shadow:inset 0 0 0 1px #334155">
        <div style="position:absolute;inset:0;display:grid;place-items:center;
          background:radial-gradient(circle at 50% 34%, ${race.palette.primary} 0%, transparent 68%)">
          <span style="font-size:${Math.round(px * 0.45)}px">${raceEmoji(race.slug)}</span>
        </div>
      </div>
      <div class="lbl">${label} · ${px}px</div>
    </div>`).join('');
}

function renderSkills() {
  $('spec-tabs').innerHTML = SPECS.map((spec) => `
    <div class="tab ${spec.id === STATE.specTab ? 'on' : ''}" data-spec="${spec.id}">${spec.icon} ${spec.name}</div>`).join('');

  for (const node of document.querySelectorAll('[data-spec]')) {
    node.addEventListener('click', () => {
      STATE.specTab = node.getAttribute('data-spec');
      renderSkills();
    });
  }

  const list = SKILLS.filter((skill) => skill.spec === STATE.specTab);
  $('skill-list').innerHTML = list.map((skill) => `
    <div class="skill">
      <div class="top">
        <span class="nm">${skill.name}</span>
        <span class="meta" style="color:rgb(${RARITY_COLOR[skill.rarity]})">${RARITY_LABEL[skill.rarity]}</span>
      </div>
      <div class="desc">${skill.desc}</div>
      <div class="meta" style="margin-top:3px">CD ${skill.cooldown}s · MP ${skill.mp}${skill.cast ? ` · cast ${skill.cast}s` : ''}</div>
      <div class="vals">${RARITY_ORDER.map((r) => `<span style="color:rgb(${RARITY_COLOR[r]})">${skill.values[r]}</span>`).join('')}</div>
    </div>`).join('');
}

function renderClasses() {
  $('class-list').innerHTML = BASE_CLASSES.map((base) => {
    const specs = SPECS.filter((spec) => spec.base === base.id);
    return `<div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:18px">${base.icon}</span>
        <b style="font-size:13px">${base.name}</b>
        <span class="meta" style="font-family:var(--mono);font-size:9.5px;color:#64748b">${base.role.toUpperCase()} · ${base.main}</span>
      </div>
      ${specs.map((spec) => `
        <div style="display:flex;justify-content:space-between;gap:8px;padding:5px 9px;border-radius:7px;background:#0f172a;border:1px solid #1e293b;margin-bottom:4px">
          <span style="font-size:11.5px">${spec.icon} ${spec.name}</span>
          <span style="font-family:var(--mono);font-size:9.5px;color:#64748b">${spec.focus} · ${TALENT_TREES.length * 4} talentos</span>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function renderFloors() {
  $('floor-grid').innerHTML = FLOORS.map((floor) => `
    <div class="floor ${floor.isBoss ? 'boss' : ''} ${floor.floor === STATE.floor ? 'sel' : ''}" data-floor="${floor.floor}">
      <span class="ic">${floor.isBoss ? floor.bossIcon : BIOMES[floor.biome].icon}</span>
      ${floor.floor}
      <span class="bi">${BIOMES[floor.biome].name}</span>
    </div>`).join('');

  for (const node of document.querySelectorAll('[data-floor]')) {
    node.addEventListener('click', () => {
      STATE.floor = Number(node.getAttribute('data-floor'));
      renderFloors();
      renderFloorDetail();
    });
  }
  renderFloorDetail();
}

function renderFloorDetail() {
  const floor = FLOORS.find((entry) => entry.floor === STATE.floor) ?? FLOORS[0];
  const biome = BIOMES[floor.biome];
  const scaling = {
    hp: Math.round((1 + (floor.floor - 1) * 0.18) * 100),
    atk: Math.round((1 + (floor.floor - 1) * 0.12) * 100),
    def: Math.round((1 + (floor.floor - 1) * 0.08) * 100),
  };
  $('floor-detail').innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:10px;border-radius:10px;background:#0f172a;border:1px solid #1e293b">
      <span style="font-size:22px">${biome.icon}</span>
      <div>
        <div style="font-size:12.5px"><b>Andar ${floor.floor}</b> — ${biome.name} · elemento ${biome.element}</div>
        <div style="font-family:var(--mono);font-size:10px;color:#64748b">
          mobs: ${floor.mobs.join(' / ')}${floor.isBoss ? ` · <span style="color:#fca5a5">CHEFE: ${floor.boss}</span>` : ''}
        </div>
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;font-family:var(--mono);font-size:10px">
        <span class="pill">HP ${scaling.hp}%</span>
        <span class="pill">ATK ${scaling.atk}%</span>
        <span class="pill">DEF ${scaling.def}%</span>
      </div>
    </div>`;
}

function render() {
  $('p-races').textContent = `${RACES.length} raças`;
  const race = renderSlots();
  renderAvatar(race);
  $('p-layers').textContent = `${resolvePaperdoll({ race, equipment: STATE.equipment }).layers.length} camadas`;
  $('p-floor').textContent = `andar ${STATE.floor}`;
}

renderRaces();
renderSkills();
renderClasses();
renderFloors();
render();
