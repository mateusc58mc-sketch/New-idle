import { describe, expect, it } from 'vitest';

import {
  advanceTower,
  bossForFloor,
  createTowerState,
  floorDefinition,
  isBossFloor,
  isBossWave,
  simulateOfflineProgress,
  towerHud,
  waveSeed,
  wavesForFloor,
  type TowerState,
} from './tower';

describe('configuração da torre', () => {
  it('andares múltiplos de 10 são de chefe', () => {
    expect(isBossFloor(10)).toBe(true);
    expect(isBossFloor(20)).toBe(true);
    expect(isBossFloor(11)).toBe(false);
    expect(isBossFloor(1)).toBe(false);
  });

  it('andar normal tem 9 waves; andar de chefe tem 10', () => {
    expect(wavesForFloor(1)).toBe(9);
    expect(wavesForFloor(10)).toBe(10);
  });

  it('cada andar de chefe tem um chefe definido', () => {
    // Famílias: 5 andares por bioma → o andar 10 fecha a família 'Floresta'.
    expect(bossForFloor(10)).toBe('monster.elder_trex');
    expect(bossForFloor(20)).toBe('monster.frost_wyrm');
    expect(bossForFloor(15)).toBeNull();
  });

  it('definição de andar devolve bioma e pool', () => {
    const floor = floorDefinition(12);
    expect(floor.biome).toBe('biome.cavern');
    expect(floor.mobPool.length).toBe(4);
  });
});

describe('estado inicial', () => {
  it('começa em idle na wave 1', () => {
    const state = createTowerState({});
    expect(state.phase).toBe('idle');
    expect(state.floor).toBe(1);
    expect(state.wave).toBe(1);
    expect(state.mode).toBe('advance');
  });

  it('reconstrói progresso salvo', () => {
    const state = createTowerState({ floor: 14, highestFloor: 20, checkpointFloor: 14, clearedFloors: [1, 2, 3] });
    expect(state.floor).toBe(14);
    expect(state.highestFloor).toBe(20);
    expect(state.clearedFloors).toEqual([1, 2, 3]);
  });

  it('nunca aceita andar abaixo de 1', () => {
    expect(createTowerState({ floor: -5 }).floor).toBe(1);
    expect(createTowerState({ floor: 0 }).floor).toBe(1);
  });
});

describe('progressão de waves', () => {
  function started(state: TowerState = createTowerState({})): TowerState {
    return advanceTower(state, { type: 'start' }).state;
  }

  it('start coloca em fighting', () => {
    expect(started().phase).toBe('fighting');
  });

  it('wave clear avança a wave', () => {
    const state = started();
    const next = advanceTower(state, { type: 'wave_clear' }).state;
    expect(next.wave).toBe(2);
    expect(next.phase).toBe('fighting');
    expect(next.wavesCleared).toBe(1);
  });

  it('concluir a 9.ª wave sobe de andar', () => {
    let state = started();
    for (let wave = 1; wave < 9; wave += 1) {
      state = advanceTower(state, { type: 'wave_clear' }).state;
    }
    const transition = advanceTower(state, { type: 'wave_clear' });
    expect(transition.floorChanged).toBe(true);
    expect(transition.state.floor).toBe(2);
    expect(transition.state.wave).toBe(1);
    expect(transition.state.phase).toBe('floor_clear');
  });

  it('concluir andar actualiza o checkpoint', () => {
    let state = started();
    for (let wave = 1; wave <= 9; wave += 1) {
      state = advanceTower(state, { type: 'wave_clear' }).state;
    }
    expect(state.checkpointFloor).toBe(1);
    expect(state.highestFloor).toBe(1);
    expect(state.clearedFloors).toContain(1);
  });

  it('sinaliza bossUnlocked ao entrar num andar de chefe', () => {
    let state = started(createTowerState({ floor: 9 }));
    for (let wave = 1; wave <= 9; wave += 1) {
      const transition = advanceTower(state, { type: 'wave_clear' });
      state = transition.state;
      if (transition.floorChanged) {
        expect(transition.state.floor).toBe(10);
        expect(transition.bossUnlocked).toBe(true);
        expect(transition.state.isBossFloor).toBe(true);
      }
    }
  });
});

describe('andar de chefe bloqueia o avanço', () => {
  function bossFloorState(): TowerState {
    return createTowerState({ floor: 10, checkpointFloor: 9, highestFloor: 9 });
  }

  it('wave 10 é a wave do chefe', () => {
    const state = { ...bossFloorState(), wave: 10 };
    expect(isBossWave(state)).toBe(true);
  });

  it('start num andar de chefe com wave 10 entra em boss', () => {
    const state = advanceTower({ ...bossFloorState(), wave: 10 }, { type: 'start' }).state;
    expect(state.phase).toBe('boss');
  });

  it('wave clear na wave 10 sem matar o chefe NÃO sobe de andar', () => {
    const state = { ...bossFloorState(), wave: 10, phase: 'boss' as const };
    const transition = advanceTower(state, { type: 'wave_clear' });
    expect(transition.floorChanged).toBe(false);
    expect(transition.state.floor).toBe(10);
    expect(transition.state.phase).toBe('boss');
  });

  it('boss_defeated conclui o andar e sobe', () => {
    const state = { ...bossFloorState(), wave: 10, phase: 'boss' as const };
    const transition = advanceTower(state, { type: 'boss_defeated' });
    expect(transition.floorChanged).toBe(true);
    expect(transition.state.floor).toBe(11);
    expect(transition.state.clearedFloors).toContain(10);
    expect(transition.state.checkpointFloor).toBe(10);
  });

  it('boss_defeated fora de andar de chefe não faz nada', () => {
    const state = createTowerState({ floor: 5 });
    const transition = advanceTower(state, { type: 'boss_defeated' });
    expect(transition.state.floor).toBe(5);
  });

  it('challenge_boss só funciona em andar de chefe', () => {
    const nonBoss = advanceTower(createTowerState({ floor: 5 }), { type: 'challenge_boss' }).state;
    expect(nonBoss.phase).toBe('idle');

    const boss = advanceTower(bossFloorState(), { type: 'challenge_boss' }).state;
    expect(boss.phase).toBe('boss');
    expect(boss.wave).toBe(10);
  });
});

