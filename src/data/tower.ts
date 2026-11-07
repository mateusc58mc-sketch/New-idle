/**
 * Bestiário e Torre — 30 andares com 6 biomas.
 *
 * Estrutura por andar (wiki): 9 waves de mobs + wave 10 = boss-portão.
 * Andares múltiplos de 10 são de chefão e bloqueiam o avanço.
 *
 * Escala: `BALANCE.tower.enemyScaling` (HP +18%/andar, ATK +12%, DEF +8%).
 * Aqui só vivem os VALORES BASE; a progressão vem do balance.ts.
 */
import type {
  ContentId,
  DropTable,
  Element,
  FloorDefinition,
  Monster,
  MonsterRace,
  MonsterScaling,
  MonsterSize,
  DerivedStats,
} from '@/types/game';

/* ==========================================================================
 * BIOMAS
 * ========================================================================== */

export interface Biome {
  readonly id: ContentId;
  readonly name: string;
  readonly description: string;
  readonly element: Element;
  readonly palette: { readonly sky: string; readonly ground: string; readonly accent: string };
}

export const BIOMES: readonly Biome[] = [
  { id: 'biome.meadow', name: 'Planície de Prontera', description: 'Onde todos começam.', element: 'neutral', palette: { sky: '#1e3a5f', ground: '#14532d', accent: '#4ade80' } },
  { id: 'biome.forest', name: 'Floresta Sombria', description: 'As árvores ouvem.', element: 'earth', palette: { sky: '#0f2027', ground: '#1a2e05', accent: '#84cc16' } },
  { id: 'biome.cavern', name: 'Cavernas de Basalto', description: 'Eco, calor, nada de luz.', element: 'fire', palette: { sky: '#1c1917', ground: '#292524', accent: '#f97316' } },
  { id: 'biome.frozen', name: 'Pico Congelado', description: 'O vento corta antes da lâmina.', element: 'water', palette: { sky: '#0c4a6e', ground: '#e0f2fe', accent: '#38bdf8' } },
  { id: 'biome.ruins', name: 'Ruínas Sagradas', description: 'Algo ainda reza aqui.', element: 'holy', palette: { sky: '#1e1b4b', ground: '#312e81', accent: '#fde047' } },
  { id: 'biome.abyss', name: 'Abismo', description: 'O fundo da torre olha de volta.', element: 'dark', palette: { sky: '#0a0a0f', ground: '#1c0a2e', accent: '#a78bfa' } },
] as const;

export const BIOME_BY_ID: ReadonlyMap<ContentId, Biome> = new Map(BIOMES.map((biome) => [biome.id, biome]));

/* ==========================================================================
 * ESCALA E STATS BASE
 * ========================================================================== */

const DEFAULT_SCALING: MonsterScaling = {
  hpPerFloor: 0.18,
  atkPerFloor: 0.12,
  defPerFloor: 0.08,
  bossMultiplier: 8,
};

function baseStats(input: {
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly flee?: number;
  readonly crit?: number;
  readonly aps?: number;
}): DerivedStats {
  return {
    maxHp: input.hp,
    maxMp: 0,
    atk: input.atk,
    matk: input.atk,
    def: input.def,
    mdef: Math.round(input.def * 0.7),
    hit: 40,
    flee: input.flee ?? 5,
    crit: input.crit ?? 5,
    critDamage: 140,
    attackSpeed: input.aps ?? 0.8,
    castTime: 0,
    healPower: 0,
    lifesteal: 0,
    expBonus: 0,
    dropBonus: 0,
    regenPct: 0,
    controlResist: 0,
    lowHpAtk: 0,
    buffDuration: 0,
  };
}

/* ==========================================================================
 * MONSTROS
 * ========================================================================== */

interface MonsterSeed {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly size: MonsterSize;
  readonly race: MonsterRace;
  readonly element: Element;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly icon: string;
  readonly tier?: 'normal' | 'elite' | 'boss';
}

function buildMonster(seed: MonsterSeed): Monster {
  return {
    id: `monster.${seed.id}`,
    name: seed.name,
    description: seed.description,
    size: seed.size,
    race: seed.race,
    element: seed.element,
    baseStats: baseStats({ hp: seed.hp, atk: seed.atk, def: seed.def }),
    scaling: DEFAULT_SCALING,
    skills: [],
    sprite: { src: `/assets/monsters/${seed.icon}.png`, sheet: { frameWidth: 128, frameHeight: 128, columns: 4, rows: 1, fps: 8 } },
    dropTableId: `drops.${seed.id}`,
  };
}

