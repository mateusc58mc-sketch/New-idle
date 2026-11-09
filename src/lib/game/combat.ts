/**
 * Loop de combate — funções puras, sem React.
 *
 * `advanceCombat(state, deltaSec)` é o coração do jogo: dado um estado e um
 * intervalo, devolve o próximo estado. Nenhum `setTimeout`, nenhum
 * `Math.random()`, nenhum acesso ao DOM. Isto torna-o:
 *   · testável (vitest)
 *   · determinístico (mesmo seed = mesma luta)
 *   · reexecutável no servidor para validar progresso
 *
 * `useCombat` (hook) apenas chama esta função dentro do `useGameLoop`.
 */
import type {
  ActiveEffect,
  ActorMetrics,
  CombatMetrics,
  CombatPhase,
  CombatState,
  Combatant,
  ContentId,
  DerivedStats,
  ControlState,
  EnemyCombatant,
  EquippedSkill,
  EpochMs,
  PlayerCombatant,
  Uuid,
} from '@/types/game';
import { BALANCE } from './balance';
import { attackIntervalSec, computeDamage, computeHitChance, safeNumber } from './formulas';
import { resolveSkillCast, applyCast, tickEffects, canAct, canCast } from './skills';
import { SKILL_BY_ID } from '@/data/skills';
import { frontmostLine } from './target';
import type { Rng } from './rng';

const C = BALANCE.combat;

/* ==========================================================================
 * CRIAÇÃO DE ESTADO
 * ========================================================================== */

export function createCombatState(input: {
  readonly squad: readonly PlayerCombatant[];
  readonly enemies?: readonly EnemyCombatant[];
  readonly floor: number;
  readonly wave: number;
  readonly wavesPerFloor: number;
  readonly isBossFloor: boolean;
  readonly seed: number;
}): CombatState {
  const combatants: Combatant[] = [...input.squad, ...(input.enemies ?? [])];
  const skillMap: Record<Uuid, readonly EquippedSkill[]> = {};
  for (const actor of combatants) {
    if (actor.team === 'squad' || actor.skills.length > 0) {
      skillMap[actor.id] = actor.skills;
    }
  }
  return {
    phase: 'wave_intro',
    floor: input.floor,
    wave: input.wave,
    wavesPerFloor: input.wavesPerFloor,
    isBossFloor: input.isBossFloor,
    combatants,
    events: [],
    elapsedSec: 0,
    waveElapsedSec: 0,
    metrics: emptyMetrics(),
    seed: input.seed,
    rngCursor: 0,
    running: true,
    control: {},
    skills: skillMap,
    waveActive: combatants.some((actor) => actor.team === 'enemy'),
    absorbed: 0,
    tickIntervalSec: C.tickIntervalSec,
  };
}

/**
 * Injeta a próxima wave no estado existente (mantém métricas e tempo).
 * É a ponte entre `tower.ts` (que decide o andar/wave) e o motor.
 */
export function spawnWave(
  state: CombatState,
  input: {
    readonly enemies: readonly EnemyCombatant[];
    readonly floor: number;
    readonly wave: number;
    readonly isBossFloor: boolean;
    readonly resetSquad?: boolean;
  },
): CombatState {
  const heroes = state.combatants.filter((actor) => actor.team === 'squad');

  // Reset de squad entre waves: recupera HP/MP e limpa efeitos, mas PRESERVA
  // os cooldowns de skill. Reabrir o cooldown a cada wave permitia ao squad
  // fazer burst ilimitado no inicio de cada wave.
  const refreshedHeroes = input.resetSquad
    ? heroes.map((actor) => ({
        ...actor,
        hp: actor.maxHp,
        mp: actor.maxMp,
        shield: 0,
        isAlive: true,
        effects: [],
        // Os cooldowns continuam a correr entre waves.
        skillCooldowns: actor.skillCooldowns,
      }))
    : heroes;

  const skillMap: Record<Uuid, readonly EquippedSkill[]> = { ...state.skills };
  for (const actor of refreshedHeroes) skillMap[actor.id] = actor.skills;
  for (const enemy of input.enemies) skillMap[enemy.id] = enemy.skills;

  return {
    ...state,
    phase: input.isBossFloor ? 'boss_telegraph' : 'wave_intro',
    floor: input.floor,
    wave: input.wave,
    isBossFloor: input.isBossFloor,
    combatants: [...refreshedHeroes, ...input.enemies],
    events: [],
    waveElapsedSec: 0,
    control: {},
    skills: skillMap,
    waveActive: input.enemies.length > 0,
    absorbed: 0,
  };
}

