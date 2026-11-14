'use client';

/**
 * HeroSkillBar — HUD inferior estilo idle mobile (Ulala / Ragnarök Mobile).
 *
 * Faixa translúcida com blur, um grupo por herói: chip de classe + slots
 * circulares das skills equipadas. Cada slot tem:
 *  · glifo da função da skill (dano, cura, escudo…);
 *  · anel de raridade (mesma paleta do Paperdoll);
 *  · cooldown CIRCULAR — varredura cónica (`conic-gradient`) que encolhe até
 *    esvaziar, com os segundos restantes ao centro;
 *  · flash de conjuração — WAAPI (mesma técnica de `LungeLayer`), disparado
 *    pelo evento `skill_cast` do motor.
 *
 * Só leitura: o combate é automático (idle), por isso a barra é
 * `pointer-events: none` e não rouba toques do palco.
 */
import { useEffect, useRef } from 'react';

import { BASE_CLASSES } from '@/data/classes';
import { SKILL_BY_ID } from '@/data/skills';
import { RARITY_COLOR } from '@/data/paperdoll-layers';
import type { BaseClass, PlayerCombatant, SkillFunction } from '@/types/game';

/** Cor do anel por classe — mesma paleta da carta de fallback do Paperdoll. */
const CLASS_RING: Readonly<Record<BaseClass, string>> = {
  warrior: '#fca5a5',
  hunter: '#4ade80',
  cleric: '#fde68a',
  mage: '#c4b5fd',
} as const;

/** Glifo por função da skill — leitura instantânea do papel dela no combate. */
const SKILL_GLYPH: Readonly<Record<SkillFunction, string>> = {
  damage: '🗡️',
  aoe_damage: '💥',
  dot: '☠️',
  heal: '✚',
  hot: '💧',
  shield: '⬡',
  buff: '⬆️',
  debuff: '⬇️',
  control: '⛓️',
  summon: '🐾',
  utility: '🌀',
  revive: '🕊️',
} as const;

export interface HeroSkillBarProps {
  readonly heroes: readonly PlayerCombatant[];
  /** Última conjuração por skillId (timestamp do evento `skill_cast`). */
  readonly castStamps: Readonly<Record<string, number>>;
  readonly reducedMotion: boolean;
}

