/**
 * arena-shared — contrato e utilitários partilhados pela camada visual da Arena.
 *
 * Extraído do antigo `ArenaView.tsx` (DOM) para que a implementação Pixi
 * (`PixiArenaCanvas.tsx`) e o wrapper (`ArenaView.tsx`) falem da mesma língua:
 * formação tática, percentuais de barras, glifos de monstro e cores.
 *
 * Puro e sem React — pode ser importado por qualquer camada de render.
 */
import { BIOME_BY_ID } from '@/data/tower';
import type {
  CombatEvent,
  CombatState,
  EquipmentLoadout,
  Uuid,
} from '@/types/game';

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

/* ==========================================================================
 * FORMAÇÃO — slots percentuais do palco (x = eixo horizontal, y = linha do chão)
 *
 * Heróis encostam à esquerda, monstros à direita; a linha `front` fica junto
 * ao centro (onde o combate acontece), `mid` e `back` recuam em diagonal.
 * Membros extra da mesma lane afastam-se ligeiramente para trás/baixo.
 * ========================================================================== */

export type LaneId = 'front' | 'mid' | 'back';

export interface Slot {
  readonly x: number;
  readonly y: number;
}

export const HERO_LANE_BASE: Readonly<Record<LaneId, Slot>> = {
  front: { x: 41, y: 76 },
  mid: { x: 28, y: 60 },
  back: { x: 15, y: 44 },
};

export const ENEMY_LANE_BASE: Readonly<Record<LaneId, Slot>> = {
  front: { x: 59, y: 76 },
  mid: { x: 72, y: 60 },
  back: { x: 85, y: 44 },
};

export const MEMBER_STAGGER = { x: 4, y: 15 } as const;

/** Distribui os combatentes da lane nos slots da formação. */
export function place<T extends { position: LaneId }>(
  actors: readonly T[],
  base: Readonly<Record<LaneId, Slot>>,
): readonly { readonly actor: T; readonly slot: Slot }[] {
  const counters: Record<LaneId, number> = { front: 0, mid: 0, back: 0 };
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

/* ==========================================================================
 * MÉTRICAS
 * ========================================================================== */

export function percent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Progresso do auto-ataque (0..100) a partir do cooldown restante. */
export function turnPercent(cooldownRemaining: number, attackSpeed: number): number {
  const period = Math.max(0.1, attackSpeed);
  return percent(1 / period - cooldownRemaining, 1 / period);
}

/** Nome legível do bioma para o banner de transição. */
export function biomeLabel(biome: string): string {
  return BIOME_BY_ID.get(biome)?.name ?? biome;
}

/** Cor oficial → rgba() com alfa (as paletas são hex #rrggbb; rgba passa). */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgb')) return color;
  const hex = color.replace('#', '');
  const value = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ==========================================================================
 * MONSTROS — glifo por sprite e aura elementar
 * ========================================================================== */

/** Glifo por basename de `Monster.sprite.src` (data/tower.ts) — fallback por tier. */
export const MONSTER_GLYPH: Readonly<Record<string, string>> = {
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

/** Aura elementar — cor de glow por elemento do monstro. */
export const ELEMENT_GLOW: Readonly<Record<string, string>> = {
  neutral: 'rgba(226,232,240,.4)',
  earth: 'rgba(132,204,22,.45)',
  fire: 'rgba(249,115,22,.5)',
  water: 'rgba(56,189,248,.5)',
  wind: 'rgba(125,211,252,.45)',
  holy: 'rgba(253,224,71,.5)',
  dark: 'rgba(167,139,250,.5)',
  poison: 'rgba(74,222,128,.45)',
};

/**
 * Glifo de um monstro. O `icon` do seed não existe no Monster construído —
 * vive no basename de `sprite.src` (`/assets/monsters/[icon].png`).
 */
export function monsterGlyphFor(spriteSrc: string, isBoss: boolean): string {
  const icon = spriteSrc.replace(/\\/g, '/').split('/').pop()?.replace(/\.png$/, '') ?? '';
  return MONSTER_GLYPH[icon] ?? (isBoss ? '💀' : '👹');
}

/* ==========================================================================
 * CORES — ponte entre as paletas CSS do design system e os tints do Pixi
 * ========================================================================== */

export interface ParsedColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Analisa as notações usadas pelo design system:
 *  · `#rrggbb` / `#rgb`            → a = 1;
 *  · `rgb(r g b)`                  → a = 1;
 *  · `rgb(r g b / a)`              → a do formato moderno do CSS.
 * Entrada inválida → cinza neutro (nunca lança).
 */
export function parseRgbColor(input: string): ParsedColor {
  const fallback: ParsedColor = { r: 148, g: 163, b: 184, a: 1 };
  if (typeof input !== 'string') return fallback;

  const trimmed = input.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    const expand = (part: string) => (part.length === 1 ? part + part : part);
    if (hex.length === 3 || hex.length === 6) {
      const full = hex.length === 3
        ? expand(hex.slice(0, 1)) + expand(hex.slice(1, 2)) + expand(hex.slice(2, 3))
        : hex;
      return {
        r: parseInt(full.slice(0, 2), 16) || 0,
        g: parseInt(full.slice(2, 4), 16) || 0,
        b: parseInt(full.slice(4, 6), 16) || 0,
        a: 1,
      };
    }
    return fallback;
  }

  const match = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/.exec(trimmed);
  if (!match) return fallback;
  return {
    r: Number(match[1] ?? 0),
    g: Number(match[2] ?? 0),
    b: Number(match[3] ?? 0),
    a: match[4] !== undefined ? Number(match[4]) : 1,
  };
}

/** Qualquer cor do design system → número 0xRRGGBB para tint do Pixi. */
export function toPixiColor(input: string): number {
  const { r, g, b } = parseRgbColor(input);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Qualquer cor do design system → número 0xRRGGBBAA para fills do Pixi. */
export function toPixiRgba(input: string, alphaOverride?: number): number {
  const { r, g, b, a } = parseRgbColor(input);
  const alpha = Math.round(Math.max(0, Math.min(1, alphaOverride ?? a)) * 255);
  return ((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)) * 256 + alpha;
}
