/**
 * Catálogo de skills do MVP — 32 skills (4 por especialização × 8 specs).
 *
 * Os valores por raridade vêm da tabela do Templo na wiki
 * (Comum → Mítica). O `rarity` de cada linha é o "tier" de drop, não a
 * raridade da instância possuída.
 *
 * Escala da wiki (tabela "Catálogo de skills"):
 *   Explosão do Piromante: 420 / 470 / 520 / 580 / 650 / 750
 *   → factor 1.0 / 1.12 / 1.24 / 1.38 / 1.55 / 1.79
 * Aplicamos esse factor à base de cada skill, arredondando a inteiro.
 */
import type {
  ContentId,
  Rarity,
  RarityValueTable,
  Skill,
  SkillEffect,
  SkillFunction,
  SkillKind,
  SkillScalingBase,
  Specialization,
} from '@/types/game';

const SCALE: Readonly<Record<Rarity, number>> = {
  common: 1,
  uncommon: 1.12,
  rare: 1.24,
  epic: 1.38,
  legendary: 1.55,
  mythic: 1.79,
} as const;

function values(base: number): RarityValueTable {
  return {
    common: Math.round(base * SCALE.common),
    uncommon: Math.round(base * SCALE.uncommon),
    rare: Math.round(base * SCALE.rare),
    epic: Math.round(base * SCALE.epic),
    legendary: Math.round(base * SCALE.legendary),
    mythic: Math.round(base * SCALE.mythic),
  };
}

interface EffectSeed {
  readonly fn: SkillFunction;
  readonly scaling: SkillScalingBase;
  readonly coefficient: number;
  readonly durationSec?: number;
  readonly tickIntervalSec?: number;
  readonly targetCount?: number | 'all';
  readonly targetsAlly?: boolean;
}

function effect(seed: EffectSeed): SkillEffect {
  return {
    function: seed.fn,
    scaling: seed.scaling,
    coefficient: seed.coefficient,
    durationSec: seed.durationSec ?? null,
    tickIntervalSec: seed.tickIntervalSec ?? null,
    targetCount: seed.targetCount ?? 1,
    targetsAlly: seed.targetsAlly ?? false,
    element: 'neutral',
    modifiers: [],
    maxHpDamageCapPct: null,
  };
}

interface SkillSeed {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly spec: Specialization;
  readonly kind: SkillKind;
  readonly fn: SkillFunction;
  readonly scaling: SkillScalingBase;
  readonly base: number;
  readonly rarity: Rarity;
  readonly mythicBonus: string;
  readonly cooldownSec: number;
  readonly mpCost: number;
  readonly castTimeSec: number;
  readonly effects: readonly EffectSeed[];
}

function build(seed: SkillSeed): Skill {
  return {
    id: `skill.${seed.spec}.${seed.id}`,
    name: seed.name,
    description: seed.description,
    specialization: seed.spec,
    kind: seed.kind,
    function: seed.fn,
    scaling: seed.scaling,
    rarityValues: values(seed.base),
    mythicBonus: seed.mythicBonus,
    effects: seed.effects.map(effect),
    cooldownSec: seed.cooldownSec,
    mpCost: seed.mpCost,
    castTimeSec: seed.castTimeSec,
    maxLevel: 50,
    perLevelGain: 0.02,
    icon: seed.id,
    rarity: seed.rarity,
  };
}

