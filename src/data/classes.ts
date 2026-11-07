/**
 * Classes-base, especializações e árvores de talento.
 *
 * Da wiki:
 *  · Nv 1–9 Aprendiz com 2 espaços de skill activa.
 *  · Nv 10 escolha de classe-base (Guerreiro, Caçador, Clérigo, Mago).
 *  · Nv 20 terceiro espaço. Nv 40 especialização + quarto espaço + talentos
 *    em três árvores (Burst, Utility, Sustain).
 */
import type {
  BaseClass,
  ContentId,
  DerivedStatKey,
  FormationPosition,
  PrimaryAttribute,
  Specialization,
  StatModifier,
  SquadRole,
  TalentNode,
  TalentTree,
} from '@/types/game';

/* ==========================================================================
 * CLASSES-BASE
 * ========================================================================== */

export interface BaseClassDefinition {
  readonly id: BaseClass;
  readonly name: string;
  readonly role: SquadRole;
  readonly mainAttribute: PrimaryAttribute;
  readonly secondaryAttribute: PrimaryAttribute;
  readonly defaultPosition: FormationPosition;
  readonly description: string;
  readonly icon: string;
  readonly specializations: readonly Specialization[];
}

export const BASE_CLASSES: readonly BaseClassDefinition[] = [
  {
    id: 'warrior',
    name: 'Guerreiro',
    role: 'tank',
    mainAttribute: 'str',
    secondaryAttribute: 'vit',
    defaultPosition: 'front',
    description: 'Segura a linha da frente. Escala com Força e Vitalidade.',
    icon: '⚔️',
    specializations: ['paladin', 'berserker'],
  },
  {
    id: 'hunter',
    name: 'Caçador',
    role: 'dps',
    mainAttribute: 'dex',
    secondaryAttribute: 'agi',
    defaultPosition: 'mid',
    description: 'DPS físico à distância. Escala com Destreza e Agilidade.',
    icon: '🏹',
    specializations: ['sharpshooter', 'assassin'],
  },
  {
    id: 'cleric',
    name: 'Clérigo',
    role: 'healer',
    mainAttribute: 'int',
    secondaryAttribute: 'vit',
    defaultPosition: 'back',
    description: 'Mantém o squad vivo. Escala com Inteligência e Vitalidade.',
    icon: '✨',
    specializations: ['divine_priest', 'inquisitor'],
  },
  {
    id: 'mage',
    name: 'Mago',
    role: 'dps',
    mainAttribute: 'int',
    secondaryAttribute: 'dex',
    defaultPosition: 'back',
    description: 'DPS mágico em área. Escala com Inteligência.',
    icon: '🔮',
    specializations: ['archmage', 'warlock'],
  },
] as const;

/* ==========================================================================
 * ESPECIALIZAÇÕES
 * ========================================================================== */

export interface SpecializationDefinition {
  readonly id: Specialization;
  readonly name: string;
  readonly baseClass: BaseClass;
  readonly focus: string;
  readonly icon: string;
  /** Passiva concedida automaticamente ao escolher a spec. */
  readonly passive: readonly StatModifier[];
}

