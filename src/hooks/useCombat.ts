'use client';

/**
 * useCombat — orquestra o motor completo dentro do React.
 *
 * Responsabilidades:
 *  · manter o `CombatState` num ref (o loop corre a 60 Hz, não re-renderiza);
 *  · publicar um snapshot a ~12 Hz para a UI;
 *  · criar o RNG determinístico a partir de `seed` + `rngCursor`;
 *  · **integrar a torre**: quando uma wave limpa, pedir a próxima a
 *    `advanceTower` e instanciá-la com `buildWave` + `spawnWave`;
 *  · **integrar os drops**: ao limpar a wave, sortear loot com `rollDrops`;
 *  · acumular recompensas (gold/exp/itens) para o HUD.
 *
 * Toda a regra de jogo vive em `lib/game/*`. Este ficheiro só orquestra.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { advanceCombat, createCombatState, finaliseMetrics, spawnWave } from '@/lib/game/combat';
import { buildWave } from '@/lib/game/actors';
import { BALANCE } from '@/lib/game/balance';
import { rollDrops } from '@/lib/game/drops';
import { hashSeed, createRng, type Rng } from '@/lib/game/rng';
import {
  advanceTower,
  createTowerState,
  floorDefinition,
  isBossWave,
  wavesForFloor,
  waveSeed,
  type TowerState,
} from '@/lib/game/tower';
import { useGameLoop } from '@/hooks/useGameLoop';
import type {
  CombatEvent,
  CombatState,
  InventoryItem,
  PlayerCombatant,
  Squad,
  WaveReward,
} from '@/types/game';

const UI_PUBLISH_HZ = 12;

export interface UseCombatOptions {
  readonly squad: Squad;
  /** Andar inicial (progresso carregado do servidor). */
  readonly initialFloor?: number;
  /** Wave inicial (progresso carregado do servidor). */
  readonly initialWave?: number;
  readonly checkpointFloor?: number;
  readonly seed?: number;
  /** Modo da torre (farm repete o andar). */
  readonly mode?: 'farm' | 'advance';
  /** Stats do líder — usado no `dropBonus` do sorteio. */
  readonly dropBonus?: number;
  readonly onReward?: (reward: WaveReward, tower: TowerState) => void;
  readonly onWipe?: (tower: TowerState) => void;
}

export interface UseCombatResult {
  readonly state: CombatState;
  readonly tower: TowerState;
  readonly running: boolean;
  readonly rewards: WaveReward;
  readonly loot: readonly InventoryItem[];
  pause(): void;
  resume(): void;
  toggle(): void;
  drainEvents(): readonly CombatEvent[];
  /** Substitui o squad (level-up, equipamento) sem reiniciar a luta. */
  setSquad(squad: Squad): void;
  /** Desafia o chefe do andar actual (se for andar de chefe). */
  challengeBoss(): void;
  /** Alterna farm/avanço. */
  setMode(mode: 'farm' | 'advance'): void;
  /** Reinicia no andar indicado (usado no wipe). */
  restart(floor?: number): void;
}

const EMPTY_REWARD: WaveReward = { gold: 0, exp: 0, items: [], firstClearDrop: false };