export function emptyMetrics(): CombatMetrics {
  return { totalDamage: 0, totalHealing: 0, totalDamageTaken: 0, elapsedSec: 0, perActor: {} };
}

export function emptyActorMetrics(): ActorMetrics {
  return {
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    critCount: 0,
    hitCount: 0,
    missCount: 0,
    deaths: 0,
    dps: 0,
    dpsSharePct: 0,
    critRatePct: 0,
  };
}

/* ==========================================================================
 * HELPERS DE COMBATENTE
 * ========================================================================== */

export function isAlive(actor: Combatant): boolean {
  return actor.hp > 0 && actor.isAlive;
}

export function aliveOf(combatants: readonly Combatant[], team: Combatant['team']): readonly Combatant[] {
  return combatants.filter((actor) => actor.team === team && isAlive(actor));
}

/** Reduz o cooldown de todas as skills e o do auto-ataque. */
function tickCooldowns(actor: Combatant, dt: number): Combatant {
  const cooldowns: Record<ContentId, number> = {};
  for (const [skillId, remaining] of Object.entries(actor.skillCooldowns)) {
    cooldowns[skillId] = Math.max(0, remaining - dt);
  }
  return {
    ...actor,
    attackCooldownSec: Math.max(0, actor.attackCooldownSec - dt),
    skillCooldowns: cooldowns,
  };
}

/** Aplica dano: shield absorve primeiro, depois HP. */
export function applyDamageTo(actor: Combatant, amount: number): Combatant {
  const incoming = Math.max(0, Math.round(amount));
  const absorbed = Math.min(actor.shield, incoming);
  const toHp = incoming - absorbed;
  const hp = Math.max(0, actor.hp - toHp);
  return {
    ...actor,
    shield: actor.shield - absorbed,
    hp,
    isAlive: hp > 0,
  };
}

/** Aplica cura respeitando MaxHP. */
export function applyHealTo(actor: Combatant, amount: number): Combatant {
  const healed = Math.min(actor.maxHp - actor.hp, Math.max(0, Math.round(amount)));
  const hp = actor.hp + healed;
  return { ...actor, hp, isAlive: hp > 0 };
}

/* ==========================================================================
 * TARGETING
 * ========================================================================== */

/**
 * Escolhe o alvo: tanque (front) primeiro, com fallback para a linha mais
 * próxima ainda viva.
 *
 * Garantia explícita (Stage 8.3): se Front e Mid não têm membros vivos, a
 * Back Line é escolhida. Antes, um `reduce` sem semente podia devolver
 * `undefined` quando a linha calculada não tinha candidatos — os inimigos
 * ficavam sem alvo e a luta "congelava" no HUD.
 */
export function pickTarget(enemies: readonly Combatant[]): Combatant | null {
  const alive = enemies.filter(isAlive);
  if (alive.length === 0) return null;

  const frontline = frontmostLine(alive);
  if (!frontline) return alive[0] ?? null;

  const candidates = alive.filter((actor) => actor.position === frontline);
  const first = candidates[0];
  if (!first) return alive[0] ?? null;

  // Empate dentro da linha: ataca quem tem menos HP (finaliza primeiro).
  return candidates.reduce((lowest, actor) => (actor.hp < lowest.hp ? actor : lowest), first);
}

/* ==========================================================================
 * AUTO-ATAQUE
 * ========================================================================== */

