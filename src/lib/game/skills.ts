/**
 * Executor de efeitos de skill.
 *
 * O motor de combate (`combat.ts`) só sabe de auto-ataques. Este módulo
 * adiciona a camada de habilidades: DoT, HoT, escudo, buff/debuff, controlo,
 * invocação, utilidade e ressurreição.
 *
 * Contrato:
 *   `resolveSkillCast()` calcula o que acontece num cast (puro, devolve
 *   `EffectApplication[]`);
 *   `tickEffects()` avança os efeitos activos um passo de tempo.
 *
 * Nada aqui toca em React, DOM ou `Math.random()` — o `Rng` vem sempre de fora.
 */
import type {
  ActiveEffect,
  Combatant,
  CombatState,
  ContentId,
  ControlState,
  DerivedStats,
  EpochMs,
  Skill,
  SkillEffect,
  SkillFunction,
  StatModifier,
  Uuid,
} from '@/types/game';
import { BALANCE } from './balance';
import { applyDamageTo, applyHealTo, isAlive } from './combat';
import { prioritizeTargetLines } from './target';
import type { Rng } from './rng';

const C = BALANCE.combat;

/* ==========================================================================
 * VALORES BASE
 * ========================================================================== */

/** Valor de escala de uma skill no nível de personagem actual. */
export function skillPower(skill: Skill, casterStats: DerivedStats, level: number): number {
  const base = skill.rarityValues[skill.rarity];
  const levelFactor = 1 + Math.max(0, level - 1) * skill.perLevelGain;
  const scalingValue = scalingToStat(skill.scaling, casterStats);
  return base * levelFactor * scalingValue;
}

/** Converte a base de escala no stat correspondente do conjurador. */
export function scalingToStat(scaling: Skill['scaling'], stats: DerivedStats): number {
  switch (scaling) {
    case 'atk':
      return stats.atk;
    case 'matk':
      return stats.matk;
    case 'def':
      return stats.def;
    case 'mdef':
      return stats.mdef;
    case 'max_hp':
      return stats.maxHp;
    case 'target_max_hp':
      return 1; // resolvido no alvo, não no conjurador
    case 'caster_matk_pct':
      return stats.matk;
    default:
      return stats.atk;
  }
}

/* ==========================================================================
 * SELEÇÃO DE ALVOS
 * ========================================================================== */

/**
 * Alvos de um efeito. Aliados ordenam-se por HP relativo mais baixo (curar
 * quem está pior); inimigos por posição front → back.
 */
export function selectTargets(
  effect: SkillEffect,
  caster: Combatant,
  combatants: readonly Combatant[],
): readonly Combatant[] {
  const allyTeam = caster.team;
  const enemyTeam: Combatant['team'] = allyTeam === 'squad' ? 'enemy' : 'squad';
  const pool = combatants.filter((actor) => actor.team === (effect.targetsAlly ? allyTeam : enemyTeam) && isAlive(actor));

  if (pool.length === 0) return [];
  if (effect.targetCount === 'all') return pool;

  const limit = Math.max(1, effect.targetCount);

  if (effect.targetsAlly) {
    const sorted = [...pool].sort((a, b) => a.hp - b.hp);
    return sorted.slice(0, limit);
  }

  const sorted = prioritizeTargetLines(pool);
  return sorted.slice(0, limit);
}

/* ==========================================================================
 * APLICAÇÃO DE UM CAST
 * ========================================================================== */

export interface EffectApplication {
  readonly effect: ActiveEffect;
  /** Dano/cura imediata (para efeitos instantâneos). */
  readonly immediate: { readonly kind: 'damage' | 'heal' | 'shield'; readonly amount: number } | null;
  /** Controlo aplicado ao alvo (stun/silence/root). */
  readonly control: { readonly kind: 'stun' | 'silence' | 'root'; readonly durationSec: number } | null;
  /** Invocação criada (nome do template) — o motor instancia. */
  readonly summon: { readonly templateId: ContentId; readonly count: number } | null;
}

