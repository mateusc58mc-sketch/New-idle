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
import { highestRarity, resolvePaperdoll } from '@/lib/game/paperdoll';
import { BASE_CLASSES } from '@/data/classes';
import { RACE_BY_ID } from '@/data/races';
import { ITEM_BY_ID } from '@/data/items';
import { RARITY_COLOR, RARITY_GLOW, RARITY_LABEL } from '@/data/paperdoll-layers';
import type {
  CombatEvent,
  CombatState,
  EnemyCombatant,
  EquipmentLoadout,
  PlayerCombatant,
  Rarity,
  Uuid,
} from '@/types/game';
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
  /** Loadout por personagem — alimenta as camadas do Paperdoll. */
  readonly equipmentByCharacterId?: Readonly<Record<Uuid, EquipmentLoadout>>;
}

const NO_LOADOUTS: Readonly<Record<Uuid, EquipmentLoadout>> = {};
const EMPTY_LOADOUT: EquipmentLoadout = emptyEquipment();

export function ArenaView({
  state,
  floorName,
  biome,
  wave,
  totalWaves,
  isBossFloor,
  reducedMotion = false,
  onDrainEvents,
  equipmentByCharacterId = NO_LOADOUTS,
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
              <HeroRow key={hero.id} hero={hero} equipment={equipmentByCharacterId[hero.id] ?? EMPTY_LOADOUT} />
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

function HeroRow({
  hero,
  equipment,
}: {
  readonly hero: PlayerCombatant;
  readonly equipment: EquipmentLoadout;
}) {
  const paperdoll = useMemo(() => {
    const race = RACE_BY_ID.get(hero.appearance.raceId);
    if (!race) return null;
    return resolvePaperdoll({
      race,
      appearance: hero.appearance,
      equipment,
      catalogue: ITEM_BY_ID,
      animation: hero.hp > 0 ? 'idle' : 'death',
    });
  }, [hero.appearance, hero.hp, equipment]);

  const classDefinition = useMemo(
    () => BASE_CLASSES.find((candidate) => candidate.id === hero.baseClass) ?? null,
    [hero.baseClass],
  );

  const topRarity: Rarity | null = paperdoll
    ? highestRarity(paperdoll.slots.map((slot) => slot.rarity))
    : null;
  const rarityColor = topRarity ? RARITY_COLOR[topRarity] : null;
  const rarityGlow = topRarity ? RARITY_GLOW[topRarity] : null;
  const alive = hero.hp > 0;

  const hpPct = percent(hero.hp, hero.maxHp);
  const mpPct = hero.maxMp > 0 ? percent(hero.mp, hero.maxMp) : 0;
  const shieldPct = percent(hero.shield, hero.maxHp);

  // "Turno": progresso do auto-ataque. `attackCooldownSec` conta para baixo.
  const attackSpeed = Math.max(0.1, hero.stats.attackSpeed);
  const turnPct = percent(1 / attackSpeed - hero.attackCooldownSec, 1 / attackSpeed);

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
        background: alive ? 'rgba(15,23,42,.72)' : 'rgba(15,23,42,.45)',
        border: `1px solid ${rarityColor ?? '#1f2a44'}`,
        boxShadow: rarityGlow ? `0 0 14px -2px ${rarityGlow}` : 'none',
        opacity: alive ? 1 : 0.32,
        filter: alive ? undefined : 'grayscale(1)',
        transition: 'opacity 200ms, box-shadow 200ms, border-color 200ms',
      }}
      title={topRarity ? `Conjunto ${RARITY_LABEL[topRarity]}` : undefined}
    >
      {paperdoll ? (
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <PaperdollAvatar
            state={paperdoll.state}
            size="sm"
            showFrame
            showGlow={topRarity !== null}
            label={`${hero.name}${classDefinition ? ` — ${classDefinition.name}` : ''}`}
          />
          {topRarity ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 8,
                height: 8,
                borderRadius: 2,
                background: rarityColor ?? undefined,
                boxShadow: `0 0 6px ${rarityGlow ?? 'transparent'}`,
                transform: 'rotate(45deg)',
              }}
            />
          ) : null}
        </div>
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 9, background: '#111827' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, fontSize: 11.5 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
            {hero.name}
          </span>
          <span style={{ fontFamily: 'var(--mono)', color: '#64748b', fontSize: 10 }}>Lv.{hero.level}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 9,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: rarityColor ?? '#64748b',
            margin: '1px 0 3px',
          }}
        >
          {classDefinition ? `${classDefinition.icon} ${classDefinition.name}` : hero.baseClass}
          {topRarity ? ` · ${RARITY_LABEL[topRarity]}` : ''}
        </div>
        <Bar value={hpPct} color="linear-gradient(90deg,#15803d,#22c55e,#86efac)" glow="#22c55e" title={`HP ${Math.max(0, Math.round(hero.hp))}/${Math.round(hero.maxHp)}`} />
        {hero.shield > 0 ? (
          <Bar value={shieldPct} color="linear-gradient(90deg,#0369a1,#38bdf8,#bae6fd)" glow="#38bdf8" height={4} />
        ) : null}
        <Bar value={mpPct} color="linear-gradient(90deg,#1d4ed8,#3b82f6,#93c5fd)" height={4} />
        <TurnGauge value={turnPct} alive={alive} />
        {hero.effects.length > 0 || hero.skills.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
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
            <span style={{ display: 'flex', gap: 2, marginLeft: 'auto' }} aria-label="Skills">
              {hero.skills.slice(0, 4).map((skill) => {
                const ready = (hero.skillCooldowns[skill.skillId] ?? 0) <= 0.001;
                return (
                  <span
                    key={skill.skillId}
                    title={ready ? 'Skill pronta' : 'Skill em recarga'}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: ready ? '#a78bfa' : '#334155',
                      boxShadow: ready ? '0 0 5px #a78bfa' : 'none',
                      transition: 'background 200ms',
                    }}
                  />
                );
              })}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Gauge de "turno" — auto-ataque enchendo da esquerda para a direita. */