interface AttackOutcome {
  readonly target: Combatant;
  readonly isCrit: boolean;
  readonly isMiss: boolean;
  readonly amount: number;
}

function rollAttack(
  _attacker: Combatant,
  target: Combatant,
  stats: DerivedStats,
  rng: Rng,
  isMagic: boolean,
): AttackOutcome {
  const hitChance = computeHitChance(stats.hit, target.stats.flee);
  const isMiss = !rng.chance(hitChance);
  if (isMiss) {
    return { target, isCrit: false, isMiss: true, amount: 0 };
  }

  const isCrit = rng.chance(stats.crit / 100);
  const raw = isMagic ? stats.matk : stats.atk;
  const defence = isMagic ? target.stats.mdef : target.stats.def;

  const result = computeDamage({
    rawDamage: raw,
    attackerElement: 'neutral',
    defenderElement: 'neutral',
    defenderRace: 'humanoid',
    defenderSize: 'medium',
    defenderTier: target.team === 'enemy' ? (target as EnemyCombatant).tier : 'normal',
    weaponType: null,
    defence,
    isCrit,
    isAoe: false,
    defenderMaxHp: target.maxHp,
    damageBonusPct: 0,
  });

  return { target, isCrit, isMiss: false, amount: result.amount };
}

/* ==========================================================================
 * MÉTRICAS
 * ========================================================================== */

function recordDamage(
  metrics: CombatMetrics,
  sourceId: Uuid,
  targetId: Uuid,
  amount: number,
  isCrit: boolean,
  isMiss: boolean,
): CombatMetrics {
  const perActor: Record<Uuid, ActorMetrics> = { ...metrics.perActor };
  const source = perActor[sourceId] ?? emptyActorMetrics();
  const target = perActor[targetId] ?? emptyActorMetrics();

  perActor[sourceId] = {
    ...source,
    damageDealt: source.damageDealt + amount,
    hitCount: source.hitCount + (isMiss ? 0 : 1),
    missCount: source.missCount + (isMiss ? 1 : 0),
    critCount: source.critCount + (isCrit ? 1 : 0),
  };
  perActor[targetId] = {
    ...target,
    damageTaken: target.damageTaken + amount,
  };

  return {
    ...metrics,
    totalDamage: metrics.totalDamage + amount,
    totalDamageTaken: metrics.totalDamageTaken + amount,
    perActor,
  };
}

export function recordHealing(metrics: CombatMetrics, sourceId: Uuid, amount: number): CombatMetrics {
  const perActor: Record<Uuid, ActorMetrics> = { ...metrics.perActor };
  const source = perActor[sourceId] ?? emptyActorMetrics();
  perActor[sourceId] = { ...source, healingDone: source.healingDone + amount };
  return { ...metrics, totalHealing: metrics.totalHealing + amount, perActor };
}

/** Recalcula DPS, share e crit% — chamado uma vez por tick, não por evento. */
export function finaliseMetrics(metrics: CombatMetrics, elapsedSec: number): CombatMetrics {
  const safeElapsed = Math.max(1, elapsedSec);
  const perActor: Record<Uuid, ActorMetrics> = {};
  for (const [id, actor] of Object.entries(metrics.perActor)) {
    const attempts = actor.hitCount + actor.missCount;
    perActor[id] = {
      ...actor,
      dps: actor.damageDealt / safeElapsed,
      dpsSharePct: metrics.totalDamage > 0 ? (actor.damageDealt / metrics.totalDamage) * 100 : 0,
      critRatePct: attempts > 0 ? (actor.critCount / attempts) * 100 : 0,
    };
  }
  return { ...metrics, elapsedSec: safeElapsed, perActor };
}

/* ==========================================================================
 * TICK PRINCIPAL
 * ========================================================================== */

export interface AdvanceContext {
  readonly rng: Rng;
  readonly now: EpochMs;
}

