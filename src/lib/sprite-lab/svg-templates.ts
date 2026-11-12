/**
 * Parametric SVG templates for the Sprite Lab and Paperdoll Design System.
 *
 * Each template produces an SVG `<g>` element string suitable for embedding
 * into the synthesizer canvas or the 256×256 modular paperdoll system.
 * Templates are detailed fantasy RPG-style art (Ragnarök / MU Online style).
 */
import type { EquipmentSlot, PaperdollLayerKey } from '@/types/game';
import {
  PAPERDOLL_CANVAS,
  PAPERDOLL_SCALE_FACTOR,
  PAPERDOLL_TILE_SIZE,
  artRectFor,
  type PaperdollArtRect,
} from '@/data/paperdoll-layers';
import type { SvgTemplate, SvgTemplateCategory, SvgTemplateParams } from './types';

/* ────────────────────────────────────────────────────────────────────────────
 * Standard Canvas Specification (Design System Anchor Rules)
 *
 * A fonte de verdade é `src/data/paperdoll-layers.ts`. Este objecto é apenas
 * um preset do Sprite Lab — não duplica valores, consome-os.
 * ──────────────────────────────────────────────────────────────────────────── */

export const SPRITE_CANVAS_STANDARD = {
  width: PAPERDOLL_CANVAS.width,
  height: PAPERDOLL_CANVAS.height,
  nominalTileSize: PAPERDOLL_TILE_SIZE,
  scaleFactor: PAPERDOLL_SCALE_FACTOR,
  defaultAnchors: {
    aura: { x: 0, y: 0, scale: 1, zIndex: 10 },
    wings: { x: 16, y: 24, scale: 1, zIndex: 20 },
    cloak: { x: 24, y: 24, scale: 1, zIndex: 25 },
    body: { x: 32, y: 24, scale: 1, zIndex: 30 },
    boots: { x: 80, y: 154, scale: 1, zIndex: 35 },
    armor: { x: 72, y: 80, scale: 1, zIndex: 40 },
    helmet: { x: 80, y: 28, scale: 1, zIndex: 50 },
    weapon: { x: 124, y: 40, scale: 1, zIndex: 60 },
    offhand: { x: 12, y: 96, scale: 1, zIndex: 55 },
    accessory: { x: 92, y: 100, scale: 1, zIndex: 65 },
    vfx: { x: 0, y: 0, scale: 1, zIndex: 70 },
  },
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Helper
 * ──────────────────────────────────────────────────────────────────────────── */

function glowFilter(p: SvgTemplateParams): string {
  if (!p.glowColor) return '';
  const id = p.filterId ?? 'tplGlow';
  return `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="blur"/><feFlood flood-color="${p.glowColor}" result="color"/><feComposite in="color" in2="blur" operator="in" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

function filterAttr(p: SvgTemplateParams): string {
  const id = p.filterId ?? 'tplGlow';
  return p.glowColor ? ` filter="url(#${id})"` : '';
}

/* ────────────────────────────────────────────────────────────────────────────
 * Weapon Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function swordTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M28 8 L32 2 L36 8 L36 50 L34 54 L30 54 L28 50 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M30 50 L26 56 L32 62 L38 56 L34 50" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<path d="M20 50 L44 50 L42 54 L22 54 Z" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="1"/>
<path d="M30 54 L32 64 L34 54" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.6"/>
<line x1="32" y1="8" x2="32" y2="48" stroke="${p.stroke}" stroke-width="0.5" opacity="0.5"/>
<path d="M30 10 L32 6 L34 10" fill="white" opacity="0.3"/>
</g>`;
}

function warglaiveTemplate(p: SvgTemplateParams): string {
  // Lâminas de Azzinoth (Twin Glaives de Illidan)
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<!-- Lâmina Superior Curva -->
<path d="M32 30 C30 18 20 6 6 4 C10 14 18 24 28 32 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M32 30 C34 18 44 6 58 4 C54 14 46 24 36 32 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<!-- Lâmina Inferior Espelhada -->
<path d="M32 34 C30 46 20 58 6 60 C10 50 18 40 28 32 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M32 34 C34 46 44 58 58 60 C54 50 46 40 36 32 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<!-- Empunhadura Central Blindada -->
<circle cx="32" cy="32" r="6" fill="${p.stroke}" stroke="${p.fill}" stroke-width="1.5"/>
<circle cx="32" cy="32" r="3" fill="#22c55e" opacity="0.9"/>
<!-- Runas Vil nas bordas -->
<path d="M12 12 Q20 20 24 28" stroke="white" stroke-width="0.8" opacity="0.6" fill="none"/>
<path d="M52 12 Q44 20 40 28" stroke="white" stroke-width="0.8" opacity="0.6" fill="none"/>
</g>`;
}

function axeTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<rect x="30" y="20" width="4" height="44" rx="1" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<path d="M14 6 C14 6 18 4 22 6 L34 18 L34 28 L22 22 C18 20 14 14 14 6 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M50 6 C50 6 46 4 42 6 L30 18 L30 28 L42 22 C46 20 50 14 50 6 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M18 8 L24 14" stroke="white" stroke-width="0.8" opacity="0.35"/>
<path d="M46 8 L40 14" stroke="white" stroke-width="0.8" opacity="0.35"/>
<rect x="28" y="56" width="8" height="6" rx="2" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.5"/>
</g>`;
}

function spearTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<rect x="30" y="12" width="4" height="50" rx="1" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<path d="M32 2 L38 14 L32 20 L26 14 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M26 18 L38 18 L36 22 L28 22 Z" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<path d="M32 6 L32 16" stroke="white" stroke-width="0.6" opacity="0.45"/>
<path d="M30 58 L34 58 L33 62 L31 62 Z" fill="${p.stroke}"/>
</g>`;
}

function daggerTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M30 4 L32 2 L34 4 L35 32 L32 36 L29 32 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>
<path d="M26 36 L38 36 L37 40 L27 40 Z" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="1"/>
<path d="M30 40 L29 52 L32 56 L35 52 L34 40" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<line x1="32" y1="6" x2="32" y2="30" stroke="white" stroke-width="0.6" opacity="0.25"/>
<path d="M30.5 6 L32 3 L33.5 6" fill="white" opacity="0.35"/>
<circle cx="32" cy="44" r="1.5" fill="${p.fill}" opacity="0.6"/>
</g>`;
}

function staffTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<rect x="30" y="16" width="4" height="48" rx="1.5" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<circle cx="32" cy="10" r="8" fill="none" stroke="${p.fill}" stroke-width="2"/>
<circle cx="32" cy="10" r="4" fill="${p.fill}" opacity="0.7"/>
<circle cx="32" cy="10" r="2" fill="white" opacity="0.5"/>
<path d="M24 10 L20 6 M40 10 L44 6 M24 10 L20 14 M40 10 L44 14" stroke="${p.fill}" stroke-width="1.2" opacity="0.6"/>
<path d="M29 16 L32 12 L35 16" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.5"/>
<path d="M28 58 L36 58 L35 62 L29 62 Z" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.5"/>
</g>`;
}

function bowTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M20 4 C20 4 12 28 12 32 C12 36 20 60 20 60" fill="none" stroke="${p.fill}" stroke-width="3" stroke-linecap="round"/>
<line x1="20" y1="4" x2="20" y2="60" stroke="${p.stroke}" stroke-width="1" opacity="0.7"/>
<path d="M20 30 L46 30 L50 32 L46 34 L20 34" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<polygon points="50,32 56,30 56,34" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8"/>
<line x1="46" y1="30" x2="44" y2="26" stroke="${p.fill}" stroke-width="0.8"/>
<line x1="46" y1="34" x2="44" y2="38" stroke="${p.fill}" stroke-width="0.8"/>
</g>`;
}

function maceTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<rect x="30" y="28" width="4" height="36" rx="1.5" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<circle cx="32" cy="16" r="12" fill="${p.fill}" stroke="${p.stroke}" stroke-width="2"/>
<path d="M22 10 L20 6 M42 10 L44 6 M22 22 L20 26 M42 22 L44 26 M32 4 L32 0 M26 6 L22 2 M38 6 L42 2" stroke="${p.fill}" stroke-width="1.5" stroke-linecap="round"/>
<circle cx="32" cy="16" r="5" fill="${p.stroke}" opacity="0.5"/>
<circle cx="32" cy="16" r="2" fill="white" opacity="0.3"/>
<rect x="28" y="56" width="8" height="6" rx="2" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.5"/>
</g>`;
}

function grimoireTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<rect x="18" y="16" width="28" height="36" rx="3" fill="${p.fill}" stroke="${p.stroke}" stroke-width="2"/>
<line x1="24" y1="16" x2="24" y2="52" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M32 26 L36 34 L28 34 Z" fill="none" stroke="${p.stroke}" stroke-width="1.5"/>
<circle cx="32" cy="34" r="4" fill="${p.stroke}" opacity="0.4"/>
<line x1="28" y1="42" x2="40" y2="42" stroke="white" stroke-width="1" opacity="0.6"/>
<line x1="28" y1="46" x2="38" y2="46" stroke="white" stroke-width="1" opacity="0.4"/>
</g>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Armor / Helmet / Shield Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function armorTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M20 16 L32 10 L44 16 L48 28 L44 48 L36 54 L28 54 L20 48 L16 28 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M32 10 L32 54" stroke="${p.stroke}" stroke-width="0.6" opacity="0.3"/>
<path d="M22 20 L32 14 L42 20" fill="none" stroke="${p.stroke}" stroke-width="1" opacity="0.5"/>
<path d="M14 22 L20 20 L20 32 L14 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1"/>
<path d="M50 22 L44 20 L44 32 L50 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1"/>
<path d="M24 36 L32 32 L40 36 L40 46 L32 50 L24 46 Z" fill="${p.stroke}" opacity="0.2"/>
<circle cx="32" cy="26" r="3" fill="${p.stroke}" opacity="0.4"/>
</g>`;
}

function robeTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M22 14 L32 8 L42 14 L46 32 L50 56 L14 56 L18 32 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M32 18 L32 56" stroke="${p.stroke}" stroke-width="1.2" opacity="0.5"/>
<circle cx="32" cy="24" r="3" fill="${p.stroke}"/>
<path d="M18 50 L46 50" stroke="${p.stroke}" stroke-width="1.5"/>
</g>`;
}

function helmetTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M18 36 L18 22 C18 10 46 10 46 22 L46 36 L40 40 L24 40 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M18 30 L46 30" stroke="${p.stroke}" stroke-width="1" opacity="0.4"/>
<path d="M22 30 L22 38 L42 38 L42 30" fill="${p.stroke}" opacity="0.25"/>
<path d="M26 38 L26 44 L38 44 L38 38" fill="none" stroke="${p.stroke}" stroke-width="1" opacity="0.6"/>
<path d="M28 30 L28 26 L36 26 L36 30" fill="${p.stroke}" opacity="0.15"/>
<path d="M32 10 L32 4 L36 8" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
</g>`;
}

function hoodTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M16 40 C16 16 26 8 32 6 C38 8 48 16 48 40 L40 44 L32 42 L24 44 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M22 30 C24 38 40 38 42 30 Z" fill="#090d16" opacity="0.95"/>
<circle cx="28" cy="32" r="1.5" fill="#38bdf8"/>
<circle cx="36" cy="32" r="1.5" fill="#38bdf8"/>
</g>`;
}

function shieldTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M32 4 L50 12 L50 32 C50 48 32 60 32 60 C32 60 14 48 14 32 L14 12 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="2"/>
<path d="M32 10 L44 16 L44 30 C44 42 32 52 32 52 C32 52 20 42 20 30 L20 16 Z" fill="${p.stroke}" opacity="0.15"/>
<path d="M32 16 L38 20 L38 28 C38 36 32 44 32 44 C32 44 26 36 26 28 L26 20 Z" fill="${p.fill}" opacity="0.3" stroke="${p.stroke}" stroke-width="0.5"/>
<circle cx="32" cy="28" r="4" fill="${p.stroke}" opacity="0.4"/>
<line x1="32" y1="4" x2="32" y2="60" stroke="${p.stroke}" stroke-width="0.5" opacity="0.2"/>
</g>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cloak / Boots / Accessory / Body Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function cloakTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M22 16 L32 14 L42 16 L52 56 L12 56 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M28 16 L36 16" stroke="white" stroke-width="2"/>
<circle cx="32" cy="16" r="3" fill="${p.stroke}"/>
</g>`;
}

function bootsTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<!-- Bota Esquerda -->
<path d="M18 16 L28 16 L26 36 L32 44 L16 44 L16 26 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<!-- Bota Direita -->
<path d="M46 16 L36 16 L38 36 L32 44 L48 44 L48 26 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<line x1="16" y1="32" x2="26" y2="32" stroke="${p.stroke}" stroke-width="1"/>
<line x1="38" y1="32" x2="48" y2="32" stroke="${p.stroke}" stroke-width="1"/>
</g>`;
}

function amuletTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M20 16 Q32 28 44 16" fill="none" stroke="${p.stroke}" stroke-width="1.5"/>
<polygon points="32,24 40,32 32,44 24,32" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<circle cx="32" cy="32" r="3" fill="white" opacity="0.75"/>
</g>`;
}

function heroBodyTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<!-- Cabeça -->
<circle cx="32" cy="14" r="8" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>
<!-- Tronco -->
<path d="M22 24 L42 24 L38 42 L26 42 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>
<!-- Braços -->
<path d="M22 26 L14 40 M42 26 L50 40" stroke="${p.stroke}" stroke-width="3" stroke-linecap="round"/>
<!-- Pernas -->
<path d="M28 42 L24 60 M36 42 L40 60" stroke="${p.stroke}" stroke-width="3.5" stroke-linecap="round"/>
</g>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Aura & Wings Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function auraTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<ellipse cx="32" cy="32" rx="28" ry="28" fill="${p.fill}" opacity="0.18"/>
<ellipse cx="32" cy="32" rx="22" ry="22" fill="${p.fill}" opacity="0.12"/>
<ellipse cx="32" cy="32" rx="16" ry="16" fill="${p.fill}" opacity="0.1"/>
<circle cx="18" cy="14" r="2.2" fill="${p.fill}" opacity="0.6"/>
<circle cx="46" cy="12" r="1.8" fill="${p.fill}" opacity="0.5"/>
<circle cx="12" cy="38" r="2" fill="${p.fill}" opacity="0.45"/>
<circle cx="50" cy="42" r="2.2" fill="${p.fill}" opacity="0.5"/>
<circle cx="26" cy="52" r="1.4" fill="${p.fill}" opacity="0.4"/>
<circle cx="40" cy="54" r="1.8" fill="${p.fill}" opacity="0.45"/>
</g>`;
}

function wingsTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<path d="M32 32 L6 8 C2 4 4 16 8 22 L18 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" opacity="0.85"/>
<path d="M32 32 L2 18 C0 14 4 24 10 28 L22 34 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8" opacity="0.7"/>
<path d="M32 32 L8 28 C6 26 8 32 14 34 L26 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.6" opacity="0.55"/>
<path d="M32 32 L58 8 C62 4 60 16 56 22 L46 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" opacity="0.85"/>
<path d="M32 32 L62 18 C64 14 60 24 54 28 L42 34 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8" opacity="0.7"/>
<path d="M32 32 L56 28 C58 26 56 32 50 34 L38 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.6" opacity="0.55"/>
</g>`;
}

function demonWingsTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<!-- Asa Esquerda Demoníaca -->
<path d="M32 32 L4 12 C8 24 12 36 22 42 C14 36 8 38 4 44 C12 46 22 44 32 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>
<!-- Asa Direita Demoníaca -->
<path d="M32 32 L60 12 C56 24 52 36 42 42 C50 36 56 38 60 44 C52 46 42 44 32 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>
<!-- Garras Ósseas -->
<circle cx="4" cy="12" r="2" fill="${p.stroke}"/>
<circle cx="60" cy="12" r="2" fill="${p.stroke}"/>
</g>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Template Registry
 * ──────────────────────────────────────────────────────────────────────────── */