export interface CastContext {
  readonly caster: Combatant;
  readonly skill: Skill;
  readonly combatants: readonly Combatant[];
  readonly now: EpochMs;
  readonly rng: Rng;
  /** Bónus de duração de buffs (Troll: `buffDuration`). */
  readonly buffDurationPct?: number;
}

/**
 * Resolve um cast completo: calcula alvos, potência, duração e devolve as
 * aplicações. Não muta nada — o chamador aplica ao estado.
 */
export function resolveSkillCast(context: CastContext): readonly EffectApplication[] {
  const { caster, skill, combatants, now, rng } = context;
  const buffDurationPct = context.buffDurationPct ?? 0;
  const applications: EffectApplication[] = [];

  for (const effect of skill.effects) {
    const targets = selectTargets(effect, caster, combatants);
    if (targets.length === 0) continue;

    const rawPower = skillPower(skill, caster.stats, caster.level);
    const value = rawPower * effect.coefficient;

    for (const target of targets) {
      const isFriendly = effect.targetsAlly;
      const durationSec = applyBuffDuration(effect.durationSec, isFriendly, buffDurationPct);
      const expiresAtMs = now + Math.round(durationSec * 1000);

      const effectId = `${skill.id}:${caster.id}:${target.id}:${now}:${rng.int(0, 1_000_000)}`;

      const active: ActiveEffect = {
        id: effectId,
        skillId: skill.id,
        sourceActorId: caster.id,
        targetActorId: target.id,
        kind: effect.function,
        element: effect.element,
        tickValue: computeTickValue(effect, value, target),
        tickIntervalSec: effect.tickIntervalSec ?? 0,
        expiresAtMs,
        stacks: 1,
        modifiers: effect.modifiers,
        nextTickSec: effect.tickIntervalSec ?? 0,
        undispellable: false,
      };

      applications.push({
        effect: active,
        immediate: immediateFor(effect, value, target),
        control: controlFor(effect, durationSec),
        summon: summonFor(effect, value),
      });
    }
  }

  return applications;
}

function applyBuffDuration(durationSec: number | null, isFriendly: boolean, buffDurationPct: number): number {
  if (durationSec === null || durationSec <= 0) return 0;
  // `buffDuration` só alonga efeitos benéficos (Troll).
  if (!isFriendly || buffDurationPct <= 0) return durationSec;
  return durationSec * (1 + buffDurationPct / 100);
}

function computeTickValue(effect: SkillEffect, value: number, target: Combatant): number {
  if (effect.function === 'dot' || effect.function === 'hot') {
    const duration = effect.durationSec ?? 1;
    const interval = effect.tickIntervalSec ?? 1;
    const ticks = Math.max(1, Math.floor(duration / interval));
    return value / ticks;
  }
  if (effect.scaling === 'target_max_hp') {
    return value * target.maxHp;
  }
  return value;
}

function immediateFor(
  effect: SkillEffect,
  value: number,
  target: Combatant,
): EffectApplication['immediate'] {
  switch (effect.function) {
    case 'damage':
    case 'aoe_damage': {
      // Teto explicito do efeito (skills com `maxHpDamageCapPct`) ou o teto
      // global de AoE da wiki (40% do MaxHP). Sem isto, uma skill de area
      // contra um chefe mata-o num cast — o teste "uma wave completa" apanhava
      // exactamente isso.
      const capPct = effect.maxHpDamageCapPct ?? BALANCE.combat.aoeDamageCapPct;
      const cap = target.maxHp * capPct;
      const capped = Math.min(value, cap);
      return { kind: 'damage', amount: Math.max(1, Math.round(capped)) };
    }
    case 'heal':
      return { kind: 'heal', amount: Math.round(value) };
    case 'shield':
      return { kind: 'shield', amount: Math.round(value) };
    case 'revive':
      return { kind: 'heal', amount: Math.round(target.maxHp * (value / 100)) };
    default:
      return null;
  }
}

function controlFor(effect: SkillEffect, durationSec: number): EffectApplication['control'] {
  if (effect.function !== 'control' || durationSec <= 0) return null;
  return { kind: 'stun', durationSec };
}

function summonFor(effect: SkillEffect, value: number): EffectApplication['summon'] {
  if (effect.function !== 'summon') return null;
  return { templateId: `summon.${Math.round(value)}`, count: Math.max(1, effect.targetCount === 'all' ? 2 : 1) };
}

