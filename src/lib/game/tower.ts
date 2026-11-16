/**
 * Máquina de estados da torre.
 *
 * Modelo (wiki): andar → 9 waves de mobs → wave 10 = chefe-portão.
 * Andares múltiplos de 10 são de chefe e BLOQUEIAM o avanço até serem
 * derrotados. Ao morrer, o squad volta ao checkpoint.
 *
 * Transições:
 *
 *   IDLE ──startFloor──▶ FIGHTING ──wave clear──▶ FIGHTING (wave+1)
 *                            │                        │
 *                            │                    wave 10 (boss floor)
 *                            ▼                        ▼
 *                          WIPE ──checkpoint──▶ FIGHTING   BOSS ──kill──▶ FLOOR_CLEAR ──▶ FLOOR+1
 *
 * Tudo puro: `advanceTower(state, outcome)` devolve o próximo estado.
 * O servidor reexecuta esta máquina para validar progresso.
 */
import type { ContentId, FloorDefinition, Uuid } from '@/types/game';
import { BALANCE } from './balance';
import { FLOOR_BY_NUMBER, getFloor } from '@/data/tower';

/* ==========================================================================
 * ESTADO
 * ========================================================================== */

export type TowerPhase = 'idle' | 'fighting' | 'boss' | 'wave_clear' | 'floor_clear' | 'wipe' | 'checkpoint';

export interface TowerState {
  readonly phase: TowerPhase;
  readonly floor: number;
  readonly wave: number;
  readonly wavesPerFloor: number;
  readonly isBossFloor: boolean;
  /** Maior andar já concluído (base do checkpoint). */
  readonly highestFloor: number;
  /** Andar onde o squad renasce. */
  readonly checkpointFloor: number;
  /** Andares concluídos no primeiro clear — para drops garantidos. */
  readonly clearedFloors: readonly number[];
  /** Waves vencidas na sessão actual (telemetria). */
  readonly wavesCleared: number;
  /** Tempo acumulado no andar actual, em segundos. */
  readonly floorElapsedSec: number;
  /** Modo de farm (repete waves sem subir) vs. avanço. */
  readonly mode: TowerMode;
}

export type TowerMode = 'farm' | 'advance';

export interface TowerConfig {
  readonly wavesPerFloor: number;
  readonly bossFloorInterval: number;
  readonly bossWaveIndex: number;
}

export const TOWER_CONFIG: TowerConfig = {
  wavesPerFloor: BALANCE.tower.wavesPerFloor,
  bossFloorInterval: BALANCE.tower.bossFloorInterval,
  bossWaveIndex: BALANCE.tower.bossWaveIndex,
} as const;

/* ==========================================================================
 * CRIAÇÃO
 * ========================================================================== */

export function createTowerState(input: {
  readonly floor?: number;
  readonly highestFloor?: number;
  readonly checkpointFloor?: number;
  readonly clearedFloors?: readonly number[];
  readonly mode?: TowerMode;
}): TowerState {
  const floor = Math.max(1, Math.floor(input.floor ?? 1));
  return {
    phase: 'idle',
    floor,
    wave: 1,
    wavesPerFloor: TOWER_CONFIG.wavesPerFloor,
    isBossFloor: isBossFloor(floor),
    highestFloor: Math.max(floor, input.highestFloor ?? floor),
    checkpointFloor: Math.max(1, input.checkpointFloor ?? 1),
    clearedFloors: input.clearedFloors ?? [],
    wavesCleared: 0,
    floorElapsedSec: 0,
    mode: input.mode ?? 'advance',
  };
}

/* ==========================================================================
 * PREDICADOS
 * ========================================================================== */

export function isBossFloor(floor: number): boolean {
  return floor % TOWER_CONFIG.bossFloorInterval === 0;
}

/** A wave actual é a wave do chefe? */
export function isBossWave(state: TowerState): boolean {
  return state.isBossFloor && state.wave >= TOWER_CONFIG.bossWaveIndex;
}

/** Total de waves no andar: 10 em andar de chefe, 9 nos normais. */
export function wavesForFloor(floor: number): number {
  return isBossFloor(floor) ? TOWER_CONFIG.bossWaveIndex : TOWER_CONFIG.wavesPerFloor;
}

/** Definição do andar (bioma, pool de mobs, chefe). */
export function floorDefinition(floor: number): FloorDefinition {
  return FLOOR_BY_NUMBER.get(floor) ?? getFloor(floor);
}

/** Pool de mobs da wave actual. */
export function mobPoolForWave(state: TowerState): readonly ContentId[] {
  const definition = floorDefinition(state.floor);
  return definition.mobPool;
}