const MONSTER_SEEDS: readonly MonsterSeed[] = [
  // Planície
  { id: 'slime', name: 'Gosma Verde', description: 'Bate pouco e morre rápido.', size: 'small', race: 'plant', element: 'neutral', hp: 180, atk: 18, def: 4, icon: 'slime' },
  { id: 'wild_boar', name: 'Javali Selvagem', description: 'Carga cega.', size: 'medium', race: 'beast', element: 'earth', hp: 260, atk: 26, def: 10, icon: 'boar' },
  { id: 'field_rat', name: 'Rato do Campo', description: 'Rápido e irritante.', size: 'small', race: 'beast', element: 'neutral', hp: 140, atk: 22, def: 2, icon: 'rat' },
  { id: 'meadow_sprite', name: 'Sílfide do Prado', description: 'Foge se a assustarem.', size: 'small', race: 'elemental', element: 'wind', hp: 220, atk: 30, def: 6, icon: 'sprite' },
  // Floresta
  { id: 'shadow_wolf', name: 'Lobo Sombrio', description: 'Caça em matilha.', size: 'medium', race: 'beast', element: 'dark', hp: 420, atk: 42, def: 14, icon: 'wolf' },
  { id: 'treant', name: 'Treant', description: 'Lento, teimoso, enorme.', size: 'large', race: 'plant', element: 'earth', hp: 900, atk: 34, def: 46, icon: 'treant' },
  { id: 'forest_spider', name: 'Aranha da Mata', description: 'Teias por todo o lado.', size: 'small', race: 'beast', element: 'poison', hp: 380, atk: 48, def: 10, icon: 'spider' },
  { id: 'moss_wolf', name: 'Lobo de Musgo', description: 'A camuflagem é quase perfeita.', size: 'medium', race: 'beast', element: 'earth', hp: 500, atk: 44, def: 18, icon: 'moss_wolf' },
  // Caverna
  { id: 'salamander', name: 'Salamandra', description: 'Deixa rasto de brasa.', size: 'small', race: 'beast', element: 'fire', hp: 520, atk: 62, def: 16, icon: 'salamander' },
  { id: 'stone_golem', name: 'Golem de Pedra', description: 'Uma parede que anda.', size: 'large', race: 'elemental', element: 'earth', hp: 1100, atk: 44, def: 62, icon: 'golem' },
  { id: 'magma_bat', name: 'Morcego de Magma', description: 'Deixa rasto de brasa no ar.', size: 'small', race: 'beast', element: 'fire', hp: 460, atk: 70, def: 8, icon: 'magma_bat' },
  { id: 'basalt_knight', name: 'Cavaleiro de Basalto', description: 'Armadura que nunca aqueceu.', size: 'medium', race: 'humanoid', element: 'fire', hp: 860, atk: 60, def: 44, icon: 'basalt_knight' },
  // Gelo
  { id: 'frost_sprite', name: 'Sílfide do Gelo', description: 'Bela até congelar.', size: 'small', race: 'elemental', element: 'water', hp: 640, atk: 74, def: 20, icon: 'frost' },
  { id: 'ice_troll', name: 'Troll de Gelo', description: 'Regenera no frio.', size: 'large', race: 'beast', element: 'water', hp: 1500, atk: 58, def: 74, icon: 'troll' },
  { id: 'snow_lynx', name: 'Lince das Neves', description: 'Salta antes de o veres.', size: 'medium', race: 'beast', element: 'water', hp: 700, atk: 82, def: 22, icon: 'lynx' },
  { id: 'frost_revenant', name: 'Espectro Gélido', description: 'Congela quem o toca.', size: 'medium', race: 'undead', element: 'water', hp: 920, atk: 78, def: 30, icon: 'revenant' },
  // Ruínas
  { id: 'specter', name: 'Espectro', description: 'Atravessa armadura, não a fé.', size: 'medium', race: 'undead', element: 'dark', hp: 720, atk: 88, def: 12, icon: 'specter' },
  { id: 'guardian_construct', name: 'Constructo Guardião', description: 'Ainda cumpre ordens antigas.', size: 'large', race: 'elemental', element: 'holy', hp: 1800, atk: 66, def: 88, icon: 'guardian' },
  { id: 'temple_acolyte', name: 'Acólito Corrompido', description: 'Reza para o lado errado.', size: 'medium', race: 'humanoid', element: 'holy', hp: 940, atk: 96, def: 34, icon: 'acolyte' },
  { id: 'stone_serpent', name: 'Serpente de Pedra', description: 'Esculturas que mordem.', size: 'large', race: 'elemental', element: 'earth', hp: 1600, atk: 88, def: 70, icon: 'serpent' },
  // Abismo
  { id: 'abyss_hound', name: 'Sabujo Abissal', description: 'Cheira medo.', size: 'medium', race: 'demon', element: 'dark', hp: 980, atk: 104, def: 34, icon: 'hound' },
  { id: 'void_wraith', name: 'Espectro do Vazio', description: 'Não tem forma fixa.', size: 'medium', race: 'demon', element: 'dark', hp: 1240, atk: 118, def: 40, icon: 'wraith' },
  { id: 'abyss_maw', name: 'Fauce do Abismo', description: 'Só tem dentes.', size: 'large', race: 'demon', element: 'dark', hp: 2100, atk: 132, def: 58, icon: 'maw' },
  { id: 'shadow_cultist', name: 'Cultista Sombrio', description: 'Canta enquanto sangra.', size: 'medium', race: 'humanoid', element: 'dark', hp: 1100, atk: 140, def: 36, icon: 'cultist' },
] as const;