/* ==========================================================================
 * TICK DE EFEITOS
 * ========================================================================== */

export interface TickResult {
  readonly combatants: readonly Combatant[];
  readonly control: Readonly<Record<Uuid, ControlState>>;
  readonly damage: readonly { readonly sourceId: Uuid; readonly targetId: Uuid; readonly amount: number; readonly skillId: ContentId }[];
  readonly healing: readonly { readonly sourceId: Uuid; readonly targetId: Uuid; readonly amount: number; readonly skillId: ContentId }[];
  readonly expired: readonly ContentId[];
}

const EMPTY_CONTROL: ControlState = { stunUntilMs: 0, silenceUntilMs: 0, rootUntilMs: 0 };

/**
 * Avança todos os efeitos activos `dt` segundos.
 *
 * DoT/HoT: acumula `nextTickSec` e dispara quando atinge o intervalo — sem
 * aproximações, cada tick vale exactamente `tickValue`.
 * Buffs/debuff: expiram por tempo.
 * Regeneração racial: `regenPct` do MaxHP por segundo.
 */
export function tickEffects(
  combatants: readonly Combatant[],
  control: Readonly<Record<Uuid, ControlState>>,
  now: EpochMs,
  dt: number,
): TickResult {
  const damage: TickResult['damage'][number][] = [];
  const healing: TickResult['healing'][number][] = [];
  const expired: ContentId[] = [];
  const nextControl: Record<Uuid, ControlState> = {};

  const updated = combatants.map((actor) => {
    const state = control[actor.id] ?? EMPTY_CONTROL;
    nextControl[actor.id] = {
      stunUntilMs: Math.max(0, state.stunUntilMs),
      silenceUntilMs: Math.max(0, state.silenceUntilMs),
      rootUntilMs: Math.max(0, state.rootUntilMs),
    };

    if (!isAlive(actor)) return actor;

    let next = actor;

    // 1. Efeitos activos
    const surviving: ActiveEffect[] = [];
    for (const effect of actor.effects) {
      if (effect.expiresAtMs <= now) {
        expired.push(effect.id as ContentId);
        continue;
      }

      let effectNext = effect;
      if (effect.tickIntervalSec > 0 && (effect.kind === 'dot' || effect.kind === 'hot')) {
        let accumulator = effect.nextTickSec;
        while (accumulator <= dt) {
          if (effect.kind === 'dot') {
            next = applyDamageTo(next, effect.tickValue * effect.stacks);
            damage.push({ sourceId: effect.sourceActorId, targetId: actor.id, amount: Math.round(effect.tickValue), skillId: effect.skillId });
          } else {
            next = applyHealTo(next, effect.tickValue * effect.stacks);
            healing.push({ sourceId: effect.sourceActorId, targetId: actor.id, amount: Math.round(effect.tickValue), skillId: effect.skillId });
          }
          accumulator += effect.tickIntervalSec;
        }
        effectNext = { ...effect, nextTickSec: accumulator - dt };
      }

      surviving.push(effectNext);
    }

    // 2. Regeneração racial
    const regenPct = next.stats.regenPct ?? 0;
    if (regenPct > 0 && next.hp < next.maxHp) {
      next = applyHealTo(next, (next.maxHp * regenPct) / 100 * dt);
    }

    return { ...next, effects: surviving };
  });

  return { combatants: updated, control: nextControl, damage, healing, expired };
}

/* ==========================================================================
 * ESTADO DE CONTROLO
 * ========================================================================== */

/** `true` se o combatente pode agir (não está atordoado). */
export function canAct(state: CombatState, actorId: Uuid, now: EpochMs): boolean {
  const control = state.control[actorId];
  if (!control) return true;
  return control.stunUntilMs <= now;
}

/** `true` se pode conjurar (silêncio bloqueia skills, não auto-ataques). */
export function canCast(state: CombatState, actorId: Uuid, now: EpochMs): boolean {
  const control = state.control[actorId];
  if (!control) return true;
  return control.stunUntilMs <= now && control.silenceUntilMs <= now;
}