/** Id do chefe do andar (null se não for andar de chefe). */
export function bossForFloor(floor: number): ContentId | null {
  return floorDefinition(floor).bossMonsterId;
}

/* ==========================================================================
 * TRANSIÇÕES
 * ========================================================================== */

export type TowerOutcome =
  | { readonly type: 'start' }
  | { readonly type: 'wave_clear' }
  | { readonly type: 'boss_defeated' }
  | { readonly type: 'wipe' }
  | { readonly type: 'tick'; readonly dt: number }
  | { readonly type: 'set_mode'; readonly mode: TowerMode }
  | { readonly type: 'challenge_boss' };

export interface TowerTransition {
  readonly state: TowerState;
  /** `true` se o andar mudou nesta transição. */
  readonly floorChanged: boolean;
  /** `true` se um novo chefe acabou de ser desbloqueado. */
  readonly bossUnlocked: boolean;
  /** `true` se o squad deve renascer no checkpoint. */
  readonly respawn: boolean;
}

/**
 * Aplica um resultado de combate à máquina de estados.
 *
 * É o único ponto que decide "subir de andar", "voltar ao checkpoint" ou
 * "repetir wave". O motor de combate nunca decide isto sozinho.
 */
export function advanceTower(state: TowerState, outcome: TowerOutcome): TowerTransition {
  switch (outcome.type) {
    case 'start': {
      return {
        state: { ...state, phase: isBossWave(state) ? 'boss' : 'fighting', wave: Math.max(1, state.wave) },
        floorChanged: false,
        bossUnlocked: false,
        respawn: false,
      };
    }

    case 'tick': {
      return {
        state: { ...state, floorElapsedSec: state.floorElapsedSec + Math.max(0, outcome.dt) },
        floorChanged: false,
        bossUnlocked: false,
        respawn: false,
      };
    }

    case 'set_mode': {
      // Em farm, o squad nunca sobe de andar — repete a pool actual.
      return {
        state: { ...state, mode: outcome.mode },
        floorChanged: false,
        bossUnlocked: false,
        respawn: false,
      };
    }

    case 'challenge_boss': {
      if (!state.isBossFloor) {
        return { state, floorChanged: false, bossUnlocked: false, respawn: false };
      }
      return {
        state: { ...state, phase: 'boss', wave: TOWER_CONFIG.bossWaveIndex },
        floorChanged: false,
        bossUnlocked: false,
        respawn: false,
      };
    }

    case 'wave_clear': {
      const totalWaves = wavesForFloor(state.floor);
      const nextWave = state.wave + 1;

      // Andar de chefe: a wave do chefe só se resolve com 'boss_defeated'.
      // Um 'wave_clear' nessa wave significa que os adds morreram mas o chefe
      // continua vivo — fica bloqueado, nunca sobe.
      if (state.isBossFloor && state.wave >= TOWER_CONFIG.bossWaveIndex) {
        return {
          state: { ...state, phase: 'boss', wave: TOWER_CONFIG.bossWaveIndex },
          floorChanged: false,
          bossUnlocked: false,
          respawn: false,
        };
      }

      // Última wave de um andar normal → conclui o andar e sobe.
      if (nextWave > totalWaves) {
        return completeFloor(state, false);
      }

      return {
        state: {
          ...state,
          phase: 'fighting',
          wave: nextWave,
          wavesCleared: state.wavesCleared + 1,
        },
        floorChanged: false,
        bossUnlocked: false,
        respawn: false,
      };
    }

    case 'boss_defeated': {
      if (!state.isBossFloor) {
        return { state, floorChanged: false, bossUnlocked: false, respawn: false };
      }
      return completeFloor(state, true);
    }

    case 'wipe': {
      // Morrer devolve ao checkpoint. Em farm, apenas repete a wave actual.
      const respawnFloor = state.mode === 'farm' ? state.floor : state.checkpointFloor;
      return {
        state: {
          ...state,
          phase: 'checkpoint',
          floor: respawnFloor,
          wave: 1,
          isBossFloor: isBossFloor(respawnFloor),
          floorElapsedSec: 0,
        },
        floorChanged: respawnFloor !== state.floor,
        bossUnlocked: false,
        respawn: true,
      };
    }

    default:
      return { state, floorChanged: false, bossUnlocked: false, respawn: false };
  }
}

/**
 * Conclui o andar actual.
 *
 * Regra do checkpoint (a wiki deixou em aberto — decisão registada aqui):
 *  · o checkpoint avança ao CONCLUIR o andar, não ao entrar nele;
 *  · em modo farm o squad não sobe, apenas regista a conclusão.
 */