export const MONSTERS: readonly Monster[] = MONSTER_SEEDS.map(buildMonster);

/* ==========================================================================
 * CHEFES
 * ========================================================================== */

const BOSS_SEEDS: readonly MonsterSeed[] = [
  { id: 'rock_rex', name: 'Rex Rochoso', description: 'O primeiro obstáculo a sério.', size: 'large', race: 'dragon', element: 'earth', hp: 5400, atk: 120, def: 70, icon: 'rock_rex', tier: 'boss' },
  { id: 'elder_trex', name: 'T-Rex Ancião', description: 'Cada passo abana a torre.', size: 'large', race: 'dragon', element: 'fire', hp: 6800, atk: 145, def: 82, icon: 'trex', tier: 'boss' },
  { id: 'lich_king', name: 'Rei Lich', description: 'Já reinou acima. Quer voltar.', size: 'medium', race: 'undead', element: 'dark', hp: 7600, atk: 168, def: 62, icon: 'lich', tier: 'boss' },
  { id: 'frost_wyrm', name: 'Wyrm Congelado', description: 'Dormiu mil anos neste pico.', size: 'large', race: 'dragon', element: 'water', hp: 9200, atk: 176, def: 96, icon: 'wyrm', tier: 'boss' },
  { id: 'fallen_seraph', name: 'Serafim Caído', description: 'Ainda acredita que é justo.', size: 'medium', race: 'elemental', element: 'holy', hp: 11800, atk: 198, def: 88, icon: 'seraph', tier: 'boss' },
  { id: 'abyss_sovereign', name: 'Soberano do Abismo', description: 'O que espera no 30.º andar.', size: 'large', race: 'demon', element: 'dark', hp: 16400, atk: 232, def: 110, icon: 'sovereign', tier: 'boss' },
] as const;

export const BOSSES: readonly Monster[] = BOSS_SEEDS.map(buildMonster);

export const MONSTER_BY_ID: ReadonlyMap<ContentId, Monster> = new Map(
  [...MONSTERS, ...BOSSES].map((monster) => [monster.id, monster]),
);

/* ==========================================================================
 * TABELAS DE DROP
 * ========================================================================== */

