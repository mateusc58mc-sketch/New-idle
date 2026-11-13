'use client';

/**
 * ArenaView — palco de batalha imersivo (estilo Ragnarök / idle mobile).
 *
 * Nada de painéis: o ecrã inteiro é o cenário. Heróis em formação tática à
 * esquerda, monstros avançando à direita, HP flutuante sobre cada unidade e
 * feedback físico — lunge no atacante, flash no alvo, números de dano.
 *
 * Fontes de verdade:
 *  · números → `CombatState.combatants`/`metrics` (motor determinístico);
 *  · cenário → paleta oficial do bioma (`BIOME_BY_ID`), com `accent` do bioma
 *    nas partículas e no horizonte;
 *  · sprites → Paperdoll híbrido (PNG raster com fallback vectorial).
 *
 * Animações: transform/filter via Web Animations API — não remonta camadas e
 * convive com o bob de idle (CSS) porque vivem em wrappers separados.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { FloatingCombatText, FLOATING_TEXT_KEYFRAMES } from '@/components/combat/FloatingCombatText';
import { PaperdollAvatar } from '@/components/paperdoll/PaperdollAvatar';
import { useFloatingText } from '@/hooks/useFloatingText';
import { highestRarity, resolvePaperdoll } from '@/lib/game/paperdoll';
import { frontmostLine } from '@/lib/game/target';
import { BASE_CLASSES } from '@/data/classes';
import { RACE_BY_ID } from '@/data/races';
import { ITEM_BY_ID } from '@/data/items';
import { RARITY_COLOR, RARITY_GLOW, RARITY_LABEL } from '@/data/paperdoll-layers';
import { BIOME_BY_ID, MONSTER_BY_ID } from '@/data/tower';
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

/* ==========================================================================
 * FORMAÇÃO — slots percentuais do palco (x = eixo horizontal, y = linha do chão)
 *
 * Heróis encostam à esquerda, monstros à direita; a linha `front` fica junto
 * ao centro (onde o combate acontece), `mid` e `back` recuam em diagonal.
 * Membros extra da mesma lane afastam-se ligeiramente para trás/baixo.
 * ========================================================================== */

const HERO_LANE_BASE: Readonly<Record<'front' | 'mid' | 'back', Slot>> = {
  front: { x: 41, y: 76 },
  mid: { x: 28, y: 60 },
  back: { x: 15, y: 44 },
};
const ENEMY_LANE_BASE: Readonly<Record<'front' | 'mid' | 'back', Slot>> = {
  front: { x: 59, y: 76 },
  mid: { x: 72, y: 60 },
  back: { x: 85, y: 44 },
};
const MEMBER_STAGGER = { x: 4, y: 15 } as const;

interface Slot {
  readonly x: number;
  readonly y: number;
}

/** Glifo por `Monster.icon` (data/tower.ts) — fallback por tier. */
const MONSTER_GLYPH: Readonly<Record<string, string>> = {
  slime: '🟢',
  boar: '🐗',
  rat: '🐀',
  sprite: '🧚',
  wolf: '🐺',
  treant: '🌳',
  spider: '🕷️',
  salamander: '🦎',
  golem: '🗿',
  magma_bat: '🦇',
  basalt_knight: '🛡️',
  frost: '❄️',
  troll: '🧌',
  lynx: '🐆',
  revenant: '👻',
  specter: '👻',
  guardian: '🗿',
  acolyte: '📿',
  serpent: '🐍',
  hound: '🐕',
  wraith: '👻',
  maw: '🦈',
  cultist: '🕯️',
  rock_rex: '🦖',
  trex: '🦖',
  lich: '💀',
  wyrm: '🐉',
  seraph: '😇',
  sovereign: '👑',
};

const ELEMENT_GLOW: Readonly<Record<string, string>> = {
  neutral: 'rgba(226,232,240,.4)',
  earth: 'rgba(132,204,22,.45)',
  fire: 'rgba(249,115,22,.5)',
  water: 'rgba(56,189,248,.5)',
  wind: 'rgba(125,211,252,.45)',
  holy: 'rgba(253,224,71,.5)',
  dark: 'rgba(167,139,250,.5)',
  poison: 'rgba(74,222,128,.45)',
};