/** Aplica stun/silence/root com resistência (`controlResist`). */
export function applyControl(
  current: Readonly<Record<Uuid, ControlState>>,
  actorId: Uuid,
  kind: 'stun' | 'silence' | 'root',
  durationSec: number,
  now: EpochMs,
  controlResistPct: number,
): Readonly<Record<Uuid, ControlState>> {
  const resisted = durationSec * (controlResistPct / 100);
  const effective = Math.max(0, durationSec - resisted);
  if (effective <= 0) return current;

  const existing = current[actorId] ?? EMPTY_CONTROL;
  const until = now + Math.round(effective * 1000);

  return {
    ...current,
    [actorId]: {
      stunUntilMs: kind === 'stun' ? Math.max(existing.stunUntilMs, until) : existing.stunUntilMs,
      silenceUntilMs: kind === 'silence' ? Math.max(existing.silenceUntilMs, until) : existing.silenceUntilMs,
      rootUntilMs: kind === 'root' ? Math.max(existing.rootUntilMs, until) : existing.rootUntilMs,
    },
  };
}

/* ==========================================================================
 * APLICAÇÃO AO ESTADO
 * ========================================================================== */

/** Aplica as aplicações de um cast ao array de combatentes. */
export function applyCast(
  combatants: readonly Combatant[],
  applications: readonly EffectApplication[],
  control: Readonly<Record<Uuid, ControlState>>,
  now: EpochMs,
): { readonly combatants: readonly Combatant[]; readonly control: Readonly<Record<Uuid, ControlState>> } {
  let next = [...combatants];
  let nextControl = control;

  for (const application of applications) {
    const { effect, immediate, control: controlEffect } = application;

    next = next.map((actor) => {
      if (actor.id !== effect.targetActorId) return actor;

      let updated = actor;

      if (immediate) {
        if (immediate.kind === 'damage') {
          updated = applyDamageTo(updated, immediate.amount);
        } else if (immediate.kind === 'heal') {
          updated = applyHealTo(updated, immediate.amount);
        } else {
          updated = { ...updated, shield: updated.shield + immediate.amount };
        }
      }

      // Efeitos de tick e buffs entram na lista de activos.
      if (effect.tickIntervalSec > 0 || effect.modifiers.length > 0 || effect.kind === 'buff' || effect.kind === 'debuff') {
        updated = { ...updated, effects: [...updated.effects, effect].slice(-C.maxActiveEffects) };
      }

      return updated;
    });

    if (controlEffect) {
      nextControl = applyControl(nextControl, effect.targetActorId, controlEffect.kind, controlEffect.durationSec, now, 0);
    }
  }

  return { combatants: next, control: nextControl };
}

/* ==========================================================================
 * SUMARIZAÇÃO PARA A UI
 * ========================================================================== */

/** Agrupa modificadores activos por stat — para a ficha de personagem. */
export function activeModifierTotals(actor: Combatant): Readonly<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const effect of actor.effects) {
    for (const modifier of effect.modifiers) {
      const key = `${modifier.stat}:${modifier.kind}`;
      totals[key] = (totals[key] ?? 0) + modifier.value;
    }
  }
  return totals;
}

/** Ícone/cor por função de skill — mantém a UI consistente. */
export const SKILL_FUNCTION_COLOR: Readonly<Record<SkillFunction, string>> = {
  damage: '#f87171',
  aoe_damage: '#fb923c',
  dot: '#84cc16',
  heal: '#4ade80',
  hot: '#34d399',
  shield: '#60a5fa',
  buff: '#fbbf24',
  debuff: '#a78bfa',
  control: '#c084fc',
  summon: '#22d3ee',
  utility: '#94a3b8',
  revive: '#fde047',
} as const;

/** Modificadores de um efeito para o tooltip. */
export function describeModifiers(modifiers: readonly StatModifier[]): readonly string[] {
  return modifiers.map((modifier) =>
    modifier.kind === 'percent'
      ? `${modifier.value > 0 ? '+' : ''}${modifier.value}% ${modifier.stat}`
      : `${modifier.value > 0 ? '+' : ''}${modifier.value} ${modifier.stat}`,
  );
}