/** Mapa monstro → itens possíveis, com peso relativo. */
export const DROP_TABLES: readonly DropTable[] = [
  { id: 'drops.slime', goldChance: 0.6, goldRange: [8, 22], entries: [{ itemId: 'item.arm.leather_vest', weight: 60, minFloor: 1, maxFloor: 5, firstClearOnly: false }, { itemId: 'item.hlm.leather_cap', weight: 40, minFloor: 1, maxFloor: 5, firstClearOnly: false }] },
  { id: 'drops.wild_boar', goldChance: 0.6, goldRange: [10, 28], entries: [{ itemId: 'item.wpn.iron_sword', weight: 45, minFloor: 1, maxFloor: 8, firstClearOnly: false }, { itemId: 'item.off.wooden_shield', weight: 55, minFloor: 1, maxFloor: 8, firstClearOnly: false }] },
  { id: 'drops.shadow_wolf', goldChance: 0.65, goldRange: [20, 55], entries: [{ itemId: 'item.wpn.hunter_bow', weight: 50, minFloor: 4, maxFloor: 12, firstClearOnly: false }, { itemId: 'item.clk.traveler_cloak', weight: 50, minFloor: 4, maxFloor: 12, firstClearOnly: false }] },
  { id: 'drops.treant', goldChance: 0.7, goldRange: [26, 68], entries: [{ itemId: 'item.arm.plate_mail', weight: 60, minFloor: 5, maxFloor: 14, firstClearOnly: false }, { itemId: 'item.bts.swift_boots', weight: 40, minFloor: 8, maxFloor: 14, firstClearOnly: false }] },
  { id: 'drops.salamander', goldChance: 0.7, goldRange: [34, 88], entries: [{ itemId: 'item.hlm.iron_helm', weight: 55, minFloor: 9, maxFloor: 18, firstClearOnly: false }, { itemId: 'item.wpn.arcane_staff', weight: 45, minFloor: 10, maxFloor: 18, firstClearOnly: false }] },
  { id: 'drops.stone_golem', goldChance: 0.75, goldRange: [42, 104], entries: [{ itemId: 'item.off.tower_shield', weight: 40, minFloor: 12, maxFloor: 22, firstClearOnly: false }, { itemId: 'item.arm.arcane_robe', weight: 60, minFloor: 12, maxFloor: 22, firstClearOnly: false }] },
  { id: 'drops.frost_sprite', goldChance: 0.75, goldRange: [50, 126], entries: [{ itemId: 'item.hlm.arcane_hood', weight: 50, minFloor: 16, maxFloor: 26, firstClearOnly: false }, { itemId: 'item.off.grimoire', weight: 50, minFloor: 16, maxFloor: 26, firstClearOnly: false }] },
  { id: 'drops.ice_troll', goldChance: 0.8, goldRange: [58, 148], entries: [{ itemId: 'item.wpn.shadow_dagger', weight: 55, minFloor: 18, maxFloor: 30, firstClearOnly: false }, { itemId: 'item.acc.lucky_charm', weight: 45, minFloor: 20, maxFloor: 30, firstClearOnly: false }] },
  { id: 'drops.specter', goldChance: 0.8, goldRange: [64, 168], entries: [{ itemId: 'item.wpn.dragon_spear', weight: 30, minFloor: 24, maxFloor: 30, firstClearOnly: false }, { itemId: 'item.acc.lucky_charm', weight: 70, minFloor: 22, maxFloor: 30, firstClearOnly: false }] },
  { id: 'drops.guardian_construct', goldChance: 0.85, goldRange: [72, 190], entries: [{ itemId: 'item.arm.abyssal_plate', weight: 20, minFloor: 26, maxFloor: 30, firstClearOnly: false }, { itemId: 'item.wpn.dragon_spear', weight: 80, minFloor: 26, maxFloor: 30, firstClearOnly: false }] },
  { id: 'drops.abyss_hound', goldChance: 0.85, goldRange: [80, 210], entries: [{ itemId: 'item.arm.abyssal_plate', weight: 60, minFloor: 27, maxFloor: 30, firstClearOnly: false }, { itemId: 'item.wpn.dragon_spear', weight: 40, minFloor: 27, maxFloor: 30, firstClearOnly: false }] },
  { id: 'drops.void_wraith', goldChance: 0.9, goldRange: [88, 230], entries: [{ itemId: 'item.arm.abyssal_plate', weight: 100, minFloor: 28, maxFloor: 30, firstClearOnly: false }] },
  // --- Mobs adicionais (pool densificada: 4 por bioma) ---
  { id: 'drops.field_rat', goldChance: 0.55, goldRange: [6, 18], entries: [{ itemId: 'item.hlm.leather_cap', weight: 70, minFloor: 1, maxFloor: 5, firstClearOnly: false }, { itemId: 'item.arm.leather_vest', weight: 30, minFloor: 1, maxFloor: 5, firstClearOnly: false }] },
  { id: 'drops.meadow_sprite', goldChance: 0.6, goldRange: [9, 24], entries: [{ itemId: 'item.arm.leather_vest', weight: 60, minFloor: 1, maxFloor: 5, firstClearOnly: false }, { itemId: 'item.clk.traveler_cloak', weight: 40, minFloor: 3, maxFloor: 5, firstClearOnly: false }] },
  { id: 'drops.forest_spider', goldChance: 0.65, goldRange: [18, 48], entries: [{ itemId: 'item.wpn.hunter_bow', weight: 60, minFloor: 4, maxFloor: 12, firstClearOnly: false }, { itemId: 'item.arm.scout_garb', weight: 40, minFloor: 4, maxFloor: 12, firstClearOnly: false }] },
  { id: 'drops.moss_wolf', goldChance: 0.65, goldRange: [22, 58], entries: [{ itemId: 'item.clk.traveler_cloak', weight: 50, minFloor: 5, maxFloor: 12, firstClearOnly: false }, { itemId: 'item.arm.scout_garb', weight: 50, minFloor: 5, maxFloor: 12, firstClearOnly: false }] },
  { id: 'drops.magma_bat', goldChance: 0.7, goldRange: [30, 78], entries: [{ itemId: 'item.wpn.arcane_staff', weight: 45, minFloor: 9, maxFloor: 18, firstClearOnly: false }, { itemId: 'item.hlm.iron_helm', weight: 55, minFloor: 9, maxFloor: 18, firstClearOnly: false }] },
  { id: 'drops.basalt_knight', goldChance: 0.72, goldRange: [38, 96], entries: [{ itemId: 'item.arm.plate_mail', weight: 55, minFloor: 10, maxFloor: 18, firstClearOnly: false }, { itemId: 'item.wpn.iron_mace', weight: 45, minFloor: 10, maxFloor: 18, firstClearOnly: false }] },
  { id: 'drops.snow_lynx', goldChance: 0.75, goldRange: [46, 118], entries: [{ itemId: 'item.bts.swift_boots', weight: 55, minFloor: 16, maxFloor: 26, firstClearOnly: false }, { itemId: 'item.arm.arcane_robe', weight: 45, minFloor: 16, maxFloor: 26, firstClearOnly: false }] },
  { id: 'drops.frost_revenant', goldChance: 0.76, goldRange: [54, 138], entries: [{ itemId: 'item.hlm.arcane_hood', weight: 50, minFloor: 17, maxFloor: 26, firstClearOnly: false }, { itemId: 'item.off.grimoire', weight: 50, minFloor: 17, maxFloor: 26, firstClearOnly: false }] },
  { id: 'drops.temple_acolyte', goldChance: 0.8, goldRange: [62, 158], entries: [{ itemId: 'item.off.grimoire', weight: 50, minFloor: 21, maxFloor: 30, firstClearOnly: false }, { itemId: 'item.acc.lucky_charm', weight: 50, minFloor: 21, maxFloor: 30, firstClearOnly: false }] },
  { id: 'drops.stone_serpent', goldChance: 0.82, goldRange: [70, 180], entries: [{ itemId: 'item.off.tower_shield', weight: 50, minFloor: 23, maxFloor: 30, firstClearOnly: false }, { itemId: 'item.wpn.shadow_dagger', weight: 50, minFloor: 23, maxFloor: 30, firstClearOnly: false }] },
  { id: 'drops.abyss_maw', goldChance: 0.88, goldRange: [84, 205], entries: [{ itemId: 'item.wpn.dragon_spear', weight: 60, minFloor: 27, maxFloor: 30, firstClearOnly: false }, { itemId: 'item.arm.abyssal_plate', weight: 40, minFloor: 28, maxFloor: 30, firstClearOnly: false }] },
  { id: 'drops.shadow_cultist', goldChance: 0.88, goldRange: [80, 198], entries: [{ itemId: 'item.acc.lucky_charm', weight: 60, minFloor: 27, maxFloor: 30, firstClearOnly: false }, { itemId: 'item.arm.abyssal_plate', weight: 40, minFloor: 28, maxFloor: 30, firstClearOnly: false }] },
  // Chefes — drops garantidos no primeiro clear
  { id: 'drops.rock_rex', goldChance: 1, goldRange: [400, 800], entries: [{ itemId: 'item.off.tower_shield', weight: 100, minFloor: 10, maxFloor: 10, firstClearOnly: true }] },
  { id: 'drops.elder_trex', goldChance: 1, goldRange: [700, 1400], entries: [{ itemId: 'item.wpn.shadow_dagger', weight: 100, minFloor: 20, maxFloor: 20, firstClearOnly: true }] },
  { id: 'drops.lich_king', goldChance: 1, goldRange: [1100, 2200], entries: [{ itemId: 'item.off.grimoire', weight: 100, minFloor: 30, maxFloor: 30, firstClearOnly: true }] },
  { id: 'drops.frost_wyrm', goldChance: 1, goldRange: [1600, 3200], entries: [{ itemId: 'item.wpn.dragon_spear', weight: 100, minFloor: 40, maxFloor: 40, firstClearOnly: true }] },
  { id: 'drops.fallen_seraph', goldChance: 1, goldRange: [2400, 4800], entries: [{ itemId: 'item.acc.lucky_charm', weight: 100, minFloor: 50, maxFloor: 50, firstClearOnly: true }] },
  { id: 'drops.abyss_sovereign', goldChance: 1, goldRange: [3600, 7200], entries: [{ itemId: 'item.arm.abyssal_plate', weight: 100, minFloor: 30, maxFloor: 30, firstClearOnly: true }] },
] as const;