const SEEDS: readonly SkillSeed[] = [
  /* ---------------------------------------------------------- PALADINO */
  { id: 'holy_hammer', name: 'Martelo da Justiça', description: 'ATK com atordoamento de 2s.', spec: 'paladin', kind: 'active', fn: 'control', scaling: 'atk', base: 250, rarity: 'rare', mythicBonus: 'Stun +0,5s', cooldownSec: 14, mpCost: 30, castTimeSec: 0, effects: [{ fn: 'control', scaling: 'atk', coefficient: 1, durationSec: 2 }] },
  { id: 'divine_shield', name: 'Escudo Divino', description: 'Imunidade a dano por alguns segundos.', spec: 'paladin', kind: 'active', fn: 'shield', scaling: 'max_hp', base: 200, rarity: 'epic', mythicBonus: 'Mantém a provocação activa', cooldownSec: 45, mpCost: 60, castTimeSec: 0, effects: [{ fn: 'shield', scaling: 'max_hp', coefficient: 0.3, durationSec: 4, targetsAlly: true }] },
  { id: 'devotion_aura', name: 'Aura de Devoção', description: 'DEF do squad aumentada.', spec: 'paladin', kind: 'active', fn: 'buff', scaling: 'def', base: 15, rarity: 'uncommon', mythicBonus: 'Também aumenta MDEF', cooldownSec: 30, mpCost: 40, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'def', coefficient: 0.15, durationSec: 12, targetsAlly: true, targetCount: 'all' }] },
  { id: 'muralha_fe', name: 'Muralha de Fé', description: 'Passiva: DEF física permanente.', spec: 'paladin', kind: 'passive', fn: 'buff', scaling: 'def', base: 10, rarity: 'common', mythicBonus: '+5% MaxHP', cooldownSec: 0, mpCost: 0, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'def', coefficient: 0.1, targetsAlly: true }] },

  /* --------------------------------------------------------- BERSERKER */
  { id: 'blood_fury', name: 'Fúria Sangrenta', description: 'Roubo de vida que cresce com HP baixo.', spec: 'berserker', kind: 'active', fn: 'buff', scaling: 'atk', base: 15, rarity: 'rare', mythicBonus: 'Dura +3s', cooldownSec: 25, mpCost: 30, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'atk', coefficient: 0.15, durationSec: 8, targetsAlly: true }] },
  { id: 'whirlwind', name: 'Redemoinho', description: 'ATK em área, cura por alvo atingido.', spec: 'berserker', kind: 'active', fn: 'aoe_damage', scaling: 'atk', base: 250, rarity: 'epic', mythicBonus: 'Cura dobrada em 3+ alvos', cooldownSec: 10, mpCost: 30, castTimeSec: 0, effects: [{ fn: 'aoe_damage', scaling: 'atk', coefficient: 1, targetCount: 'all' }] },
  { id: 'challenging_roar', name: 'Rugido Desafiador', description: 'Provoca e reduz ATK dos inimigos.', spec: 'berserker', kind: 'active', fn: 'debuff', scaling: 'atk', base: 10, rarity: 'uncommon', mythicBonus: 'Duração +2s', cooldownSec: 12, mpCost: 15, castTimeSec: 0, effects: [{ fn: 'debuff', scaling: 'atk', coefficient: 0.1, durationSec: 6, targetCount: 'all' }] },
  { id: 'bloodthirst', name: 'Sede de Sangue', description: 'Passiva: roubo de vida permanente.', spec: 'berserker', kind: 'passive', fn: 'buff', scaling: 'atk', base: 8, rarity: 'rare', mythicBonus: '—', cooldownSec: 0, mpCost: 0, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'atk', coefficient: 0.08, targetsAlly: true }] },

  /* ---------------------------------------------------- ATIRADOR DE ELITE */
  { id: 'deadly_shot', name: 'Tiro Mortal', description: 'ATK à distância com crítico garantido.', spec: 'sharpshooter', kind: 'active', fn: 'damage', scaling: 'atk', base: 420, rarity: 'epic', mythicBonus: '-1s de cooldown', cooldownSec: 8, mpCost: 30, castTimeSec: 0, effects: [{ fn: 'damage', scaling: 'atk', coefficient: 1.4 }] },
  { id: 'mark_target', name: 'Marcar Alvo', description: 'Dano extra do squad no alvo marcado.', spec: 'sharpshooter', kind: 'active', fn: 'debuff', scaling: 'atk', base: 10, rarity: 'rare', mythicBonus: 'Marca passa ao próximo alvo', cooldownSec: 16, mpCost: 20, castTimeSec: 0, effects: [{ fn: 'debuff', scaling: 'atk', coefficient: 0.1, durationSec: 10 }] },
  { id: 'triple_shot', name: 'Rajada Tripla', description: 'Três flechas de ATK.', spec: 'sharpshooter', kind: 'active', fn: 'damage', scaling: 'atk', base: 150, rarity: 'uncommon', mythicBonus: '+1 flecha', cooldownSec: 5, mpCost: 15, castTimeSec: 0, effects: [{ fn: 'damage', scaling: 'atk', coefficient: 0.5, targetCount: 3 }] },
  { id: 'steady_aim', name: 'Mira Firme', description: 'Passiva: crítico por segundo parado (até 5x).', spec: 'sharpshooter', kind: 'passive', fn: 'buff', scaling: 'atk', base: 3, rarity: 'common', mythicBonus: 'Limite +2 acúmulos', cooldownSec: 0, mpCost: 0, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'atk', coefficient: 0.03, targetsAlly: true }] },

  /* ---------------------------------------------------------- ASSASSINO */
  { id: 'stealth_strike', name: 'Golpe Furtivo', description: 'ATK triplo no primeiro ataque.', spec: 'assassin', kind: 'active', fn: 'damage', scaling: 'atk', base: 420, rarity: 'epic', mythicBonus: '-1s de cooldown', cooldownSec: 8, mpCost: 30, castTimeSec: 0, effects: [{ fn: 'damage', scaling: 'atk', coefficient: 1.4 }] },
  { id: 'poison_blade', name: 'Lâmina Envenenada', description: 'Veneno por segundo durante 6s.', spec: 'assassin', kind: 'active', fn: 'dot', scaling: 'atk', base: 60, rarity: 'rare', mythicBonus: 'Veneno acumula 2x', cooldownSec: 10, mpCost: 20, castTimeSec: 0, effects: [{ fn: 'dot', scaling: 'atk', coefficient: 0.2, durationSec: 6, tickIntervalSec: 1 }] },
  { id: 'shadow_step', name: 'Passo das Sombras', description: 'Esquiva aumentada por alguns segundos.', spec: 'assassin', kind: 'active', fn: 'utility', scaling: 'def', base: 30, rarity: 'uncommon', mythicBonus: 'Teleporta às costas do alvo', cooldownSec: 15, mpCost: 20, castTimeSec: 0, effects: [{ fn: 'utility', scaling: 'def', coefficient: 0.3, durationSec: 4, targetsAlly: true }] },
  { id: 'lethal_poisons', name: 'Venenos Letais', description: 'Passiva: dano de veneno.', spec: 'assassin', kind: 'passive', fn: 'buff', scaling: 'atk', base: 15, rarity: 'common', mythicBonus: '—', cooldownSec: 0, mpCost: 0, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'atk', coefficient: 0.15, targetsAlly: true }] },

  /* --------------------------------------------------- SACERDOTE DIVINO */
  { id: 'greater_heal', name: 'Cura Maior', description: 'MATK em cura no aliado.', spec: 'divine_priest', kind: 'active', fn: 'heal', scaling: 'matk', base: 420, rarity: 'epic', mythicBonus: '-1s de cooldown', cooldownSec: 6, mpCost: 35, castTimeSec: 1.2, effects: [{ fn: 'heal', scaling: 'matk', coefficient: 1.4, targetsAlly: true }] },
  { id: 'group_heal', name: 'Cura em Grupo', description: 'MATK em cura no squad inteiro.', spec: 'divine_priest', kind: 'active', fn: 'heal', scaling: 'matk', base: 250, rarity: 'legendary', mythicBonus: 'Cura +1 vez após 3s', cooldownSec: 12, mpCost: 60, castTimeSec: 1.5, effects: [{ fn: 'heal', scaling: 'matk', coefficient: 0.8, targetsAlly: true, targetCount: 'all' }] },
  { id: 'renew', name: 'Renovar', description: 'Cura por segundo durante 8s.', spec: 'divine_priest', kind: 'active', fn: 'hot', scaling: 'matk', base: 60, rarity: 'rare', mythicBonus: 'Afeta +1 aliado', cooldownSec: 8, mpCost: 25, castTimeSec: 0, effects: [{ fn: 'hot', scaling: 'matk', coefficient: 0.2, durationSec: 8, tickIntervalSec: 1, targetsAlly: true }] },
  { id: 'divine_grace', name: 'Graça Divina', description: 'Passiva: cura realizada aumentada.', spec: 'divine_priest', kind: 'passive', fn: 'buff', scaling: 'matk', base: 10, rarity: 'common', mythicBonus: 'Cura crítica +5%', cooldownSec: 0, mpCost: 0, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'matk', coefficient: 0.1, targetsAlly: true }] },

  /* -------------------------------------------------------- INQUISIDOR */
  { id: 'holy_flame', name: 'Chama Sagrada', description: 'MATK com 50% do dano convertido em cura.', spec: 'inquisitor', kind: 'active', fn: 'damage', scaling: 'matk', base: 300, rarity: 'epic', mythicBonus: 'Cura 70% do dano', cooldownSec: 8, mpCost: 30, castTimeSec: 0.5, effects: [{ fn: 'damage', scaling: 'matk', coefficient: 1 }] },
  { id: 'judgement', name: 'Julgamento', description: 'MATK com dano extra em chefes.', spec: 'inquisitor', kind: 'active', fn: 'damage', scaling: 'matk', base: 420, rarity: 'legendary', mythicBonus: '-1s de cooldown', cooldownSec: 10, mpCost: 35, castTimeSec: 0, effects: [{ fn: 'damage', scaling: 'matk', coefficient: 1.4 }] },
  { id: 'silence', name: 'Silenciar', description: 'Interrompe o cast e silencia por 2s.', spec: 'inquisitor', kind: 'active', fn: 'control', scaling: 'matk', base: 150, rarity: 'rare', mythicBonus: 'Silêncio +1s', cooldownSec: 18, mpCost: 25, castTimeSec: 0, effects: [{ fn: 'control', scaling: 'matk', coefficient: 0.5, durationSec: 2 }] },
  { id: 'dogma', name: 'Dogma', description: 'Passiva: dano sagrado aumentado.', spec: 'inquisitor', kind: 'passive', fn: 'buff', scaling: 'matk', base: 10, rarity: 'common', mythicBonus: '—', cooldownSec: 0, mpCost: 0, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'matk', coefficient: 0.1, targetsAlly: true }] },

  /* ---------------------------------------------------------- ARQUIMAGO */
  { id: 'arcane_blast', name: 'Explosão Arcana', description: 'MATK em área.', spec: 'archmage', kind: 'active', fn: 'aoe_damage', scaling: 'matk', base: 300, rarity: 'epic', mythicBonus: 'Atinge +1 alvo', cooldownSec: 10, mpCost: 35, castTimeSec: 1, effects: [{ fn: 'aoe_damage', scaling: 'matk', coefficient: 1, targetCount: 'all' }] },
  { id: 'meteor', name: 'Meteoro', description: 'MATK em área com cast longo.', spec: 'archmage', kind: 'active', fn: 'aoe_damage', scaling: 'matk', base: 800, rarity: 'mythic', mythicBonus: 'Cast 30% mais rápido', cooldownSec: 25, mpCost: 80, castTimeSec: 3, effects: [{ fn: 'aoe_damage', scaling: 'matk', coefficient: 2.6, targetCount: 'all' }] },
  { id: 'mana_barrier', name: 'Barreira de Mana', description: 'Escudo no squad baseado em MATK.', spec: 'archmage', kind: 'active', fn: 'shield', scaling: 'matk', base: 200, rarity: 'rare', mythicBonus: 'Escudo dura +2s', cooldownSec: 20, mpCost: 45, castTimeSec: 0, effects: [{ fn: 'shield', scaling: 'matk', coefficient: 0.6, durationSec: 8, targetsAlly: true, targetCount: 'all' }] },
  { id: 'arcane_overload', name: 'Sobrecarga Arcana', description: 'Passiva: MATK aumentado.', spec: 'archmage', kind: 'passive', fn: 'buff', scaling: 'matk', base: 10, rarity: 'common', mythicBonus: '+5% de crítico mágico', cooldownSec: 0, mpCost: 0, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'matk', coefficient: 0.1, targetsAlly: true }] },

  /* ------------------------------------------------------------- BRUXO */
  { id: 'dark_arrow', name: 'Seta Sombria', description: 'MATK directo.', spec: 'warlock', kind: 'active', fn: 'damage', scaling: 'matk', base: 420, rarity: 'epic', mythicBonus: '-1s de cooldown', cooldownSec: 8, mpCost: 30, castTimeSec: 0.5, effects: [{ fn: 'damage', scaling: 'matk', coefficient: 1.4 }] },
  { id: 'corruption', name: 'Corrupção', description: 'MATK por segundo durante 8s.', spec: 'warlock', kind: 'active', fn: 'dot', scaling: 'matk', base: 60, rarity: 'rare', mythicBonus: 'Espalha quando o alvo morre', cooldownSec: 12, mpCost: 25, castTimeSec: 0, effects: [{ fn: 'dot', scaling: 'matk', coefficient: 0.2, durationSec: 8, tickIntervalSec: 1 }] },
  { id: 'drain_life', name: 'Drenar Vida', description: 'MATK e cura 30% do dano causado.', spec: 'warlock', kind: 'active', fn: 'damage', scaling: 'matk', base: 250, rarity: 'legendary', mythicBonus: 'Cura 45% do dano', cooldownSec: 10, mpCost: 30, castTimeSec: 1, effects: [{ fn: 'damage', scaling: 'matk', coefficient: 0.8 }] },
  { id: 'master_curses', name: 'Mestre das Maldições', description: 'Passiva: duração dos DoTs aumentada.', spec: 'warlock', kind: 'passive', fn: 'buff', scaling: 'matk', base: 20, rarity: 'common', mythicBonus: '—', cooldownSec: 0, mpCost: 0, castTimeSec: 0, effects: [{ fn: 'buff', scaling: 'matk', coefficient: 0.2, targetsAlly: true }] },
] as const;

export const SKILLS: readonly Skill[] = SEEDS.map(build);

export const SKILL_BY_ID: ReadonlyMap<ContentId, Skill> = new Map(SKILLS.map((skill) => [skill.id, skill]));

export function skillsFor(spec: Specialization): readonly Skill[] {
  return SKILLS.filter((skill) => skill.specialization === spec);
}

/** Skills do Aprendiz (níveis 1–9), substituídas na escolha de classe. */
export const APPRENTICE_SKILLS: readonly ContentId[] = [
  'skill.apprentice.basic_attack',
  'skill.apprentice.first_aid',
  'skill.apprentice.double_strike',
] as const;