function tpl(
  id: string,
  name: string,
  category: SvgTemplateCategory,
  layer: PaperdollLayerKey,
  w: number,
  h: number,
  render: (p: SvgTemplateParams) => string,
): SvgTemplate {
  return { id, name, category, layer, defaultWidth: w, defaultHeight: h, render } as const;
}

export const SVG_TEMPLATES: readonly SvgTemplate[] = [
  // Armas
  tpl('sword', 'Fantasy Sword', 'weapon', 'weapon', 64, 64, swordTemplate),
  tpl('warglaive', 'Twin Glaives of Azzinoth', 'weapon', 'weapon', 64, 64, warglaiveTemplate),
  tpl('axe', 'Battle Axe', 'weapon', 'weapon', 64, 64, axeTemplate),
  tpl('spear', 'Dragon Spear', 'weapon', 'weapon', 64, 64, spearTemplate),
  tpl('dagger', 'Rogue Dagger', 'weapon', 'weapon', 64, 64, daggerTemplate),
  tpl('staff', 'Arcane Staff', 'weapon', 'weapon', 64, 64, staffTemplate),
  tpl('bow', 'Longbow', 'weapon', 'weapon', 64, 64, bowTemplate),
  tpl('mace', 'War Mace', 'weapon', 'weapon', 64, 64, maceTemplate),
  tpl('grimoire', 'Ancient Grimoire', 'weapon', 'weapon', 64, 64, grimoireTemplate),

  // Armaduras e Elmos
  tpl('plate-armor', 'Plate Armor', 'armor', 'armor', 64, 64, armorTemplate),
  tpl('mage-robe', 'Arcane Robe', 'armor', 'armor', 64, 64, robeTemplate),
  tpl('knight-helm', 'Knight Helm', 'helmet', 'helmet', 64, 64, helmetTemplate),
  tpl('rogue-hood', 'Shadow Hood', 'helmet', 'helmet', 64, 64, hoodTemplate),
  tpl('tower-shield', 'Tower Shield', 'shield', 'armor', 64, 64, shieldTemplate),

  // Slots Complementares do Paperdoll
  tpl('cloak', 'Battle Cloak', 'cloak', 'body', 64, 64, cloakTemplate),
  tpl('boots', 'Iron Sabatons', 'boots', 'armor', 64, 64, bootsTemplate),
  tpl('amulet', 'Mystic Amulet', 'accessory', 'vfx', 64, 64, amuletTemplate),
  tpl('hero-body', 'Hero Body Silhouette', 'body', 'body', 64, 64, heroBodyTemplate),

  // Auras e Asas
  tpl('energy-aura', 'Energy Aura', 'aura', 'aura', 64, 64, auraTemplate),
  tpl('feather-wings', 'Feather Wings', 'wings', 'wings', 64, 64, wingsTemplate),
  tpl('demon-wings', 'Abyssal Demon Wings', 'wings', 'wings', 64, 64, demonWingsTemplate),
] as const;

/** Quick lookup by id. Returns `undefined` for unknown ids. */
export const TEMPLATE_BY_ID: ReadonlyMap<string, SvgTemplate> = new Map(
  SVG_TEMPLATES.map((t) => [t.id, t]),
);