export const DROP_TABLE_BY_ID: ReadonlyMap<ContentId, DropTable> = new Map(DROP_TABLES.map((table) => [table.id, table]));

/* ==========================================================================
 * ANDARES — 30
 * ========================================================================== */

/** Família de andar → bioma + pool de mobs + chefe. */
interface FloorFamily {
  readonly biome: ContentId;
  readonly mobs: readonly ContentId[];
  readonly boss: ContentId | null;
  readonly namePrefix: string;
}

const FAMILIES: readonly FloorFamily[] = [
  { biome: 'biome.meadow', mobs: ['monster.slime', 'monster.wild_boar', 'monster.field_rat', 'monster.meadow_sprite'], boss: 'monster.rock_rex', namePrefix: 'Planície' },
  { biome: 'biome.forest', mobs: ['monster.shadow_wolf', 'monster.treant', 'monster.forest_spider', 'monster.moss_wolf'], boss: 'monster.elder_trex', namePrefix: 'Floresta' },
  { biome: 'biome.cavern', mobs: ['monster.salamander', 'monster.stone_golem', 'monster.magma_bat', 'monster.basalt_knight'], boss: 'monster.lich_king', namePrefix: 'Cavernas' },
  { biome: 'biome.frozen', mobs: ['monster.frost_sprite', 'monster.ice_troll', 'monster.snow_lynx', 'monster.frost_revenant'], boss: 'monster.frost_wyrm', namePrefix: 'Pico' },
  { biome: 'biome.ruins', mobs: ['monster.specter', 'monster.guardian_construct', 'monster.temple_acolyte', 'monster.stone_serpent'], boss: 'monster.fallen_seraph', namePrefix: 'Ruínas' },
  { biome: 'biome.abyss', mobs: ['monster.abyss_hound', 'monster.void_wraith', 'monster.abyss_maw', 'monster.shadow_cultist'], boss: 'monster.abyss_sovereign', namePrefix: 'Abismo' },
] as const;

