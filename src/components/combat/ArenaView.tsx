'use client';

/**
 * ArenaView — o HUD de combate ligado ao motor real.
 *
 * Substitui o "espelho" da demo: todos os números vêm de
 * `CombatState.combatants` (HP/MP/shield resolvidos por `stats.ts` a partir
 * de raça + atributos + equipamento) e de `CombatState.metrics`.
 *
 * Camadas visuais de transição:
 *   · wave flash (varredura) ao entrar em cada wave;
 *   · faixa de "ANDAR X" ao concluir um andar;
 *   · pulso vermelho durante o telegraph do chefe.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FloatingCombatText, FLOATING_TEXT_KEYFRAMES } from '@/components/combat/FloatingCombatText';
import { PaperdollAvatar } from '@/components/paperdoll/PaperdollAvatar';
import { useFloatingText } from '@/hooks/useFloatingText';
import { resolvePaperdoll } from '@/lib/game/paperdoll';
import { RACE_BY_ID } from '@/data/races';
import { ITEM_BY_ID } from '@/data/items';
import type { CombatEvent, CombatState, EnemyCombatant, PlayerCombatant, Uuid } from '@/types/game';
import { emptyEquipment } from '@/lib/game/actors';

export interface ArenaViewProps {
  readonly state: CombatState;
  readonly floorName: string;
  readonly biome: string;
  readonly wave: number;
  readonly totalWaves: number;
  readonly isBossFloor: boolean;
  readonly reducedMotion?: boolean;
  readonly onDrainEvents: () => readonly CombatEvent[];
}

export function ArenaView({
  state,
  floorName,
  biome,
  wave,
  totalWaves,
  isBossFloor,
  reducedMotion = false,
  onDrainEvents,
}: ArenaViewProps) {
  const { floats, push } = useFloatingText({ disabled: reducedMotion });
  const [positions, setPositions] = useState<Record<Uuid, { x: number; y: number }>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [transition, setTransition] = useState<{ kind: 'wave' | 'floor'; label: string; at: number } | null>(null);
  const previousWaveRef = useRef<number>(wave);

  // 1. Drena eventos do motor → floats
  useEffect(() => {
    const events = onDrainEvents();
    if (events.length > 0) push(events);
  }, [state.elapsedSec, onDrainEvents, push]);

  // 2. Transições: wave nova ou andar novo
  useEffect(() => {
    if (wave !== previousWaveRef.current) {
      previousWaveRef.current = wave;
      setTransition({ kind: 'wave', label: wave === totalWaves && isBossFloor ? 'CHEFE' : `WAVE ${wave}`, at: Date.now() });
    }
  }, [wave, totalWaves, isBossFloor]);

  useEffect(() => {
    setTransition({ kind: 'floor', label: `${floorName.toUpperCase()} · ${biome}`, at: Date.now() });
  }, [floorName, biome]);

  // 3. Mede a posição de cada combatente para ancorar os floats
  const measure = useCallback((): void => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const next: Record<Uuid, { x: number; y: number }> = {};

    for (const node of container.querySelectorAll<HTMLElement>('[data-actor-id]')) {
      const id = node.dataset.actorId;
      if (!id) continue;
      const rect = node.getBoundingClientRect();
      next[id] = {
        x: rect.left - box.left + rect.width / 2,
        y: rect.top - box.top + rect.height * 0.35,
      };
    }
    setPositions(next);
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, state.combatants.length]);

  const heroes = useMemo(
    () => state.combatants.filter((actor): actor is PlayerCombatant => actor.team === 'squad'),
    [state.combatants],
  );
  const enemies = useMemo(
    () => state.combatants.filter((actor): actor is EnemyCombatant => actor.team === 'enemy'),
    [state.combatants],
  );
  const boss = enemies.find((enemy) => enemy.tier === 'boss');

  const lanes = useMemo(() => {
    const byLane: Record<'front' | 'mid' | 'back', PlayerCombatant[]> = { front: [], mid: [], back: [] };
    for (const hero of heroes) byLane[hero.position].push(hero);
    return byLane;
  }, [heroes]);

  const transitionVisible = transition !== null && Date.now() - transition.at < 1400;

  return (
    <>
      <style>{FLOATING_TEXT_KEYFRAMES}</style>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          padding: 14,
          minHeight: 300,
          background: `linear-gradient(180deg, rgba(7,7,12,.1), rgba(7,7,12,.9)), radial-gradient(circle at 30% 25%, #1e3a5f55, transparent 60%)`,
          animation: boss && !reducedMotion ? 'aetheria-boss-pulse 2.2s ease-in-out infinite' : undefined,
        }}
      >
        {/* Faixa de transição */}
        {transition && transitionVisible && !reducedMotion && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
              zIndex: 30,
              animation: 'aetheria-wave-flash 1.4s ease-out forwards',
              background: 'linear-gradient(90deg, transparent, rgba(56,189,248,.14), transparent)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--mono, monospace)',
                fontSize: transition.kind === 'floor' ? 26 : 20,
                letterSpacing: 4,
                color: transition.kind === 'floor' ? '#fbbf24' : '#7dd3fc',
                textShadow: '0 0 18px currentColor',
                animation: 'aetheria-floor-rise 1.4s ease-out forwards',
              }}
            >
              {transition.label}
            </span>
          </div>
        )}

        {(['front', 'mid', 'back'] as const).map((lane) => (
          <div key={lane}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: '#64748b',
                marginBottom: 6,
                textAlign: 'center',
              }}
            >
              {lane === 'front' ? '⚔️ Front' : lane === 'mid' ? '🛡️ Mid' : '✨ Back'}
            </div>
            {lane === 'front' && enemies.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {enemies.map((enemy) => (
                  <EnemyRow key={enemy.id} enemy={enemy} isBoss={enemy.tier === 'boss'} />
                ))}
              </div>
            )}
            {lanes[lane].map((hero) => (
              <HeroRow key={hero.id} hero={hero} />
            ))}
          </div>
        ))}

        <FloatingCombatText floats={floats} positions={positions} reducedMotion={reducedMotion} />
      </div>
    </>
  );
}