export function HeroSkillBar({ heroes, castStamps, reducedMotion }: HeroSkillBarProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 16px 11px',
        borderRadius: 18,
        background:
          'linear-gradient(180deg, rgba(15,23,42,.62) 0%, rgba(2,6,23,.86) 100%)',
        border: '1px solid rgba(148,163,184,.24)',
        borderTopColor: 'rgba(148,163,184,.42)',
        boxShadow:
          '0 10px 30px rgba(2,6,23,.55), inset 0 1px 0 rgba(255,255,255,.07), inset 0 -8px 18px rgba(2,6,23,.5)',
        backdropFilter: 'blur(9px)',
        WebkitBackdropFilter: 'blur(9px)',
      }}
    >
      {heroes.map((hero, index) => {
        const classDefinition = BASE_CLASSES.find((candidate) => candidate.id === hero.baseClass) ?? null;
        const ring = CLASS_RING[hero.baseClass] ?? '#94a3b8';
        const skills = hero.skills.slice(0, 2);
        return (
          <div
            key={hero.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: index > 0 ? 10 : 0,
              borderLeft: index > 0 ? '1px solid rgba(148,163,184,.18)' : undefined,
            }}
          >
            <HeroChip hero={hero} icon={classDefinition?.icon ?? '❔'} ring={ring} />
            {skills.map((equipped) => (
              <SkillSlot
                key={`${hero.id}-${equipped.skillId}`}
                skillId={equipped.skillId}
                skillLevel={equipped.level}
                ring={ring}
                remainingSec={hero.skillCooldowns[equipped.skillId] ?? 0}
                mp={hero.mp}
                castStamp={castStamps[equipped.skillId]}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Mini-retrato do herói: ícone da classe num disco metálico + nível. */
function HeroChip({
  hero,
  icon,
  ring,
}: {
  readonly hero: PlayerCombatant;
  readonly icon: string;
  readonly ring: string;
}) {
  const dead = hero.hp <= 0;
  return (
    <div
      title={`${hero.name} · Nível ${hero.level}`}
      style={{
        position: 'relative',
        width: 32,
        height: 32,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: `radial-gradient(circle at 32% 26%, ${ring}33 0%, rgba(2,6,23,.9) 68%)`,
        border: `1px solid ${ring}66`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 2px 5px rgba(0,0,0,.5)',
        opacity: dead ? 0.4 : 1,
        filter: dead ? 'grayscale(1)' : undefined,
        transition: 'opacity 300ms ease, filter 300ms ease',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          position: 'absolute',
          bottom: -4,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--mono, monospace)',
          fontSize: 7.5,
          fontWeight: 700,
          lineHeight: 1,
          padding: '1.5px 4px',
          borderRadius: 99,
          color: '#e2e8f0',
          background: 'linear-gradient(180deg, #334155 0%, #0f172a 100%)',
          border: '1px solid rgba(148,163,184,.45)',
        }}
      >
        {hero.level}
      </span>
    </div>
  );
}

/** Slot circular de skill — moldura metálica, cooldown cónico, flash de cast. */
function SkillSlot({
  skillId,
  skillLevel,
  ring,
  remainingSec,
  mp,
  castStamp,
  reducedMotion,
}: {
  readonly skillId: string;
  readonly skillLevel: number;
  readonly ring: string;
  readonly remainingSec: number;
  readonly mp: number;
  readonly castStamp?: number | undefined;
  readonly reducedMotion: boolean;
}) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const skill = SKILL_BY_ID.get(skillId);
  const total = Math.max(1, skill?.cooldownSec ?? 1);
  const remaining = Math.max(0, remainingSec);
  const onCooldown = remaining > 0.001;
  const fraction = Math.min(1, remaining / total);
  const glyph = SKILL_GLYPH[skill?.function ?? 'damage'] ?? '⚔️';
  const rarityColor = skill ? RARITY_COLOR[skill.rarity] : '#94a3b8';
  const notEnoughMp = skill ? mp < skill.mpCost : false;
  const ready = !onCooldown && !notEnoughMp;

  // Flash de conjuração — brilho + pulso de escala (WAAPI, não remonta o DOM).
  useEffect(() => {
    if (reducedMotion || !castStamp || Date.now() - castStamp > 700) return;
    slotRef.current?.animate(
      [
        { boxShadow: '0 0 0 0 rgba(255,255,255,0)', transform: 'scale(1)' },
        { boxShadow: `0 0 16px 4px ${ring}, 0 0 3px 1px #fff`, transform: 'scale(1.14)', offset: 0.32 },
        { boxShadow: `0 0 6px 1px ${ring}55`, transform: 'scale(1)' },
      ],
      { duration: 640, easing: 'ease-out' },
    );
  }, [castStamp, ring, reducedMotion]);

  return (
    <div
      ref={slotRef}
      title={skill ? `${skill.name} (Nv ${skillLevel}) — ${skill.description}` : skillId}
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(180deg, #182238 0%, #05070f 100%)',
        border: `1px solid ${ready ? `${ring}aa` : 'rgba(148,163,184,.3)'}`,
        boxShadow: ready
          ? `inset 0 1px 0 rgba(255,255,255,.14), inset 0 -3px 8px rgba(0,0,0,.55), 0 0 9px ${ring}44`
          : 'inset 0 1px 0 rgba(255,255,255,.08), inset 0 -3px 8px rgba(0,0,0,.55), 0 2px 5px rgba(0,0,0,.5)',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
      }}
    >
      <span
        style={{
          fontSize: 19,
          lineHeight: 1,
          opacity: ready ? 1 : 0.55,
          filter: onCooldown ? 'grayscale(.65)' : notEnoughMp ? 'saturate(.4) brightness(.8)' : undefined,
          transition: 'opacity 200ms ease, filter 200ms ease',
          textShadow: ready ? `0 0 7px ${rarityColor}66` : undefined,
        }}
      >
        {glyph}
      </span>

      {/* Veil de cooldown: varredura cónica que encolhe conforme recarrega. */}
      {onCooldown ? (
        <>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 1,
              borderRadius: '50%',
              background: `conic-gradient(rgba(2,6,23,.82) ${fraction * 360}deg, transparent ${fraction * 360}deg)`,
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--mono, monospace)',
              fontSize: remaining >= 10 ? 11 : 13,
              fontWeight: 800,
              color: '#f1f5f9',
              textShadow: '0 1px 3px #000, 0 0 6px rgba(2,6,23,.9)',
            }}
          >
            {Math.ceil(remaining)}
          </span>
        </>
      ) : null}

      {/* Nível da skill — canto inferior direito, estilo slot de MMORPG. */}
      <span
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          fontFamily: 'var(--mono, monospace)',
          fontSize: 7.5,
          fontWeight: 700,
          lineHeight: 1,
          padding: '1.5px 4px',
          borderRadius: 99,
          color: '#e2e8f0',
          background: 'linear-gradient(180deg, #1e293b 0%, #020617 100%)',
          border: '1px solid rgba(148,163,184,.4)',
        }}
      >
        {skillLevel}
      </span>
    </div>
  );
}