function buildFloor(floor: number): FloorDefinition {
  // 30 andares / 6 famílias = 5 andares por família.
  const familyIndex = Math.min(FAMILIES.length - 1, Math.floor((floor - 1) / 5));
  const family = FAMILIES[familyIndex];
  if (!family) throw new Error(`sem família para o andar ${floor}`);

  const biome = BIOME_BY_ID.get(family.biome);
  if (!biome) throw new Error(`bioma desconhecido: ${family.biome}`);

  const isBossFloor = floor % 10 === 0;

  return {
    floor,
    name: `${family.namePrefix} ${floor}`,
    biome: family.biome,
    backgroundAsset: {
      src: `/assets/backgrounds/${family.biome.replace('biome.', '')}.png`,
      sheet: null,
    },
    wavesPerFloor: 9,
    isBossFloor,
    bossMonsterId: isBossFloor ? family.boss : null,
    mobPool: family.mobs,
    rewardMultiplier: 1 + (floor - 1) * 0.12,
  };
}

export const FLOORS: readonly FloorDefinition[] = Array.from({ length: 30 }, (_, index) => buildFloor(index + 1));

export const FLOOR_BY_NUMBER: ReadonlyMap<number, FloorDefinition> = new Map(FLOORS.map((floor) => [floor.floor, floor]));

export function getFloor(floor: number): FloorDefinition {
  const found = FLOOR_BY_NUMBER.get(floor);
  if (found) return found;
  // Fora dos 30 andares do MVP: continua a escalar com o último bioma.
  return buildFloor(Math.max(1, floor));
}

/**
 * Tabelas de drop disponíveis num andar — a pool do bioma.
 * Usado pelo sorteio quando a tabela específica não tem entradas elegíveis
 * (ex.: chefe já sem o drop de first-clear).
 */
export function floorDropTables(floor: number): readonly ContentId[] {
  const definition = getFloor(floor);
  return definition.mobPool
    .map((mobId) => MONSTER_BY_ID.get(mobId)?.dropTableId)
    .filter((tableId): tableId is ContentId => typeof tableId === 'string');
}