/**
 * Avança o combate `deltaSec` segundos.
 *
 * Regras:
 *  · um auto-ataque por combatente quando `attackCooldownSec` chega a 0;
 *  · efeitos activos (DoT/HoT) fazem tick no intervalo definido;
 *  · morte → evento; fim de wave/boss → transição de fase;
 *  · o dano máximo por evento de AoE é limitado (40% do MaxHP) na fórmula.
 */
export function advanceCombat(state: CombatState, deltaSec: number, ctx: AdvanceContext): CombatState {
  if (!state.running) return state;
  const dt = Math.max(0, Math.min(safeNumber(deltaSec), C.tickIntervalSec * C.maxCatchUpSteps));
  if (dt === 0) return state;

  const events = [...state.events];
  let metrics = state.metrics;
  let combatants: readonly Combatant[] = state.combatants.map((actor) => tickCooldowns(actor, dt));
  const elapsedSec = state.elapsedSec + dt;
  const waveElapsedSec = state.waveElapsedSec + dt;

  // 1. Auto-ataques (bloqueados por stun)
  for (const attacker of combatants) {
    if (!isAlive(attacker) || attacker.attackCooldownSec > 0) continue;
    if (!canAct({ ...state, combatants, control: state.control }, attacker.id, ctx.now)) continue;

    const opponents = aliveOf(combatants, attacker.team === 'squad' ? 'enemy' : 'squad');
    const target = pickTarget(opponents);
    if (!target) continue;

    const isMagic = attacker.team === 'squad' && (attacker as PlayerCombatant).baseClass === 'mage';
    const outcome = rollAttack(attacker, target, attacker.stats, ctx.rng, isMagic);

    if (outcome.isMiss) {
      events.push({
        id: `${attacker.id}:miss:${ctx.now}`,
        at: ctx.now,
        type: 'damage',
        sourceId: attacker.id,
        targetId: target.id,
        amount: 0,
        isCrit: false,
        isMiss: true,
        element: 'neutral',
        skillId: null,
      });
    } else {
      events.push({
        id: `${attacker.id}:hit:${ctx.now}`,
        at: ctx.now,
        type: 'damage',
        sourceId: attacker.id,
        targetId: target.id,
        amount: outcome.amount,
        isCrit: outcome.isCrit,
        isMiss: false,
        element: 'neutral',
        skillId: null,
      });
      metrics = recordDamage(metrics, attacker.id, target.id, outcome.amount, outcome.isCrit, false);
    }

    combatants = combatants.map((actor) => {
      if (actor.id === attacker.id) {
        return { ...actor, attackCooldownSec: attackIntervalSec(attacker.stats.attackSpeed) };
      }
      if (actor.id === target.id && !outcome.isMiss) {
        const damaged = applyDamageTo(actor, outcome.amount);
        if (!damaged.isAlive && actor.isAlive) {
          events.push({
            id: `${actor.id}:death:${ctx.now}`,
            at: ctx.now,
            type: 'death',
            actorId: actor.id,
            team: actor.team,
          });
        }
        return damaged;
      }
      return actor;
    });
  }

  // 2. Habilidades — cooldowns, custo de MP e executor de efeitos
  const castResult = castSkills(combatants, state, ctx, events, metrics);
  combatants = castResult.combatants;
  metrics = castResult.metrics;
  let control = castResult.control;
  let absorbed = state.absorbed + castResult.absorbed;

  // 3. Efeitos activos (DoT/HoT/regen) — executados em skills.ts
  const effectResult = tickEffects(combatants, control, ctx.now, dt);
  combatants = effectResult.combatants;
  control = effectResult.control;

  // 4. Resolução da fase
  const squadAlive = aliveOf(combatants, 'squad').length;
  const enemiesAlive = aliveOf(combatants, 'enemy').length;

  // A resolucao olha para o NUMERO DE INIMIGOS VIVOS, nao para a fase
  // anterior. O bug original exigia `state.phase !== 'wave_intro'`, o que
  // deixava a luta presa quando o primeiro cast matava o unico inimigo
  // (a wave nunca era declarada limpa e o HUD ficava em "wave_intro").
  let phase: CombatPhase = state.phase;
  if (squadAlive === 0) {
    phase = 'wipe';
  } else if (enemiesAlive === 0) {
    phase = state.isBossFloor && state.wave >= state.wavesPerFloor ? 'floor_clear' : 'wave_clear';
  } else if (state.phase === 'wave_intro' || state.phase === 'boss_telegraph') {
    phase = state.isBossFloor && state.wave >= state.wavesPerFloor ? 'boss_fight' : 'fighting';
  }

  if (phase !== state.phase) {
    events.push({
      id: `phase:${phase}:${ctx.now}`,
      at: ctx.now,
      type: 'wave',
      phase: phase === 'wave_clear' || phase === 'floor_clear' ? 'clear' : 'start',
      floor: state.floor,
      wave: state.wave,
      reward: null,
    });
  }

  return {
    ...state,
    phase,
    combatants,
    events: events.slice(-C.maxEventsPerTick),
    elapsedSec,
    waveElapsedSec,
    metrics: finaliseMetrics(metrics, elapsedSec),
    control,
    skills: castResult.skills,
    absorbed,
    rngCursor: ctx.rng.getState().cursor,
  };
}