export const SPECIALIZATIONS: readonly SpecializationDefinition[] = [
  {
    id: 'paladin',
    name: 'Paladino',
    baseClass: 'warrior',
    focus: 'Suporte sagrado, escudos e provocação',
    icon: '🛡️',
    passive: [
      { stat: 'def', kind: 'percent', value: 15, source: { type: 'talent', talentId: 'spec.paladin' } },
      { stat: 'maxHp', kind: 'percent', value: 10, source: { type: 'talent', talentId: 'spec.paladin' } },
    ],
  },
  {
    id: 'berserker',
    name: 'Berserker',
    baseClass: 'warrior',
    focus: 'Roubo de vida e dano crescente com HP baixo',
    icon: '🪓',
    passive: [
      { stat: 'lifesteal', kind: 'flat', value: 8, source: { type: 'talent', talentId: 'spec.berserker' } },
      { stat: 'atk', kind: 'percent', value: 12, source: { type: 'talent', talentId: 'spec.berserker' } },
    ],
  },
  {
    id: 'sharpshooter',
    name: 'Atirador de Elite',
    baseClass: 'hunter',
    focus: 'Crítico à distância e marcação de alvo',
    icon: '🎯',
    passive: [
      { stat: 'crit', kind: 'flat', value: 10, source: { type: 'talent', talentId: 'spec.sharpshooter' } },
      { stat: 'hit', kind: 'flat', value: 15, source: { type: 'talent', talentId: 'spec.sharpshooter' } },
    ],
  },
  {
    id: 'assassin',
    name: 'Assassino',
    baseClass: 'hunter',
    focus: 'Corpo a corpo, esquiva e veneno',
    icon: '🗡️',
    passive: [
      { stat: 'flee', kind: 'flat', value: 20, source: { type: 'talent', talentId: 'spec.assassin' } },
      { stat: 'critDamage', kind: 'flat', value: 20, source: { type: 'talent', talentId: 'spec.assassin' } },
    ],
  },
  {
    id: 'divine_priest',
    name: 'Sacerdote Divino',
    baseClass: 'cleric',
    focus: 'Cura e protecção do squad',
    icon: '💫',
    passive: [
      { stat: 'healPower', kind: 'percent', value: 20, source: { type: 'talent', talentId: 'spec.divine_priest' } },
      { stat: 'maxMp', kind: 'percent', value: 15, source: { type: 'talent', talentId: 'spec.divine_priest' } },
    ],
  },
  {
    id: 'inquisitor',
    name: 'Inquisidor',
    baseClass: 'cleric',
    focus: 'Dano sagrado híbrido e silêncio',
    icon: '⚡',
    passive: [
      { stat: 'matk', kind: 'percent', value: 15, source: { type: 'talent', talentId: 'spec.inquisitor' } },
      { stat: 'healPower', kind: 'flat', value: 40, source: { type: 'talent', talentId: 'spec.inquisitor' } },
    ],
  },
  {
    id: 'archmage',
    name: 'Arquimago',
    baseClass: 'mage',
    focus: 'Explosão em área e haste',
    icon: '🌋',
    passive: [
      { stat: 'matk', kind: 'percent', value: 18, source: { type: 'talent', talentId: 'spec.archmage' } },
      { stat: 'castTime', kind: 'percent', value: -15, source: { type: 'talent', talentId: 'spec.archmage' } },
    ],
  },
  {
    id: 'warlock',
    name: 'Bruxo',
    baseClass: 'mage',
    focus: 'Dano contínuo, debuffs e invocações',
    icon: '👁️',
    passive: [
      { stat: 'matk', kind: 'percent', value: 10, source: { type: 'talent', talentId: 'spec.warlock' } },
      { stat: 'lifesteal', kind: 'flat', value: 6, source: { type: 'talent', talentId: 'spec.warlock' } },
    ],
  },
] as const;

export const SPEC_BY_ID: ReadonlyMap<Specialization, SpecializationDefinition> = new Map(
  SPECIALIZATIONS.map((spec) => [spec.id, spec]),
);

export function specializationsFor(baseClass: BaseClass): readonly SpecializationDefinition[] {
  return SPECIALIZATIONS.filter((spec) => spec.baseClass === baseClass);
}

/* ==========================================================================
 * TALENTOS — 3 árvores × 4 nós × 8 specs = 96 nós
 * ========================================================================== */

interface TalentSeed {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tree: TalentTree;
  readonly maxRank: number;
  readonly levelRequirement: number;
  readonly requires: readonly string[];
  readonly modifiers: readonly { readonly stat: DerivedStatKey; readonly kind: 'flat' | 'percent'; readonly value: number }[];
}

/**
 * Template por especialização. Cada spec recebe os mesmos 4 nós por árvore
 * com valores ajustados ao seu foco — mantém a UI idêntica entre specs e
 * reduz o custo de balanceamento a uma tabela.
 */
function buildTalents(spec: Specialization, seeds: readonly TalentSeed[]): readonly TalentNode[] {
  return seeds.map((seed) => ({
    id: `talent.${spec}.${seed.id}`,
    name: seed.name,
    description: seed.description,
    specialization: spec,
    tree: seed.tree,
    maxRank: seed.maxRank,
    levelRequirement: seed.levelRequirement,
    requires: seed.requires.map((requirement) => `talent.${spec}.${requirement}`),
    modifiersPerRank: seed.modifiers.map((modifier) => ({
      stat: modifier.stat,
      kind: modifier.kind,
      value: modifier.value,
      source: { type: 'talent' as const, talentId: `talent.${spec}.${seed.id}` },
    })),
  }));
}