function completeFloor(state: TowerState, wasBoss: boolean): TowerTransition {
  const clearedFloors = state.clearedFloors.includes(state.floor)
    ? state.clearedFloors
    : [...state.clearedFloors, state.floor];

  const highestFloor = Math.max(state.highestFloor, state.floor);
  // Checkpoint = andar concluído (o squad renasce nele e recombate a partir da wave 1).
  const checkpointFloor = Math.max(state.checkpointFloor, state.floor);

  if (state.mode === 'farm') {
    return {
      state: {
        ...state,
        phase: 'fighting',
        wave: 1,
        wavesCleared: state.wavesCleared + 1,
        highestFloor,
        checkpointFloor,
        clearedFloors,
        floorElapsedSec: 0,
      },
      floorChanged: false,
      bossUnlocked: false,
      respawn: false,
    };
  }

  const nextFloor = state.floor + 1;
  const unlocksBoss = isBossFloor(nextFloor);

  return {
    state: {
      phase: 'floor_clear',
      floor: nextFloor,
      wave: 1,
      wavesPerFloor: TOWER_CONFIG.wavesPerFloor,
      isBossFloor: unlocksBoss,
      highestFloor,
      checkpointFloor,
      clearedFloors,
      wavesCleared: state.wavesCleared + 1,
      floorElapsedSec: 0,
      mode: state.mode,
    },
    floorChanged: true,
    bossUnlocked: unlocksBoss && !wasBoss,
    respawn: false,
  };
}

/* ==========================================================================
 * PROGRESSO OFFLINE
 * ========================================================================== */

export interface OfflineTowerResult {
  readonly floorsAdvanced: number;
  readonly finalFloor: number;
  readonly capped: boolean;
  readonly creditedSeconds: number;
}

/**
 * Avança a torre por tempo offline (cap de 8h, regra da wiki).
 * Não pode passar de um andar de chefe sem o derrotar — logo o farm offline
 * estagna antes do próximo andar de chefe.
 */
export function simulateOfflineProgress(input: {
  readonly state: TowerState;
  readonly secondsAway: number;
}): OfflineTowerResult {
  const { offline } = BALANCE.tower;
  const maxSeconds = offline.maxHours * 3600;
  const credited = Math.min(Math.max(0, input.secondsAway), maxSeconds);
  const capped = input.secondsAway > maxSeconds;

  // Taxa de conclusão de andar: ~90s por andar no início, escalando com o andar.
  const secondsPerFloor = 90 * (1 + input.state.floor * 0.06);
  const possibleFloors = Math.floor((credited * offline.efficiency) / secondsPerFloor);
  const limited = Math.min(possibleFloors, offline.maxFloorsOffline);

  let floor = input.state.floor;
  let advanced = 0;

  for (let index = 0; index < limited; index += 1) {
    // Para antes de um andar de chefe — chefes exigem o jogador.
    if (isBossFloor(floor + 1)) break;
    floor += 1;
    advanced += 1;
  }

  return { floorsAdvanced: advanced, finalFloor: floor, capped, creditedSeconds: credited };
}

/* ==========================================================================
 * VIEW MODEL PARA O HUD
 * ========================================================================== */

export interface TowerHud {
  readonly floor: number;
  readonly floorName: string;
  readonly biome: string;
  readonly wave: number;
  readonly totalWaves: number;
  readonly isBossFloor: boolean;
  readonly phaseLabel: string;
  readonly checkpointFloor: number;
  readonly progressPct: number;
}

const PHASE_LABEL: Readonly<Record<TowerPhase, string>> = {
  idle: 'A preparar',
  fighting: 'Combate',
  boss: 'CHEFE',
  wave_clear: 'Wave limpa',
  floor_clear: 'Andar concluído',
  wipe: 'Wipe',
  checkpoint: 'Checkpoint',
} as const;

export function towerHud(state: TowerState): TowerHud {
  const definition = floorDefinition(state.floor);
  const totalWaves = wavesForFloor(state.floor);
  return {
    floor: state.floor,
    floorName: definition.name,
    biome: definition.biome,
    wave: state.wave,
    totalWaves,
    isBossFloor: state.isBossFloor,
    phaseLabel: PHASE_LABEL[state.phase],
    checkpointFloor: state.checkpointFloor,
    progressPct: Math.min(100, Math.round((state.wave / totalWaves) * 100)),
  };
}

/** Identificador estável para o seed da wave (determinismo por wave). */
export function waveSeed(seed: number, floor: number, wave: number): string {
  return `${seed}:${floor}:${wave}`;
}

/** Chave de dono para telemetria/auditoria. */
export function towerKey(ownerId: Uuid, floor: number): string {
  return `${ownerId}:${floor}`;
}