export function useCombat(options: UseCombatOptions): UseCombatResult {
  const {
    squad,
    initialFloor = 1,
    initialWave = 1,
    checkpointFloor = 1,
    seed = 1,
    mode = 'advance',
    dropBonus = 0,
  } = options;
  const { onReward, onWipe } = options;

  const rngRef = useRef<Rng>(createRng(seed));
  const pendingEventsRef = useRef<CombatEvent[]>([]);
  const publishAccumulatorRef = useRef(0);
  const rewardRef = useRef<WaveReward>(EMPTY_REWARD);
  const lootRef = useRef<InventoryItem[]>([]);

  const initialTower = createTowerState({ floor: initialFloor, checkpointFloor, mode });
  const towerRef = useRef<TowerState>({
    ...initialTower,
    wave: Math.max(1, Math.min(wavesForFloor(initialTower.floor), Math.floor(initialWave))),
  });

  const stateRef = useRef<CombatState>(initialiseCombat(squad, towerRef.current, seed));

  const [snapshot, setSnapshot] = useState<CombatState>(stateRef.current);
  const [towerSnapshot, setTowerSnapshot] = useState<TowerState>(towerRef.current);
  const [rewards, setRewards] = useState<WaveReward>(EMPTY_REWARD);
  const [loot, setLoot] = useState<readonly InventoryItem[]>([]);

  /** Instancia a wave actual da torre e injeta no estado de combate. */
  const spawnCurrentWave = useCallback(
    (tower: TowerState, base: CombatState): CombatState => {
      const definition = floorDefinition(tower.floor);
      const boss = isBossWave(tower);
      const waveRng = createRng(hashSeed(waveSeed(seed, tower.floor, tower.wave)));
      const built = buildWave({
        squad,
        floor: tower.floor,
        wave: tower.wave,
        mobPool: definition.mobPool,
        bossMonsterId: definition.bossMonsterId,
        isBossWave: boss,
        seed: waveRng.int(0, 1_000_000),
      });

      const heroes = built.heroes.length > 0 ? built.heroes : base.combatants.filter((actor) => actor.team === 'squad');

      return spawnWave({ ...base, combatants: [...heroes] }, {
        enemies: built.enemies,
        floor: tower.floor,
        wave: tower.wave,
        isBossFloor: boss,
        resetSquad: true,
      });
    },
    [squad, seed],
  );

  /** Resolve o fim de uma wave: recompensa, torre e próxima wave. */
  const resolveWave = useCallback(
    (cleared: boolean): TowerState => {
      const current = towerRef.current;
      const boss = isBossWave(current);
      const definition = floorDefinition(current.floor);

      let nextTower: TowerState = current;

      if (cleared) {
        // 1. Loot + gold
        const drop = rollDrops(
          {
            tableId: definition.bossMonsterId ?? definition.mobPool[0] ?? 'drops.slime',
            floor: current.floor,
            isBoss: boss,
            firstClear: !current.clearedFloors.includes(current.floor),
            squadStats: { dropBonus },
            ownerId: squad.ownerId,
            nowIso: new Date().toISOString(),
          },
          rngRef.current,
        );

        const waveReward: WaveReward = {
          gold: drop.gold,
          exp: Math.round(20 * current.floor * definition.rewardMultiplier),
          items: drop.items,
          firstClearDrop: drop.firstClearDrop,
        };

        rewardRef.current = {
          gold: rewardRef.current.gold + waveReward.gold,
          exp: rewardRef.current.exp + waveReward.exp,
          items: [...waveReward.items, ...rewardRef.current.items].slice(0, 40),
          firstClearDrop: rewardRef.current.firstClearDrop || waveReward.firstClearDrop,
        };
        if (drop.items.length > 0) {
          lootRef.current = [...drop.items, ...lootRef.current].slice(0, 40);
        }

        setRewards(rewardRef.current);
        setLoot(lootRef.current);

        // 2. Máquina de estados da torre
        const outcome = boss ? ({ type: 'boss_defeated' } as const) : ({ type: 'wave_clear' } as const);
        const transition = advanceTower(current, outcome);
        nextTower = transition.state;

        if (transition.respawn) onWipe?.(nextTower);
        onReward?.(waveReward, nextTower);
      }

      return nextTower;
    },
    [dropBonus, onReward, onWipe, squad.ownerId],
  );

  const onTick = useCallback(
    (stepSec: number): void => {
      const previous = stateRef.current;
      const next = advanceCombat(previous, stepSec, { rng: rngRef.current, now: Date.now() });

      if (next.events.length > 0) {
        pendingEventsRef.current = [...pendingEventsRef.current, ...next.events].slice(-256);
      }
      stateRef.current = next;

      publishAccumulatorRef.current += stepSec;
      if (publishAccumulatorRef.current >= 1 / UI_PUBLISH_HZ) {
        publishAccumulatorRef.current = 0;
        setSnapshot({ ...next, metrics: finaliseMetrics(next.metrics, next.elapsedSec) });
      }

      if (next.phase !== previous.phase) {
        if (next.phase === 'wave_clear' || next.phase === 'floor_clear') {
          const tower = resolveWave(true);
          towerRef.current = tower;
          setTowerSnapshot(tower);
          stateRef.current = spawnCurrentWave(tower, stateRef.current);
          setSnapshot(stateRef.current);
        } else if (next.phase === 'wipe') {
          const tower = advanceTower(towerRef.current, { type: 'wipe' }).state;
          towerRef.current = tower;
          setTowerSnapshot(tower);
          onWipe?.(tower);
          stateRef.current = spawnCurrentWave(tower, stateRef.current);
          setSnapshot(stateRef.current);
        }
      }
    },
    [onWipe, resolveWave, spawnCurrentWave],
  );

  const loop = useGameLoop(onTick, { stepSec: BALANCE.combat.tickIntervalSec });

  // Squad novo (level-up, equipamento) — preserva o combate em curso.
  useEffect(() => {
    const heroes = squad.members.map((character) => character.id);
    const current = stateRef.current;
    const enemies = current.combatants.filter((actor) => actor.team === 'enemy');
    const rebuilt = buildWave({
      squad,
      floor: towerRef.current.floor,
      wave: towerRef.current.wave,
      mobPool: floorDefinition(towerRef.current.floor).mobPool,
      bossMonsterId: floorDefinition(towerRef.current.floor).bossMonsterId,
      isBossWave: isBossWave(towerRef.current),
      seed,
    }).heroes;

    const merged = rebuilt.map((hero) => {
      const previous = current.combatants.find((actor) => actor.id === hero.id);
      if (!previous || previous.team !== 'squad') return hero;
      const ratio = previous.maxHp > 0 ? previous.hp / previous.maxHp : 1;
      return { ...hero, hp: Math.max(1, Math.round(hero.maxHp * ratio)), shield: previous.shield, effects: previous.effects };
    });

    const missing = heroes.length === 0;
    if (missing) return;

    stateRef.current = { ...current, combatants: [...merged, ...enemies] };
    setSnapshot(stateRef.current);
  }, [squad, seed]);

  const drainEvents = useCallback((): readonly CombatEvent[] => {
    const events = pendingEventsRef.current;
    pendingEventsRef.current = [];
    return events;
  }, []);

  const setSquad = useCallback((_next: Squad): void => {
    // O efeito acima já reage à mudança de `squad`; aqui forçamos um publish.
    setSnapshot(stateRef.current);
  }, []);

  const challengeBoss = useCallback((): void => {
    const transition = advanceTower(towerRef.current, { type: 'challenge_boss' });
    towerRef.current = transition.state;
    setTowerSnapshot(transition.state);
    stateRef.current = spawnCurrentWave(transition.state, stateRef.current);
    setSnapshot(stateRef.current);
  }, [spawnCurrentWave]);

  const setMode = useCallback((next: 'farm' | 'advance'): void => {
    const transition = advanceTower(towerRef.current, { type: 'set_mode', mode: next });
    towerRef.current = transition.state;
    setTowerSnapshot(transition.state);
  }, []);

  const restart = useCallback(
    (floor?: number): void => {
      const tower = createTowerState({
        floor: floor ?? initialFloor,
        checkpointFloor,
        mode: towerRef.current.mode,
        clearedFloors: towerRef.current.clearedFloors,
      });
      towerRef.current = tower;
      setTowerSnapshot(tower);
      const fresh = initialiseCombat(squad, tower, seed);
      stateRef.current = spawnCurrentWave(tower, fresh);
      setSnapshot(stateRef.current);
      rewardRef.current = EMPTY_REWARD;
      lootRef.current = [];
      setRewards(EMPTY_REWARD);
      setLoot([]);
    },
    [checkpointFloor, initialFloor, seed, spawnCurrentWave, squad],
  );

  return useMemo(
    () => ({
      state: snapshot,
      tower: towerSnapshot,
      running: loop.running,
      rewards,
      loot,
      pause: loop.pause,
      resume: loop.start,
      toggle: loop.toggle,
      drainEvents,
      setSquad,
      challengeBoss,
      setMode,
      restart,
    }),
    [snapshot, towerSnapshot, loop.running, loop.pause, loop.start, loop.toggle, rewards, loot, drainEvents, setSquad, challengeBoss, setMode, restart],
  );
}

/** Estado inicial: squad instanciado e wave 1 spawnada. */
function initialiseCombat(squad: Squad, tower: TowerState, seed: number): CombatState {
  const definition = floorDefinition(tower.floor);
  const built = buildWave({
    squad,
    floor: tower.floor,
    wave: tower.wave,
    mobPool: definition.mobPool,
    bossMonsterId: definition.bossMonsterId,
    isBossWave: isBossWave(tower),
    seed,
  });

  return createCombatState({
    squad: built.heroes,
    enemies: built.enemies,
    floor: tower.floor,
    wave: tower.wave,
    wavesPerFloor: BALANCE.tower.wavesPerFloor,
    isBossFloor: isBossWave(tower),
    seed,
  });
}

/** Helper para o HUD: heróis vivos do estado. */
export function livingHeroes(state: CombatState): readonly PlayerCombatant[] {
  return state.combatants.filter(
    (actor): actor is PlayerCombatant => actor.team === 'squad' && actor.hp > 0,
  );
}