/** Nós comuns (estrutura igual em todas as specs). */
const TALENT_SEEDS: readonly TalentSeed[] = [
  { id: 'burst1', name: 'Golpe Preciso', description: 'Ataque base mais alto.', tree: 'burst', maxRank: 5, levelRequirement: 40, requires: [], modifiers: [{ stat: 'atk', kind: 'percent', value: 3 }] },
  { id: 'burst2', name: 'Fúria Interior', description: 'Dano crítico aumentado.', tree: 'burst', maxRank: 5, levelRequirement: 45, requires: ['burst1'], modifiers: [{ stat: 'critDamage', kind: 'flat', value: 6 }] },
  { id: 'burst3', name: 'Instinto', description: 'Chance de crítico.', tree: 'burst', maxRank: 3, levelRequirement: 50, requires: ['burst2'], modifiers: [{ stat: 'crit', kind: 'flat', value: 3 }] },
  { id: 'burst4', name: 'Execução', description: 'Velocidade de ataque no topo da árvore.', tree: 'burst', maxRank: 3, levelRequirement: 60, requires: ['burst3'], modifiers: [{ stat: 'attackSpeed', kind: 'percent', value: 4 }] },

  { id: 'utility1', name: 'Passo Leve', description: 'Esquiva.', tree: 'utility', maxRank: 5, levelRequirement: 40, requires: [], modifiers: [{ stat: 'flee', kind: 'flat', value: 6 }] },
  { id: 'utility2', name: 'Concentração', description: 'Precisão.', tree: 'utility', maxRank: 5, levelRequirement: 45, requires: ['utility1'], modifiers: [{ stat: 'hit', kind: 'flat', value: 6 }] },
  { id: 'utility3', name: 'Ganância', description: 'Mais drops.', tree: 'utility', maxRank: 3, levelRequirement: 50, requires: ['utility2'], modifiers: [{ stat: 'dropBonus', kind: 'flat', value: 5 }] },
  { id: 'utility4', name: 'Veterano', description: 'Mais experiência.', tree: 'utility', maxRank: 3, levelRequirement: 60, requires: ['utility3'], modifiers: [{ stat: 'expBonus', kind: 'flat', value: 5 }] },

  { id: 'sustain1', name: 'Pele Grossa', description: 'Defesa física.', tree: 'sustain', maxRank: 5, levelRequirement: 40, requires: [], modifiers: [{ stat: 'def', kind: 'flat', value: 8 }] },
  { id: 'sustain2', name: 'Mente Firme', description: 'Defesa mágica.', tree: 'sustain', maxRank: 5, levelRequirement: 45, requires: ['sustain1'], modifiers: [{ stat: 'mdef', kind: 'flat', value: 8 }] },
  { id: 'sustain3', name: 'Vitalidade', description: 'HP máximo.', tree: 'sustain', maxRank: 3, levelRequirement: 50, requires: ['sustain2'], modifiers: [{ stat: 'maxHp', kind: 'percent', value: 6 }] },
  { id: 'sustain4', name: 'Sede', description: 'Roubo de vida.', tree: 'sustain', maxRank: 3, levelRequirement: 60, requires: ['sustain3'], modifiers: [{ stat: 'lifesteal', kind: 'flat', value: 3 }] },
] as const;

export const TALENTS: readonly TalentNode[] = SPECIALIZATIONS.flatMap((spec) =>
  buildTalents(spec.id, TALENT_SEEDS),
);

export const TALENT_BY_ID: ReadonlyMap<ContentId, TalentNode> = new Map(TALENTS.map((talent) => [talent.id, talent]));

export function talentsFor(spec: Specialization, tree?: TalentTree): readonly TalentNode[] {
  return TALENTS.filter((talent) => talent.specialization === spec && (!tree || talent.tree === tree));
}

/* ==========================================================================
 * MARCOS DE PROGRESSÃO
 * ========================================================================== */

export interface ProgressionMilestone {
  readonly level: number;
  readonly label: string;
  readonly unlocks: readonly ('class_choice' | 'skill_slot_3' | 'specialization' | 'skill_slot_4' | 'talents')[];
}

export const MILESTONES: readonly ProgressionMilestone[] = [
  { level: 10, label: 'Escolha de classe-base', unlocks: ['class_choice'] },
  { level: 20, label: 'Terceiro espaço de skill', unlocks: ['skill_slot_3'] },
  { level: 40, label: 'Especialização + 4.º espaço + talentos', unlocks: ['specialization', 'skill_slot_4', 'talents'] },
] as const;