/** Keyframes do palco — injectados uma vez junto dos floats. */
export const BATTLEFIELD_KEYFRAMES = `
@keyframes aetheria-idle-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}
@keyframes aetheria-drift {
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  12%  { opacity: .8; }
  88%  { opacity: .6; }
  100% { transform: translateY(-34vh) translateX(4vw); opacity: 0; }
}
`;

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
  const [lunges, setLunges] = useState<Readonly<Record<Uuid, number>>>({});
  const [hits, setHits] = useState<Readonly<Record<Uuid, number>>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [transition, setTransition] = useState<{ kind: 'wave' | 'floor'; label: string; at: number } | null>(null);
  const previousWaveRef = useRef<number>(wave);

  // 1. Drena eventos do motor → floats + gatilhos de lunge/flash
  useEffect(() => {
    const events = onDrainEvents();
    if (events.length === 0) return;
    push(events);

    const now = Date.now();
    setLunges((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const event of events) {
        if (event.type === 'damage' || event.type === 'skill_cast') {
          next[event.sourceId] = now;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
    setHits((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const event of events) {
        if ((event.type === 'damage' && !event.isMiss) || event.type === 'shield') {
          next[event.targetId] = now;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [state.elapsedSec, onDrainEvents, push]);

  // 2. Transições: wave nova ou andar novo
  useEffect(() => {
    if (wave !== previousWaveRef.current) {
      previousWaveRef.current = wave;
      setTransition({ kind: 'wave', label: wave === totalWaves && isBossFloor ? 'CHEFE' : `WAVE ${wave}`, at: Date.now() });
    }
  }, [wave, totalWaves, isBossFloor]);

  useEffect(() => {
    setTransition({ kind: 'floor', label: `${floorName.toUpperCase()} · ${biomeLabel(biome)}`, at: Date.now() });
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

  const heroes = useMemo(
    () => state.combatants.filter((actor): actor is PlayerCombatant => actor.team === 'squad'),
    [state.combatants],
  );
  const enemies = useMemo(
    () => state.combatants.filter((actor): actor is EnemyCombatant => actor.team === 'enemy'),
    [state.combatants],
  );
  const boss = enemies.find((enemy) => enemy.tier === 'boss');
  const enemyIds = useMemo(() => enemies.map((enemy) => enemy.id).join(','), [enemies]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, state.combatants.length, enemyIds]);

  // Linha que os inimigos estão a atacar: a mais à frente com heróis vivos.
  const focusedLine = useMemo(() => {
    if (!enemies.some((enemy) => enemy.hp > 0)) return null;
    return frontmostLine(heroes.filter((hero) => hero.hp > 0));
  }, [heroes, enemies]);

  /** Heróis e monstros em slots absolutos (formação tática no palco). */
  const heroUnits = useMemo(() => place(heroes, HERO_LANE_BASE), [heroes]);
  const enemyUnits = useMemo(() => place(enemies, ENEMY_LANE_BASE), [enemies]);

  const palette = BIOME_BY_ID.get(biome)?.palette ?? { sky: '#1e3a5f', ground: '#14532d', accent: '#4ade80' };
  const transitionVisible = transition !== null && Date.now() - transition.at < 1400;

  return (
    <>
      <style>{FLOATING_TEXT_KEYFRAMES}</style>
      <style>{BATTLEFIELD_KEYFRAMES}</style>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: `linear-gradient(180deg, ${palette.sky} 0%, #020617 100%)`,
          animation: boss && !reducedMotion ? 'aetheria-boss-pulse 2.2s ease-in-out infinite' : undefined,
        }}
      >
        <BattlefieldBackdrop palette={palette} reducedMotion={reducedMotion} />

        {/* Faixa de transição */}
        {transition && transitionVisible && !reducedMotion && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
              zIndex: 90,
              animation: 'aetheria-wave-flash 1.4s ease-out forwards',
              background: 'linear-gradient(90deg, transparent, rgba(56,189,248,.14), transparent)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--mono, monospace)',
                fontSize: transition.kind === 'floor' ? 30 : 22,
                letterSpacing: 6,
                color: transition.kind === 'floor' ? '#fbbf24' : '#7dd3fc',
                textShadow: '0 0 24px currentColor, 0 2px 8px #000',
                animation: 'aetheria-floor-rise 1.4s ease-out forwards',
              }}
            >
              {transition.label}
            </span>
          </div>
        )}

        {/* Monstros — lado direito, avançando para o centro */}
        {enemyUnits.map((unit) => (
          <FieldEnemy
            key={unit.actor.id}
            enemy={unit.actor}
            slot={unit.slot}
            lungeStamp={lunges[unit.actor.id]}
            hitStamp={hits[unit.actor.id]}
            reducedMotion={reducedMotion}
          />
        ))}

        {/* Heróis — lado esquerdo, em formação */}
        {heroUnits.map((unit) => (
          <FieldHero
            key={unit.actor.id}
            hero={unit.actor}
            slot={unit.slot}
            equipment={equipmentByCharacterId[unit.actor.characterId] ?? EMPTY_LOADOUT}
            focused={focusedLine === unit.actor.position}
            lungeStamp={lunges[unit.actor.id]}
            hitStamp={hits[unit.actor.id]}
            reducedMotion={reducedMotion}
          />
        ))}

        <div style={{ position: 'absolute', inset: 0, zIndex: 85, pointerEvents: 'none' }}>
          <FloatingCombatText floats={floats} positions={positions} reducedMotion={reducedMotion} />
        </div>
      </div>
    </>
  );
}

/* ==========================================================================
 * CENÁRIO — céu do bioma, horizonte, chão e partículas
 * ========================================================================== */

function BattlefieldBackdrop({
  palette,
  reducedMotion,
}: {
  readonly palette: { readonly sky: string; readonly ground: string; readonly accent: string };
  readonly reducedMotion: boolean;
}) {
  const particles = useMemo(() => {
    // Determinístico: zero Math.random no render (hidratação estável).
    return Array.from({ length: 18 }, (_, i) => ({
      left: (i * 53) % 100,
      top: 8 + ((i * 29) % 55),
      size: 2 + (i % 3),
      duration: 7 + (i % 5) * 1.6,
      delay: -(i * 0.9),
    }));
  }, []);

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {/* Lua / fonte de luz do bioma */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          left: '72%',
          width: 190,
          height: 190,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${withAlpha(palette.accent, 0.22)} 0%, transparent 70%)`,
          filter: 'blur(2px)',
        }}
      />
      {/* Silhuetas distantes (duas camadas de "montanhas") */}
      <div
        style={{
          position: 'absolute',
          bottom: '24%',
          left: '-6%',
          right: '-6%',
          height: '30%',
          background: `radial-gradient(60% 100% at 18% 100%, ${withAlpha(palette.ground, 0.9)} 0%, transparent 70%),
            radial-gradient(52% 100% at 62% 100%, ${withAlpha(palette.ground, 0.75)} 0%, transparent 68%),
            radial-gradient(40% 100% at 92% 100%, ${withAlpha(palette.sky, 0.9)} 0%, transparent 66%)`,
        }}
      />
      {/* Chão — faixa de combate com luz do bioma no horizonte */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: `linear-gradient(180deg, transparent 0%, ${withAlpha(palette.ground, 0.5)} 22%, ${withAlpha('#020617', 0.92)} 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '30%',
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${withAlpha(palette.accent, 0.35)}, transparent)`,
        }}
      />
      {/* Partículas ambientes (poeira/brasas do bioma) */}
      {particles.map((particle, index) => (
        <span
          key={index}
          style={{
            position: 'absolute',
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: particle.size,
            height: particle.size,
            borderRadius: 99,
            background: withAlpha(palette.accent, 0.8),
            boxShadow: `0 0 6px ${withAlpha(palette.accent, 0.7)}`,
            animation: reducedMotion
              ? undefined
              : `aetheria-drift ${particle.duration}s linear ${particle.delay}s infinite`,
          }}
        />
      ))}
      {/* Vinheta */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 140px rgba(2,6,23,.85)',
        }}
      />
    </div>
  );
}

/* ==========================================================================
 * UNIDADES — herói e monstro no palco
 * ========================================================================== */

interface FieldUnitProps {
  readonly slot: Slot;
  readonly lungeStamp?: number | undefined;
  readonly hitStamp?: number | undefined;
  readonly reducedMotion: boolean;
}

function FieldHero({
  hero,
  slot,
  equipment,
  focused,
  lungeStamp,
  hitStamp,
  reducedMotion,
}: FieldUnitProps & {
  readonly hero: PlayerCombatant;
  readonly equipment: EquipmentLoadout;
  readonly focused: boolean;
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

  return (
    <div
      data-actor-id={hero.id}
      title={topRarity ? `${hero.name} — conjunto ${RARITY_LABEL[topRarity]}` : hero.name}
      style={{
        position: 'absolute',
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: 'translate(-50%, -100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: Math.round(slot.y),
      }}
    >
      <Nameplate
        name={hero.name}
        level={hero.level}
        tag={classDefinition ? `${classDefinition.icon} ${classDefinition.name}` : hero.baseClass}
        tagColor={rarityColor ?? '#94a3b8'}
        hp={percent(hero.hp, hero.maxHp)}
        hpTitle={`HP ${Math.max(0, Math.round(hero.hp))}/${Math.round(hero.maxHp)}`}
        shield={percent(hero.shield, hero.maxHp)}
        mp={hero.maxMp > 0 ? percent(hero.mp, hero.maxMp) : 0}
        turn={turnPercent(hero.attackCooldownSec, hero.stats.attackSpeed)}
        alive={alive}
        accent={rarityColor ?? undefined}
        glow={rarityGlow ?? undefined}
        focused={focused}
        effects={hero.effects.slice(0, 3).map((effect) => effect.kind)}
        skillReady={hero.skills.slice(0, 4).map((skill) => (hero.skillCooldowns[skill.skillId] ?? 0) <= 0.001)}
        reducedMotion={reducedMotion}
      />
      <div
        style={{
          animation: alive && !reducedMotion ? `aetheria-idle-bob 3.4s ease-in-out ${-(slot.x % 2.6)}s infinite` : undefined,
        }}
      >
        <LungeLayer stamp={lungeStamp} direction={1} distance={30}>
          <FlashLayer stamp={hitStamp}>
            <div
              style={{
                transform: alive ? undefined : 'rotate(14deg) translateY(10px)',
                opacity: alive ? 1 : 0.35,
                filter: alive ? undefined : 'grayscale(1)',
                transition: 'transform 480ms ease, opacity 480ms ease, filter 480ms ease',
              }}
            >
              {paperdoll ? (
                <PaperdollAvatar
                  state={paperdoll.state}
                  size="lg"
                  showFrame={false}
                  showGlow
                  baseClass={hero.baseClass}
                  rarity={topRarity}
                  fallbackGlyph={classDefinition?.icon}
                  label={hero.name}
                />
              ) : (
                <div style={{ width: 160, height: 160, borderRadius: 14, background: '#11182755' }} />
              )}
            </div>
          </FlashLayer>
        </LungeLayer>
        <GroundShadow width={96} />
      </div>
    </div>
  );
}

function FieldEnemy({
  enemy,
  slot,
  lungeStamp,
  hitStamp,
  reducedMotion,
}: FieldUnitProps & { readonly enemy: EnemyCombatant }) {
  const monster = MONSTER_BY_ID.get(enemy.monsterId);
  const isBoss = enemy.tier === 'boss';
  const glyphSize = isBoss ? 150 : enemy.tier === 'elite' ? 108 : 86;
  // O `icon` do seed não existe no Monster construído — está no basename de
  // `sprite.src` (`/assets/monsters/[icon].png`). Deriva daí para o glifo.
  const spriteIcon = monster?.sprite.src.replace(/\\/g, '/').split('/').pop()?.replace(/\.png$/, '') ?? '';
  const glyph = MONSTER_GLYPH[spriteIcon] ?? (isBoss ? '💀' : '👹');
  const glow = ELEMENT_GLOW[monster?.element ?? ''] ?? ELEMENT_GLOW.neutral;
  const alive = enemy.hp > 0;

  return (
    <div
      data-actor-id={enemy.id}
      title={`${enemy.name} · Lv.${enemy.level}`}
      style={{
        position: 'absolute',
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: 'translate(-50%, -100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: Math.round(slot.y),
      }}
    >
      <Nameplate
        name={`${isBoss ? '👑 ' : ''}${enemy.name}`}
        level={enemy.level}
        tag={isBoss ? 'CHEFE' : monster?.race ?? 'monstro'}
        tagColor={isBoss ? '#fca5a5' : '#fda4af'}
        hp={percent(enemy.hp, enemy.maxHp)}
        hpTitle={`HP ${Math.max(0, Math.round(enemy.hp))}/${Math.round(enemy.maxHp)}`}
        shield={0}
        mp={0}
        turn={isBoss ? turnPercent(enemy.attackCooldownSec, enemy.stats.attackSpeed) : 0}
        alive={alive}
        accent="#ef4444"
        glow={isBoss ? 'rgba(239,68,68,.45)' : undefined}
        focused={false}
        effects={[]}
        skillReady={[]}
        enemy
        reducedMotion={reducedMotion}
      />
      <div
        style={{
          animation: alive && !reducedMotion ? `aetheria-idle-bob 2.8s ease-in-out ${-(slot.x % 2.2)}s infinite` : undefined,
        }}
      >
        <LungeLayer stamp={lungeStamp} direction={-1} distance={26}>
          <FlashLayer stamp={hitStamp}>
            <div
              style={{
                transform: alive ? undefined : 'rotate(-14deg) translateY(10px)',
                opacity: alive ? 1 : 0.3,
                filter: alive ? undefined : 'grayscale(1)',
                transition: 'transform 480ms ease, opacity 480ms ease, filter 480ms ease',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'block',
                  fontSize: glyphSize,
                  lineHeight: 1,
                  textShadow: `0 0 26px ${glow}, 0 6px 14px rgba(0,0,0,.65)`,
                }}
              >
                {glyph}
              </span>
            </div>
          </FlashLayer>
        </LungeLayer>
        <GroundShadow width={isBoss ? 130 : 80} />
      </div>
    </div>
  );
}

/** Placa flutuante sobre a unidade: nome, barras de HP/MP e efeitos. */
function Nameplate({
  name,
  level,
  tag,
  tagColor,
  hp,
  hpTitle,
  shield,
  mp,
  turn,
  alive,
  accent,
  glow,
  focused,
  effects,
  skillReady,
  enemy = false,
  reducedMotion,
}: {
  readonly name: string;
  readonly level: number;
  readonly tag: string;
  readonly tagColor: string;
  readonly hp: number;
  readonly hpTitle: string;
  readonly shield: number;
  readonly mp: number;
  readonly turn: number;
  readonly alive: boolean;
  readonly accent?: string | undefined;
  readonly glow?: string | undefined;
  readonly focused: boolean;
  readonly effects: readonly string[];
  readonly skillReady: readonly boolean[];
  readonly enemy?: boolean;
  readonly reducedMotion: boolean;
}) {
  return (
    <div
      style={{
        width: enemy ? 128 : 140,
        marginBottom: 6,
        padding: '4px 7px 5px',
        borderRadius: 8,
        background: 'rgba(2,6,23,.66)',
        border: `1px solid ${focused ? 'rgba(56,189,248,.55)' : (accent ?? 'rgba(148,163,184,.18)')}`,
        boxShadow: focused
          ? '0 0 14px -2px rgba(56,189,248,.6)'
          : glow
            ? `0 0 12px -3px ${glow}`
            : '0 2px 8px rgba(2,6,23,.5)',
        textAlign: 'center',
        transition: 'border-color 220ms ease, box-shadow 220ms ease',
        opacity: alive ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 5, fontSize: 11 }}>
        <span
          style={{
            fontWeight: 700,
            color: focused ? '#7dd3fc' : '#e2e8f0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 92,
          }}
        >
          {name}
        </span>
        <span style={{ fontFamily: 'var(--mono)', color: '#64748b', fontSize: 9.5 }}>Lv.{level}</span>
      </div>
      <div
        style={{
          fontSize: 8.5,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: tagColor,
          margin: '1px 0 3px',
          display: 'flex',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <span>{tag}</span>
        {focused ? (
          <span
            style={{
              color: '#06121f',
              background: '#38bdf8',
              borderRadius: 99,
              padding: '0 5px',
              fontWeight: 700,
              animation: reducedMotion ? undefined : 'aetheria-target-pulse 1.5s ease-in-out infinite',
            }}
          >
            ALVO
          </span>
        ) : null}
      </div>
      <Bar value={hp} color="linear-gradient(90deg,#15803d,#22c55e,#86efac)" glow="#22c55e" height={6} title={hpTitle} />
      {shield > 0 ? <Bar value={shield} color="linear-gradient(90deg,#0369a1,#38bdf8,#bae6fd)" glow="#38bdf8" height={3} /> : null}
      {mp > 0 ? <Bar value={mp} color="linear-gradient(90deg,#1d4ed8,#3b82f6,#93c5fd)" height={3} /> : null}
      {turn > 0 ? (
        <Bar value={turn} color="linear-gradient(90deg,#b45309,#fbbf24,#fde68a)" height={2} title="Auto-ataque" />
      ) : null}
      {effects.length > 0 || skillReady.length > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, marginTop: 3 }}>
          {effects.map((effect, index) => (
            <span
              key={`${effect}-${index}`}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 8,
                padding: '0 4px',
                borderRadius: 4,
                background: '#111827',
                border: '1px solid #1e293b',
                color: effect === 'dot' ? '#f87171' : '#4ade80',
              }}
            >
              {effect.toUpperCase()}
            </span>
          ))}
          {skillReady.map((ready, index) => (
            <span
              key={index}
              style={{
                width: 5,
                height: 5,
                borderRadius: 99,
                background: ready ? '#a78bfa' : '#334155',
                boxShadow: ready ? '0 0 5px #a78bfa' : 'none',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GroundShadow({ width }: { readonly width: number }) {
  return (
    <div
      aria-hidden
      style={{
        width,
        height: Math.round(width * 0.16),
        marginTop: -6,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,0,0,.5) 0%, transparent 68%)',
      }}
    />
  );
}

/* ==========================================================================
 * ANIMAÇÕES DE COMBATE — lunge e flash via Web Animations API
 * ========================================================================== */

function LungeLayer({
  stamp,
  direction,
  distance,
  children,
}: {
  readonly stamp?: number | undefined;
  readonly direction: 1 | -1;
  readonly distance: number;
  readonly children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!stamp || Date.now() - stamp > 500) return;
    ref.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: `translateX(${direction * distance}px) scale(1.04)`, offset: 0.45 },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'cubic-bezier(.3,.8,.4,1)' },
    );
  }, [stamp, direction, distance]);

  return (
    <div ref={ref}>
      {children}
    </div>
  );
}

function FlashLayer({ stamp, children }: { readonly stamp?: number | undefined; readonly children?: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!stamp || Date.now() - stamp > 500) return;
    ref.current?.animate(
      [
        { filter: 'brightness(1)' },
        { filter: 'brightness(2.1) saturate(1.6)', offset: 0.35 },
        { filter: 'brightness(1)' },
      ],
      { duration: 240, easing: 'ease-out' },
    );
  }, [stamp]);

  return (
    <div ref={ref}>
      {children}
    </div>
  );
}

/* ==========================================================================
 * UTILITÁRIOS
 * ========================================================================== */

/** Distribui os combatentes da lane nos slots da formação. */
function place<T extends { position: 'front' | 'mid' | 'back' }>(
  actors: readonly T[],
  base: Readonly<Record<'front' | 'mid' | 'back', Slot>>,
): readonly { readonly actor: T; readonly slot: Slot }[] {
  const counters: Record<'front' | 'mid' | 'back', number> = { front: 0, mid: 0, back: 0 };
  return actors.map((actor) => {
    const index = counters[actor.position]++;
    const origin = base[actor.position];
    return {
      actor,
      slot: {
        x: origin.x + index * MEMBER_STAGGER.x,
        y: origin.y + index * MEMBER_STAGGER.y,
      },
    };
  });
}

function biomeLabel(biome: string): string {
  return BIOME_BY_ID.get(biome)?.name ?? biome;
}

function withAlpha(color: string, alpha: number): string {
  // As paletas oficiais são hex #rrggbb; converte para rgba(). Já rgba passa.
  if (color.startsWith('rgb')) return color;
  const hex = color.replace('#', '');
  const value = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function percent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function turnPercent(cooldownRemaining: number, attackSpeed: number): number {
  const period = Math.max(0.1, attackSpeed);
  return percent(1 / period - cooldownRemaining, 1 / period);
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
        background: '#0f172a',
        overflow: 'hidden',
        marginTop: 2,
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