function TurnGauge({ value, alive }: { readonly value: number; readonly alive: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: 0.6, color: alive ? '#b45309' : '#475569' }}>
        ATQ
      </span>
      <div style={{ flex: 1, height: 2, borderRadius: 99, background: '#111827', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${value}%`,
            borderRadius: 99,
            background: alive ? 'linear-gradient(90deg,#b45309,#fbbf24,#fde68a)' : '#334155',
            transition: 'width 90ms linear',
          }}
        />
      </div>
    </div>
  );
}

function EnemyRow({ enemy, isBoss }: { readonly enemy: EnemyCombatant; readonly isBoss: boolean }) {
  const hpPct = percent(enemy.hp, enemy.maxHp);
  const attackSpeed = Math.max(0.1, enemy.stats.attackSpeed);
  const turnPct = percent(1 / attackSpeed - enemy.attackCooldownSec, 1 / attackSpeed);
  const alive = enemy.hp > 0;

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
        boxShadow: isBoss ? '0 0 18px -4px rgba(239,68,68,.45)' : 'none',
        opacity: alive ? 1 : 0.3,
        filter: alive ? undefined : 'grayscale(1)',
        transition: 'opacity 200ms',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, fontSize: 11 }}>
        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isBoss ? '💀' : '👹'} {enemy.name}
        </span>
        <span style={{ fontFamily: 'var(--mono)', color: '#64748b', fontSize: 10 }}>Lv.{enemy.level}</span>
      </div>
      <Bar
        value={hpPct}
        color={isBoss ? 'linear-gradient(90deg,#7f1d1d,#ef4444,#fca5a5)' : 'linear-gradient(90deg,#991b1b,#ef4444,#fca5a5)'}
        glow={isBoss ? '#ef4444' : undefined}
        height={isBoss ? 9 : 5}
        title={`HP ${Math.max(0, Math.round(enemy.hp))}/${Math.round(enemy.maxHp)}`}
      />
      {isBoss ? <TurnGauge value={turnPct} alive={alive} /> : null}
    </div>
  );
}

function percent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function Bar({
  value,
  color,
  height = 5,
  glow,
  title,
}: {
  readonly value: number;
  readonly color: string;
  readonly height?: number;
  readonly glow?: string | undefined;
  readonly title?: string | undefined;
}) {
  return (
    <div
      title={title}
      style={{
        height,
        borderRadius: 99,
        background: '#111827',
        overflow: 'hidden',
        marginTop: 3,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,.65)',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, value))}%`,
          borderRadius: 99,
          background: color,
          boxShadow: glow ? `0 0 7px ${glow}` : undefined,
          transition: 'width 150ms linear',
        }}
      />
    </div>
  );
}