/* ==========================================================================
 * LANÇAMENTO DE SKILLS
 * ========================================================================== */

interface CastOutcome {
  readonly combatants: readonly Combatant[];
  readonly metrics: CombatMetrics;
  readonly control: Readonly<Record<Uuid, ControlState>>;
  /** Mapa de skills com cooldowns frescos (nunca o original). */
  readonly skills: Readonly<Record<Uuid, readonly EquippedSkill[]>>;
  readonly absorbed: number;
}

/**
 * Percorre todos os combatentes e lança as skills prontas (cooldown 0).
 *
 * Regras:
 *  · stun bloqueia tudo; silêncio bloqueia só skills;
 *  · MP é consumido no cast; sem MP a skill fica em espera;
 *  · o cooldown arranca no cast, mesmo que o efeito falhe;
 *  · efeitos entram por `applyCast` (DoT/HoT/shield/buff/control).
 */
function castSkills(
  combatants: readonly Combatant[],
  state: CombatState,
  ctx: AdvanceContext,
  events: CombatState['events'][number][],
  metrics: CombatMetrics,
): CastOutcome {
  // Os cooldowns recebidos JA foram decrementados por `tickCooldowns` no
  // inicio de `advanceCombat`. Decrementar outra vez dobrava a velocidade
  // de recarga e, como este array e escrito por cima do anterior, o
  // conjurador voltava a ler 0 no tick seguinte.
  let list: readonly Combatant[] = combatants;
  let currentMetrics = metrics;
  let currentControl = state.control;
  let absorbed = 0;

  for (let casterIndex = 0; casterIndex < list.length; casterIndex += 1) {
    const entryActor = list[casterIndex];
    if (!entryActor || !isAlive(entryActor)) continue;
    if (!canCast(state, entryActor.id, ctx.now)) continue;
    const casterId = entryActor.id;

    const equipped = state.skills[casterId] ?? [];
    if (equipped.length === 0) continue;

    for (const entry of equipped) {
      // O snapshot TEM de ser lido DEPOIS do cast anterior deste tick:
      // cooldowns e MP mudam dentro deste mesmo loop. Ler um snapshot antigo
      // fazia a segunda skill ignorar o cooldown recem-gravado.
      const liveCaster = list.find((actor) => actor.id === casterId);
      if (!liveCaster || !isAlive(liveCaster)) break;

      const skill = SKILL_BY_ID.get(entry.skillId);
      if (!skill || skill.kind === 'passive') continue;

      // `tickCooldowns` grava 0 (nao remove a chave) quando a skill fica
      // pronta. Usar `?? 0` aqui e correcto porque o valor e sempre numero.
      const remaining = liveCaster.skillCooldowns[skill.id] ?? 0;
      if (remaining > 0) continue;
      if (liveCaster.mp < skill.mpCost) continue;

      const applications = resolveSkillCast({
        caster: liveCaster,
        skill,
        combatants: list,
        now: ctx.now,
        rng: ctx.rng,
        buffDurationPct: liveCaster.stats.buffDuration,
      });
      if (applications.length === 0) continue;

      events.push({
        id: `cast:${casterId}:${skill.id}:${ctx.now}`,
        at: ctx.now,
        type: 'skill_cast',
        sourceId: casterId,
        skillId: skill.id,
        targetIds: applications.map((application) => application.effect.targetActorId),
        castTimeSec: skill.castTimeSec,
      });

      // Dano/cura imediata → eventos + métricas
      for (const application of applications) {
        const immediate = application.immediate;
        if (!immediate) continue;
        if (immediate.kind === 'damage') {
          events.push({
            id: `skill-dmg:${application.effect.id}`,
            at: ctx.now,
            type: 'damage',
            sourceId: casterId,
            targetId: application.effect.targetActorId,
            amount: immediate.amount,
            isCrit: false,
            isMiss: false,
            element: skill.effects[0]?.element ?? 'neutral',
            skillId: skill.id,
          });
          currentMetrics = recordDamage(currentMetrics, casterId, application.effect.targetActorId, immediate.amount, false, false);
        } else if (immediate.kind === 'heal') {
          events.push({
            id: `skill-heal:${application.effect.id}`,
            at: ctx.now,
            type: 'heal',
            sourceId: casterId,
            targetId: application.effect.targetActorId,
            amount: immediate.amount,
            skillId: skill.id,
            isCrit: false,
          });
          currentMetrics = recordHealing(currentMetrics, casterId, immediate.amount);
        } else {
          absorbed += immediate.amount;
          events.push({
            id: `skill-shield:${application.effect.id}`,
            at: ctx.now,
            type: 'shield',
            sourceId: casterId,
            targetId: application.effect.targetActorId,
            amount: immediate.amount,
            skillId: skill.id,
          });
        }
      }

      const applied = applyCast(list, applications, currentControl, ctx.now);
      list = applied.combatants;
      currentControl = applied.control;

      // Cooldown e MP.
      //
      // BUG HISTORICO: `applyCast` recria o array de combatentes, o que
      // invalida `casterIndex` (a posicao pode mover-se). Escrever no indice
      // fazia com que o cooldown fosse para outro actor e o conjurador
      // voltasse a ler 0 no tick seguinte -> cast infinito.
      //
      // Solucao: localizar o conjurador POR ID no array novo.
      list = list.map((actor) =>
        actor.id === casterId
          ? {
              ...actor,
              mp: Math.max(0, actor.mp - skill.mpCost),
              skillCooldowns: { ...actor.skillCooldowns, [skill.id]: skill.cooldownSec },
            }
          : actor,
      );


    }
  }

  return { combatants: list, metrics: currentMetrics, control: currentControl, skills: state.skills, absorbed };
}

/* ==========================================================================
 * EFEITOS
 * ========================================================================== */

/**
 * Os efeitos activos (DoT/HoT/shield/buff/control) são executados em
 * `lib/game/skills.ts`. Este módulo mantém apenas o auto-ataque e a
 * progressão de fases, o que mantém cada ficheiro com uma responsabilidade.
 *
 * `tickActiveEffects` fica aqui como ponte para quem só tem o CombatState.
 */
export function tickActiveEffects(
  state: CombatState,
  dt: number,
  now: EpochMs,
): CombatState {
  const result = tickEffects(state.combatants, state.control, now, dt);
  return { ...state, combatants: result.combatants, control: result.control };
}

/** Aplica um efeito novo, respeitando o limite de efeitos activos. */
export function addEffect(actor: Combatant, effect: ActiveEffect): Combatant {
  const effects = [...actor.effects, effect].slice(-C.maxActiveEffects);
  return { ...actor, effects };
}
