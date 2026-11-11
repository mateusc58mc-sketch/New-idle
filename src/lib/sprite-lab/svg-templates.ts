/**
 * Parametric SVG templates for the Sprite Lab.
 *
 * Each template produces an SVG `<g>` element string suitable for embedding
 * into the synthesizer canvas. Templates are detailed fantasy RPG-style art —
 * not placeholder rectangles.
 */
import type { PaperdollLayerKey } from '@/types/game';
import type { SvgTemplate, SvgTemplateCategory, SvgTemplateParams } from './types';

/* ────────────────────────────────────────────────────────────────────────────
 * Helper
 * ──────────────────────────────────────────────────────────────────────────── */

function glowFilter(glowColor: string | null): string {
  if (!glowColor) return '';
  return `<filter id="tplGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feFlood flood-color="${glowColor}" result="color"/><feComposite in="color" in2="blur" operator="in" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

function filterAttr(glowColor: string | null): string {
  return glowColor ? ' filter="url(#tplGlow)"' : '';
}

/* ────────────────────────────────────────────────────────────────────────────
 * Weapon Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function swordTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<path d="M28 8 L32 2 L36 8 L36 50 L34 54 L30 54 L28 50 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M30 50 L26 56 L32 62 L38 56 L34 50" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<path d="M20 50 L44 50 L42 54 L22 54 Z" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="1"/>
<path d="M30 54 L32 64 L34 54" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.6"/>
<line x1="32" y1="8" x2="32" y2="48" stroke="${p.stroke}" stroke-width="0.5" opacity="0.5"/>
<path d="M30 10 L32 6 L34 10" fill="white" opacity="0.3"/>
</g>`;
}

function axeTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<rect x="30" y="20" width="4" height="44" rx="1" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<path d="M14 6 C14 6 18 4 22 6 L34 18 L34 28 L22 22 C18 20 14 14 14 6 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M50 6 C50 6 46 4 42 6 L30 18 L30 28 L42 22 C46 20 50 14 50 6 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M18 8 L24 14" stroke="white" stroke-width="0.8" opacity="0.35"/>
<path d="M46 8 L40 14" stroke="white" stroke-width="0.8" opacity="0.35"/>
<rect x="28" y="56" width="8" height="6" rx="2" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.5"/>
</g>`;
}

function daggerTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<path d="M30 4 L32 2 L34 4 L35 32 L32 36 L29 32 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>
<path d="M26 36 L38 36 L37 40 L27 40 Z" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="1"/>
<path d="M30 40 L29 52 L32 56 L35 52 L34 40" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<line x1="32" y1="6" x2="32" y2="30" stroke="white" stroke-width="0.6" opacity="0.25"/>
<path d="M30.5 6 L32 3 L33.5 6" fill="white" opacity="0.35"/>
<circle cx="32" cy="44" r="1.5" fill="${p.fill}" opacity="0.6"/>
</g>`;
}

function staffTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
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
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<path d="M20 4 C20 4 12 28 12 32 C12 36 20 60 20 60" fill="none" stroke="${p.fill}" stroke-width="3" stroke-linecap="round"/>
<line x1="20" y1="4" x2="20" y2="60" stroke="${p.stroke}" stroke-width="1" opacity="0.7"/>
<path d="M20 30 L46 30 L50 32 L46 34 L20 34" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<polygon points="50,32 56,30 56,34" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8"/>
<line x1="46" y1="30" x2="44" y2="26" stroke="${p.fill}" stroke-width="0.8"/>
<line x1="46" y1="34" x2="44" y2="38" stroke="${p.fill}" stroke-width="0.8"/>
</g>`;
}

function maceTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<rect x="30" y="28" width="4" height="36" rx="1.5" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.8"/>
<circle cx="32" cy="16" r="12" fill="${p.fill}" stroke="${p.stroke}" stroke-width="2"/>
<path d="M22 10 L20 6 M42 10 L44 6 M22 22 L20 26 M42 22 L44 26 M32 4 L32 0 M26 6 L22 2 M38 6 L42 2" stroke="${p.fill}" stroke-width="1.5" stroke-linecap="round"/>
<circle cx="32" cy="16" r="5" fill="${p.stroke}" opacity="0.5"/>
<circle cx="32" cy="16" r="2" fill="white" opacity="0.3"/>
<rect x="28" y="56" width="8" height="6" rx="2" fill="${p.stroke}" stroke="${p.stroke}" stroke-width="0.5"/>
</g>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Armor / Helmet / Shield / Aura / Wings Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function armorTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<path d="M20 16 L32 10 L44 16 L48 28 L44 48 L36 54 L28 54 L20 48 L16 28 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M32 10 L32 54" stroke="${p.stroke}" stroke-width="0.6" opacity="0.3"/>
<path d="M22 20 L32 14 L42 20" fill="none" stroke="${p.stroke}" stroke-width="1" opacity="0.5"/>
<path d="M14 22 L20 20 L20 32 L14 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1"/>
<path d="M50 22 L44 20 L44 32 L50 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1"/>
<path d="M24 36 L32 32 L40 36 L40 46 L32 50 L24 46 Z" fill="${p.stroke}" opacity="0.2"/>
<circle cx="32" cy="26" r="3" fill="${p.stroke}" opacity="0.4"/>
</g>`;
}

function helmetTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<path d="M18 36 L18 22 C18 10 46 10 46 22 L46 36 L40 40 L24 40 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.5"/>
<path d="M18 30 L46 30" stroke="${p.stroke}" stroke-width="1" opacity="0.4"/>
<path d="M22 30 L22 38 L42 38 L42 30" fill="${p.stroke}" opacity="0.25"/>
<path d="M26 38 L26 44 L38 44 L38 38" fill="none" stroke="${p.stroke}" stroke-width="1" opacity="0.6"/>
<path d="M28 30 L28 26 L36 26 L36 30" fill="${p.stroke}" opacity="0.15"/>
<path d="M32 10 L32 4 L36 8" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
</g>`;
}

function shieldTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<path d="M32 4 L50 12 L50 32 C50 48 32 60 32 60 C32 60 14 48 14 32 L14 12 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="2"/>
<path d="M32 10 L44 16 L44 30 C44 42 32 52 32 52 C32 52 20 42 20 30 L20 16 Z" fill="${p.stroke}" opacity="0.15"/>
<path d="M32 16 L38 20 L38 28 C38 36 32 44 32 44 C32 44 26 36 26 28 L26 20 Z" fill="${p.fill}" opacity="0.3" stroke="${p.stroke}" stroke-width="0.5"/>
<circle cx="32" cy="28" r="4" fill="${p.stroke}" opacity="0.4"/>
<line x1="32" y1="4" x2="32" y2="60" stroke="${p.stroke}" stroke-width="0.5" opacity="0.2"/>
</g>`;
}

function auraTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<ellipse cx="32" cy="32" rx="28" ry="28" fill="${p.fill}" opacity="0.15"/>
<ellipse cx="32" cy="32" rx="22" ry="22" fill="${p.fill}" opacity="0.1"/>
<ellipse cx="32" cy="32" rx="16" ry="16" fill="${p.fill}" opacity="0.08"/>
<circle cx="18" cy="14" r="2" fill="${p.fill}" opacity="0.5"/>
<circle cx="46" cy="12" r="1.5" fill="${p.fill}" opacity="0.4"/>
<circle cx="12" cy="38" r="1.8" fill="${p.fill}" opacity="0.35"/>
<circle cx="50" cy="42" r="2" fill="${p.fill}" opacity="0.45"/>
<circle cx="26" cy="52" r="1.2" fill="${p.fill}" opacity="0.3"/>
<circle cx="40" cy="54" r="1.6" fill="${p.fill}" opacity="0.35"/>
</g>`;
}

function wingsTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p.glowColor)}>
${glowFilter(p.glowColor)}
<path d="M32 32 L6 8 C2 4 4 16 8 22 L18 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" opacity="0.85"/>
<path d="M32 32 L2 18 C0 14 4 24 10 28 L22 34 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8" opacity="0.7"/>
<path d="M32 32 L8 28 C6 26 8 32 14 34 L26 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.6" opacity="0.55"/>
<path d="M32 32 L58 8 C62 4 60 16 56 22 L46 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" opacity="0.85"/>
<path d="M32 32 L62 18 C64 14 60 24 54 28 L42 34 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8" opacity="0.7"/>
<path d="M32 32 L56 28 C58 26 56 32 50 34 L38 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.6" opacity="0.55"/>
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
  tpl('sword', 'Fantasy Sword', 'weapon', 'weapon', 64, 64, swordTemplate),
  tpl('axe', 'Battle Axe', 'weapon', 'weapon', 64, 64, axeTemplate),
  tpl('dagger', 'Rogue Dagger', 'weapon', 'weapon', 64, 64, daggerTemplate),
  tpl('staff', 'Arcane Staff', 'weapon', 'weapon', 64, 64, staffTemplate),
  tpl('bow', 'Longbow', 'weapon', 'weapon', 64, 64, bowTemplate),
  tpl('mace', 'War Mace', 'weapon', 'weapon', 64, 64, maceTemplate),
  tpl('plate-armor', 'Plate Armor', 'armor', 'armor', 64, 64, armorTemplate),
  tpl('knight-helm', 'Knight Helm', 'helmet', 'helmet', 64, 64, helmetTemplate),
  tpl('tower-shield', 'Tower Shield', 'shield', 'armor', 64, 64, shieldTemplate),
  tpl('energy-aura', 'Energy Aura', 'aura', 'aura', 64, 64, auraTemplate),
  tpl('feather-wings', 'Feather Wings', 'wings', 'wings', 64, 64, wingsTemplate),
] as const;

/** Quick lookup by id. Returns `undefined` for unknown ids. */
export const TEMPLATE_BY_ID: ReadonlyMap<string, SvgTemplate> = new Map(
  SVG_TEMPLATES.map((t) => [t.id, t]),
);

/** Templates filtered by category. */
export function templatesByCategory(category: SvgTemplateCategory): readonly SvgTemplate[] {
  return SVG_TEMPLATES.filter((t) => t.category === category);
}