/** Templates filtered by category. */
export function templatesByCategory(category: SvgTemplateCategory): readonly SvgTemplate[] {
  return SVG_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Escolhe o template a partir do NOME DO FICHEIRO do asset. É isto que faz
 * `dragon_spear.png` aparecer como lança e `arcane_robe.png` como túnica,
 * em vez de todas as armas virarem espadas.
 */
const TEMPLATE_BY_ASSET_TOKEN: readonly (readonly [string, string])[] = [
  ['tower_shield', 'tower-shield'],
  ['shield', 'tower-shield'],
  ['grimoire', 'grimoire'],
  ['bow', 'bow'],
  ['staff', 'staff'],
  ['dagger', 'dagger'],
  ['mace', 'mace'],
  ['spear', 'spear'],
  ['sword', 'sword'],
  ['hood', 'rogue-hood'],
  ['helm', 'knight-helm'],
  ['cap', 'knight-helm'],
  ['robe', 'mage-robe'],
  ['vest', 'plate-armor'],
  ['mail', 'plate-armor'],
  ['garb', 'plate-armor'],
  ['abyss', 'plate-armor'],
  ['cloak', 'cloak'],
  ['boots', 'boots'],
  ['charm', 'amulet'],
] as const;

/** Id do template paramétrico para uma camada/slot/asset. Nunca falha. */
export function selectParametricTemplateId(
  layerKey: PaperdollLayerKey,
  slot: EquipmentSlot | null | undefined,
  assetSrc?: string | null,
): string {
  const file = (assetSrc ?? '')
    .split('/')
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase();

  if (file) {
    for (const [token, templateId] of TEMPLATE_BY_ASSET_TOKEN) {
      if (file.includes(token)) return templateId;
    }
  }

  switch (slot) {
    case 'helmet':
      return 'knight-helm';
    case 'armor':
      return 'plate-armor';
    case 'weapon':
      return 'sword';
    case 'offhand':
      return 'tower-shield';
    case 'cloak':
      return 'cloak';
    case 'boots':
      return 'boots';
    case 'accessory':
      return 'amulet';
    case 'aura':
      return 'energy-aura';
    case 'wings':
      return 'feather-wings';
    default:
      break;
  }

  switch (layerKey) {
    case 'helmet':
      return 'knight-helm';
    case 'armor':
      return 'plate-armor';
    case 'weapon':
      return 'sword';
    case 'aura':
      return 'energy-aura';
    case 'wings':
      return 'feather-wings';
    case 'vfx':
      return 'amulet';
    default:
      return 'hero-body';
  }
}

export interface ParametricLayerOptions {
  /** Caminho do asset PNG — decide o template (bow, staff, robe...). */
  readonly assetSrc?: string | null;
  /** Cor sólida do glow de raridade (`RARITY_COLOR[rarity]`). */
  readonly rarityGlow?: string | null;
  /** Id único por instância — evita colisão entre filtros SVG. */
  readonly instanceId?: string | null;
  readonly fill?: string;
  readonly stroke?: string;
}

function safeSvgId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '') || 'layer';
}

/**
 * Retorna o SVG paramétrico oficial para uma camada/slot do Paperdoll.
 *
 * O SVG já vem posicionado no rect oficial do canvas 256×256 e é o próprio
 * elemento raiz — o chamador só precisa de um contentor com `layerStyle()`.
 * Assim o mesmo markup serve 56 px na Arena e 256 px no catálogo.
 */
export function getParametricSvgForLayer(
  layerKey: PaperdollLayerKey,
  slot?: EquipmentSlot | null,
  options: ParametricLayerOptions = {},
): string | null {
  const templateId = selectParametricTemplateId(layerKey, slot, options.assetSrc);
  const template = TEMPLATE_BY_ID.get(templateId);
  if (!template) return null;

  const rect: PaperdollArtRect = artRectFor(layerKey, slot);
  const filterId = `tplGlow-${safeSvgId(options.instanceId ?? `${templateId}-${layerKey}`)}`;

  const inner = template.render({
    fill: options.fill ?? '#5b6b8c',
    stroke: options.stroke ?? '#c7d2fe',
    glowColor: options.rarityGlow ?? null,
    scale: rect.size / PAPERDOLL_TILE_SIZE,
    filterId,
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${rect.x} ${rect.y} ${rect.size} ${rect.size}" width="100%" height="100%" style="overflow:visible">`,
    `<svg x="${rect.x}" y="${rect.y}" width="${rect.size}" height="${rect.size}" viewBox="0 0 64 64" overflow="visible">`,
    inner,
    '</svg></svg>',
  ].join('');
}
