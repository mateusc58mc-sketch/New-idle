/**
 * Construção de combatentes a partir do domínio (Character/Squad/Monster).
 *
 * Este é o único sítio que converte dados de jogo em actores de combate.
 * Sem isto, o motor e o HUD falavam línguas diferentes — era a razão pela
 * qual a demo tinha de duplicar números de HP/dano à mão.
 */
import type {
  Character,
  ContentId,
  DerivedStats,
  EnemyCombatant,
  EquipmentSlot,
  FormationPosition,
  InventoryItem,
  Item,
  Monster,
  MonsterTier,
  PlayerCombatant,
  Race,
  Squad,
  EquippedSkill,
} from '@/types/game';
import { BALANCE } from './balance';
import { computeCombatPower, equipmentEntries, resolveDerivedStats, type EquipmentEntry } from './stats';
import { MONSTER_BY_ID } from '@/data/tower';
import { ITEM_BY_ID } from '@/data/items';
import { RACE_BY_ID } from '@/data/races';

/* ==========================================================================
 * HERÓIS
 * ========================================================================== */

export interface BuildHeroInput {
  readonly character: Character;
  /** Catálogo de itens (injectável para testes). */
  readonly catalogue?: ReadonlyMap<string, Item>;
  /** Skills equipadas — por omissão derivadas de `character.skills`. */
  readonly skills?: readonly EquippedSkill[];
}

/** Converte um `Character` num `PlayerCombatant` com stats resolvidos. */
export function buildPlayerCombatant(input: BuildHeroInput): PlayerCombatant {
  const { character } = input;
  const catalogue = input.catalogue ?? ITEM_BY_ID;
  const race = RACE_BY_ID.get(character.raceId) ?? null;

  const equipment = equipmentEntries(character.equipment, catalogue);
  const stats = resolveDerivedStats({
    baseClass: character.baseClass,
    level: character.level,
    attributes: character.attributes,
    race,
    equipment,
    talents: talentModifiers(character),
    prestige: [],
    buffs: [],
  });

  const skills: readonly EquippedSkill[] =
    input.skills ??
    character.skills
      .filter((owned) => owned.equippedSlot !== null)
      .map((owned) => ({ skillId: owned.skillId, level: owned.level }));

  return {
    id: character.id,
    name: character.name,
    level: character.level,
    team: 'squad',
    position: character.position,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    mp: stats.maxMp,
    maxMp: stats.maxMp,
    shield: 0,
    stats,
    effects: [],
    attackCooldownSec: attackIntervalFor(stats),
    skillCooldowns: {},
    isAlive: true,
    characterId: character.id,
    baseClass: character.baseClass,
    appearance: character.appearance,
    skills,
  };
}

/**
 * Preserva HP/MP actuais ao reconstruir um combatente (level-up, equipamento).
 * Sem isto, trocar uma bota curava o squad inteiro.
 */
export function refreshPlayerCombatant(previous: PlayerCombatant, character: Character): PlayerCombatant {
  const rebuilt = buildPlayerCombatant({ character });
  const hpRatio = previous.maxHp > 0 ? previous.hp / previous.maxHp : 1;
  const mpRatio = previous.maxMp > 0 ? previous.mp / previous.maxMp : 1;

  return {
    ...rebuilt,
    hp: Math.max(1, Math.round(rebuilt.maxHp * hpRatio)),
    mp: Math.round(rebuilt.maxMp * mpRatio),
    shield: Math.min(previous.shield, rebuilt.maxHp),
    attackCooldownSec: previous.attackCooldownSec,
    skillCooldowns: previous.skillCooldowns,
    effects: previous.effects,
    skills: rebuilt.skills,
  };
}

/** Talentos do personagem → modificadores de stat. */
function talentModifiers(character: Character) {
  // Os talentos são guardados como lista plana (1 entrada por ponto).
  // A resolução real usa TALENT_BY_ID; mantido opcional para não acoplar.
  void character;
  return [];
}

function attackIntervalFor(stats: DerivedStats): number {
  const attacksPerSec = Math.max(0.1, stats.attackSpeed);
  return 1 / attacksPerSec;
}

/** Combat Power para o HUD (delega em `stats.ts`). */
export function heroCombatPower(character: Character): number {
  const combatant = buildPlayerCombatant({ character });
  return computeCombatPower(combatant.stats);
}

/* ==========================================================================
 * INIMIGOS
 * ========================================================================== */

export interface BuildEnemyInput {
  readonly monsterId: ContentId;
  readonly floor: number;
  readonly wave: number;
  readonly tier?: MonsterTier;
  /** Linha do inimigo na formação; chefes permanecem na frente. */
  readonly position?: FormationPosition;
  /** Multiplicador extra do chefe (curva exponencial da wiki). */
  readonly bossMultiplier?: number;
  readonly idSuffix?: string;
}