/* ==========================================================================
 * LINHAS
 * ========================================================================== */

function HeroRow({ hero }: { readonly hero: PlayerCombatant }) {
  const paperdoll = useMemo(() => {
    const race = RACE_BY_ID.get(hero.appearance.raceId);
    if (!race) return null;
    return resolvePaperdoll({
      race,
      appearance: hero.appearance,
      equipment: emptyEquipment(),
      catalogue: ITEM_BY_ID,
      animation: hero.hp > 0 ? 'idle' : 'death',
    }).state;
  }, [hero.appearance, hero.hp]);

  const hpPct = Math.max(0, (hero.hp / hero.maxHp) * 100);
  const mpPct = hero.maxMp > 0 ? Math.max(0, (hero.mp / hero.maxMp) * 100) : 0;

  return (
    <div
      data-actor-id={hero.id}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: 7,
        borderRadius: 10,
        marginBottom: 7,
        background: 'rgba(15,23,42,.72)',
        border: '1px solid #1f2a44',
        opacity: hero.hp > 0 ? 1 : 0.32,
        filter: hero.hp > 0 ? undefined : 'grayscale(1)',
        transition: 'opacity 200ms',
      }}
    >
      {paperdoll ? (
        <PaperdollAvatar state={paperdoll} size="sm" showFrame showGlow={false} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 9, background: '#111827' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hero.name}</span>
          <span style={{ fontFamily: 'var(--mono)', color: '#64748b', fontSize: 10 }}>Lv.{hero.level}</span>
        </div>
        <Bar value={hpPct} color="linear-gradient(90deg,#16a34a,#4ade80)" />
        <Bar value={mpPct} color="linear-gradient(90deg,#1d4ed8,#60a5fa)" />
        {hero.shield > 0 && <Bar value={Math.min(100, (hero.shield / hero.maxHp) * 100)} color="linear-gradient(90deg,#0369a1,#7dd3fc)" />}
        {hero.effects.length > 0 && (
          <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
            {hero.effects.slice(0, 3).map((effect) => (
              <span
                key={effect.id}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 8.5,
                  padding: '1px 4px',
                  borderRadius: 4,
                  background: '#111827',
                  border: '1px solid #1e293b',
                  color: effect.kind === 'dot' ? '#f87171' : '#4ade80',
                }}
              >
                {effect.kind.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EnemyRow({ enemy, isBoss }: { readonly enemy: EnemyCombatant; readonly isBoss: boolean }) {
  const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
  return (
    <div
      data-actor-id={enemy.id}
      style={{
        position: 'relative',
        padding: 7,
        borderRadius: 10,
        marginBottom: 6,
        background: isBoss ? 'rgba(60,10,16,.75)' : 'rgba(40,14,22,.6)',
        border: `1px solid ${isBoss ? '#7f1d1d' : '#3f1d2b'}`,
        opacity: enemy.hp > 0 ? 1 : 0.3,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span>{isBoss ? '💀' : '👹'} {enemy.name}</span>
        <span style={{ fontFamily: 'var(--mono)', color: '#64748b', fontSize: 10 }}>Lv.{enemy.level}</span>
      </div>
      <Bar value={hpPct} color={isBoss ? 'linear-gradient(90deg,#7f1d1d,#ef4444,#fca5a5)' : 'linear-gradient(90deg,#b91c1c,#ef4444)'} height={isBoss ? 9 : 5} />
    </div>
  );
}

function Bar({ value, color, height = 5 }: { readonly value: number; readonly color: string; readonly height?: number }) {
  return (
    <div style={{ height, borderRadius: 99, background: '#1e293b', overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, transition: 'width 140ms linear' }} />
    </div>
  );
}