describe('wipe e checkpoint', () => {
  it('wipe devolve ao checkpoint em modo advance', () => {
    const state = { ...createTowerState({ floor: 12, checkpointFloor: 9 }), phase: 'fighting' as const };
    const transition = advanceTower(state, { type: 'wipe' });
    expect(transition.respawn).toBe(true);
    expect(transition.state.floor).toBe(9);
    expect(transition.state.wave).toBe(1);
    expect(transition.state.phase).toBe('checkpoint');
    expect(transition.floorChanged).toBe(true);
  });

  it('wipe em modo farm repete o andar actual', () => {
    const state = { ...createTowerState({ floor: 12, checkpointFloor: 9, mode: 'farm' }), phase: 'fighting' as const };
    const transition = advanceTower(state, { type: 'wipe' });
    expect(transition.state.floor).toBe(12);
    expect(transition.state.phase).toBe('checkpoint');
  });

  it('wipe num andar de chefe volta a um andar normal', () => {
    const state = { ...createTowerState({ floor: 10, checkpointFloor: 9 }), phase: 'boss' as const };
    const transition = advanceTower(state, { type: 'wipe' });
    expect(transition.state.floor).toBe(9);
    expect(transition.state.isBossFloor).toBe(false);
  });
});

describe('modo farm', () => {
  it('concluir andar em farm não sobe', () => {
    let state = advanceTower(createTowerState({ floor: 3, mode: 'farm' }), { type: 'start' }).state;
    for (let wave = 1; wave <= 9; wave += 1) {
      state = advanceTower(state, { type: 'wave_clear' }).state;
    }
    expect(state.floor).toBe(3);
    expect(state.wave).toBe(1);
    expect(state.phase).toBe('fighting');
  });

  it('set_mode alterna', () => {
    const state = advanceTower(createTowerState({}), { type: 'set_mode', mode: 'farm' }).state;
    expect(state.mode).toBe('farm');
  });
});

describe('progresso offline', () => {
  it('não passa de um andar de chefe', () => {
    const state = createTowerState({ floor: 9 });
    const result = simulateOfflineProgress({ state, secondsAway: 3600 * 8 });
    expect(result.finalFloor).toBe(9);
    expect(result.floorsAdvanced).toBe(0);
  });

  it('avança andares normais', () => {
    const state = createTowerState({ floor: 1 });
    const result = simulateOfflineProgress({ state, secondsAway: 3600 });
    expect(result.finalFloor).toBeGreaterThan(1);
    expect(result.floorsAdvanced).toBeGreaterThan(0);
  });

  it('respeita o cap de 8 horas', () => {
    const state = createTowerState({ floor: 1 });
    const result = simulateOfflineProgress({ state, secondsAway: 3600 * 72 });
    expect(result.capped).toBe(true);
    expect(result.creditedSeconds).toBe(8 * 3600);
  });

  it('nunca avança mais do que o limite configurado', () => {
    const state = createTowerState({ floor: 2 });
    const result = simulateOfflineProgress({ state, secondsAway: 3600 * 8 });
    expect(result.floorsAdvanced).toBeLessThanOrEqual(3);
  });

  it('tempo negativo não avança', () => {
    const state = createTowerState({ floor: 5 });
    const result = simulateOfflineProgress({ state, secondsAway: -100 });
    expect(result.floorsAdvanced).toBe(0);
    expect(result.finalFloor).toBe(5);
  });
});

describe('HUD e seeds', () => {
  it('towerHud resume o estado', () => {
    const state = createTowerState({ floor: 12 });
    const hud = towerHud({ ...state, wave: 5, phase: 'fighting' });
    expect(hud.floor).toBe(12);
    expect(hud.totalWaves).toBe(9);
    expect(hud.progressPct).toBe(56);
    expect(hud.biome).toBe('biome.cavern');
    expect(hud.phaseLabel).toBe('Combate');
  });

  it('andar de chefe mostra 10 waves no HUD', () => {
    const hud = towerHud(createTowerState({ floor: 10 }));
    expect(hud.totalWaves).toBe(10);
    expect(hud.isBossFloor).toBe(true);
  });

  it('waveSeed é estável e único por wave', () => {
    expect(waveSeed(1, 3, 2)).toBe(waveSeed(1, 3, 2));
    expect(waveSeed(1, 3, 2)).not.toBe(waveSeed(1, 3, 3));
  });
});

describe('transições inválidas', () => {
  it('tick acumula tempo sem mudar de fase', () => {
    const state = createTowerState({});
    const next = advanceTower(state, { type: 'tick', dt: 1.5 }).state;
    expect(next.floorElapsedSec).toBe(1.5);
    expect(next.phase).toBe(state.phase);
  });

  it('wave_clear na última wave de andar normal reinicia o contador de tempo', () => {
    let state = advanceTower(createTowerState({}), { type: 'start' }).state;
    state = advanceTower(state, { type: 'tick', dt: 30 }).state;
    for (let wave = 1; wave <= 9; wave += 1) {
      state = advanceTower(state, { type: 'wave_clear' }).state;
    }
    expect(state.floorElapsedSec).toBe(0);
  });
});