/** Escala os stats base do monstro pelo andar. */
export function scaleMonsterStats(monster: Monster, floor: number, tier: MonsterTier): DerivedStats {
  const scaling = BALANCE.tower.enemyScaling;
  const steps = Math.max(0, floor - 1);
  const hpFactor = Math.pow(1 + scaling.hpPerFloor, steps) * scaling.baseHpMultiplier;
  const atkFactor = Math.pow(1 + scaling.atkPerFloor, steps);
  const defFactor = Math.pow(1 + scaling.defPerFloor, steps);
  const bossHp = tier === 'boss' ? scaling.bossMultiplier : 1;
  const bossAtk = tier === 'boss' ? scaling.bossAtkMultiplier : 1;

  const base = monster.baseStats;
  return {
    ...base,
    maxHp: Math.round(base.maxHp * hpFactor * bossHp),
    atk: Math.round(base.atk * atkFactor * bossAtk),
    matk: Math.round(base.matk * atkFactor * bossAtk),
    def: Math.round(base.def * defFactor),
    mdef: Math.round(base.mdef * defFactor),
    hit: Math.round(base.hit + steps * 2),
    flee: Math.round(base.flee + steps),
  };
}

/** Converte um `Monster` num `EnemyCombatant` escalado para o andar. */
export function buildEnemyCombatant(input: BuildEnemyInput): EnemyCombatant | null {
  const monster = MONSTER_BY_ID.get(input.monsterId);
  if (!monster) return null;

  const tier: MonsterTier = input.tier ?? (input.monsterId.includes('boss') ? 'boss' : 'normal');
  const stats = scaleMonsterStats(monster, input.floor, tier);
  const suffix = input.idSuffix ?? '0';

  return {
    id: `${input.monsterId}:${input.floor}:${input.wave}:${suffix}`,
    name: monster.name,
    level: Math.max(1, Math.round(input.floor * 2)),
    team: 'enemy',
    position: tier === 'boss' ? 'front' : input.position ?? 'front',
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    mp: 0,
    maxMp: 0,
    shield: 0,
    stats,
    effects: [],
    attackCooldownSec: attackIntervalFor(stats),
    skillCooldowns: {},
    isAlive: true,
    monsterId: monster.id,
    tier,
    element: monster.element,
    paperdoll: null,
    skills: [],
  };
}

/* ==========================================================================
 * SQUAD COMPLETO
 * ========================================================================== */

export interface BuildWaveInput {
  readonly squad: Squad;
  readonly floor: number;
  readonly wave: number;
  readonly mobPool: readonly ContentId[];
  readonly bossMonsterId: ContentId | null;
  readonly isBossWave: boolean;
  readonly seed: number;
}

export interface BuiltWave {
  readonly heroes: readonly PlayerCombatant[];
  readonly enemies: readonly EnemyCombatant[];
}

/**
 * Instancia uma wave completa: 4 heróis + N inimigos.
 *
 * Composição: 1–2 mobs normais por wave; chefes sempre sozinhos.
 * A escolha do mob é determinística a partir de `seed` (sem `Math.random`).
 */
export function buildWave(input: BuildWaveInput): BuiltWave {
  const heroes = input.squad.members.map((character) => buildPlayerCombatant({ character }));

  if (input.isBossWave && input.bossMonsterId) {
    const boss = buildEnemyCombatant({
      monsterId: input.bossMonsterId,
      floor: input.floor,
      wave: input.wave,
      tier: 'boss',
    });
    return { heroes, enemies: boss ? [boss] : [] };
  }

  const pool = input.mobPool.length > 0 ? input.mobPool : [];
  const count = 2;
  const enemies: EnemyCombatant[] = [];
  const enemyLines: readonly FormationPosition[] = ['front', 'mid', 'back'];

  for (let index = 0; index < count; index += 1) {
    // Escolha determinística: seed + andar + wave + índice.
    const pick = pool.length > 0 ? pool[(input.seed + input.floor * 7 + input.wave * 3 + index) % pool.length] : undefined;
    if (!pick) break;
    const enemy = buildEnemyCombatant({
      monsterId: pick,
      floor: input.floor,
      wave: input.wave,
      tier: index === 1 ? 'elite' : 'normal',
      position: enemyLines[index] ?? 'back',
      idSuffix: String(index),
    });
    if (enemy) enemies.push(enemy);
  }

  return { heroes, enemies };
}

/* ==========================================================================
 * EQUIPAMENTO (helper para a UI de inventário)
 * ========================================================================== */

/** Slots vazios — evita repetir o objecto literal em toda a UI. */
export function emptyEquipment(): Readonly<Record<EquipmentSlot, InventoryItem | null>> {
  return {
    helmet: null,
    armor: null,
    weapon: null,
    offhand: null,
    cloak: null,
    boots: null,
    accessory: null,
    aura: null,
    wings: null,
  };
}

/** Agrupa o equipamento por slot para o Paperdoll e para o cálculo. */
export function equipmentFor(character: Character, catalogue: ReadonlyMap<string, Item> = ITEM_BY_ID): readonly EquipmentEntry[] {
  return equipmentEntries(character.equipment, catalogue);
}

/** Raça do personagem (null se o id não existir no catálogo). */
export function raceOf(character: Character): Race | null {
  return RACE_BY_ID.get(character.raceId) ?? null;
}
