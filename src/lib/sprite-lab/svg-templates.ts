/**
 * Parametric SVG templates for the Sprite Lab and Paperdoll Design System.
 *
 * Each template produces an SVG `<g>` element string suitable for embedding
 * into the synthesizer canvas or the 256×256 modular paperdoll system.
 * Templates are hand-authored fantasy RPG art (Ragnarök / World of Warcraft
 * style): crossed blades, ornate guards, fullers, runes and inset gems. The
 * `fill`/`stroke` params still tint the piece, so class and rarity read through
 * the ornamentation instead of fighting it.
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
 * Ornamental palette + shared gradients
 *
 * The `fill`/`stroke` parameters still tint the piece (class/rarity), while
 * gold, leather and gem accents are fixed. Gradients give the flat vector art
 * a forged-metal read even at 56 px in the Arena.
 * ──────────────────────────────────────────────────────────────────────────── */

const GOLD_LIGHT = '#fde68a';
const GOLD = '#f5b83d';
const GOLD_DARK = '#8a4b12';
const GEM_FALLBACK = '#67e8f9';

function svgUid(p: SvgTemplateParams): string {
  return (p.filterId ?? 'tpl').replace(/[^a-zA-Z0-9_-]/g, '') || 'tpl';
}

function gradients(p: SvgTemplateParams): string {
  const id = svgUid(p);
  const gem = p.glowColor ?? GEM_FALLBACK;
  return `<defs>
<linearGradient id="${id}-blade" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${p.stroke}"/><stop offset="0.28" stop-color="${p.fill}"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.92"/><stop offset="0.72" stop-color="${p.fill}"/><stop offset="1" stop-color="${p.stroke}"/>
</linearGradient>
<linearGradient id="${id}-metal" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${p.stroke}"/><stop offset="0.28" stop-color="${p.fill}"/><stop offset="0.52" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.78" stop-color="${p.fill}"/><stop offset="1" stop-color="${p.stroke}"/>
</linearGradient>
<linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${GOLD_LIGHT}"/><stop offset="0.45" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DARK}"/>
</linearGradient>
<linearGradient id="${id}-leather" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#3b2a4a"/><stop offset="0.55" stop-color="#231a33"/><stop offset="1" stop-color="#100c18"/>
</linearGradient>
<radialGradient id="${id}-gem" cx="0.35" cy="0.3" r="0.78">
<stop offset="0" stop-color="#ffffff"/><stop offset="0.32" stop-color="${gem}"/><stop offset="1" stop-color="${p.stroke}"/>
</radialGradient>
</defs>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Weapon Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function swordTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Lâmina larga com bisel e ponta reforçada -->
<path d="M32 1 L38 9 L36.5 40 L34 45 L30 45 L27.5 40 L26 9 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1.1" stroke-linejoin="round"/>
<path d="M28.5 9 L29.5 39" stroke="#ffffff" stroke-width="0.75" opacity="0.55"/>
<path d="M35.5 9 L34.5 39" stroke="#ffffff" stroke-width="0.4" opacity="0.3"/>
<!-- Ranhura central (fuller) e contra-fio -->
<path d="M32 6 L32 42" stroke="${p.stroke}" stroke-width="1.7" opacity="0.55"/>
<path d="M31 8 L31 40" stroke="#ffffff" stroke-width="0.45" opacity="0.4"/>
<path d="M30 12 L34 12 M30 34 L34 34" stroke="${p.stroke}" stroke-width="0.5" opacity="0.55"/>
<!-- Runas douradas gravadas -->
<path d="M32 13 L33.8 15.6 L32 18.2 L30.2 15.6 Z" fill="${GOLD_LIGHT}" opacity="0.95"/>
<path d="M32 23 L33.5 25.3 L32 27.6 L30.5 25.3 Z" fill="${GOLD}" opacity="0.8"/>
<path d="M32 31.5 L33.2 33.4 L32 35.3 L30.8 33.4 Z" fill="${GOLD}" opacity="0.6"/>
<!-- Guarda em asas com espigões -->
<path d="M28 44 C22 43 15 46 9 41 C11 48 20 51 28 49 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
<path d="M36 44 C42 43 49 46 55 41 C53 48 44 51 36 49 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
<path d="M24 45 L20 40 M40 45 L44 40" stroke="${GOLD_LIGHT}" stroke-width="1.2" stroke-linecap="round"/>
<path d="M18 43 L14 39 M46 43 L50 39" stroke="${GOLD_DARK}" stroke-width="0.9" stroke-linecap="round"/>
<!-- Gema central da guarda -->
<circle cx="32" cy="46.5" r="3.4" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.8"/>
<circle cx="31" cy="45.4" r="1" fill="#ffffff" opacity="0.85"/>
<!-- Empunhadura envolta em couro -->
<path d="M29.5 48 L34.5 48 L34 57 L30 57 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.8"/>
<path d="M30 50 L34 51.6 M30 52.4 L34 54 M30 54.8 L34 56.4" stroke="${GOLD}" stroke-width="0.8" opacity="0.85"/>
<!-- Pomo ornamentado -->
<path d="M32 57 L35.5 59.5 L32 63 L28.5 59.5 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<circle cx="32" cy="59.8" r="1.4" fill="url(#${id}-gem)"/>
</g>`;
}

function warglaiveTemplate(p: SvgTemplateParams): string {
  // Lâminas Gémeas de Azzinoth — ícone lendário do catálogo.
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Lâminas superiores em foice dupla -->
<path d="M32 30 C29 18 20 7 4 3 C7 13 14 23 26 30 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M32 30 C35 18 44 7 60 3 C57 13 50 23 38 30 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
<!-- Lâminas inferiores espelhadas -->
<path d="M32 34 C29 46 20 57 4 61 C7 51 14 41 26 34 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M32 34 C35 46 44 57 60 61 C57 51 50 41 38 34 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
<!-- Contrafios internos e gumes vivos -->
<path d="M28 28 C24 20 18 14 9 9 M36 28 C40 20 46 14 55 9" fill="none" stroke="#ffffff" stroke-width="0.7" opacity="0.5"/>
<path d="M28 36 C24 44 18 50 9 55 M36 36 C40 44 46 50 55 55" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.35"/>
<!-- Espinhos ósseos nas pontas -->
<path d="M4 3 L9 7 L3 8 Z M60 3 L55 7 L61 8 Z M4 61 L9 57 L3 56 Z M60 61 L55 57 L61 56 Z" fill="${GOLD_LIGHT}" stroke="${p.stroke}" stroke-width="0.6"/>
<!-- Runas vil nas lâminas -->
<path d="M15 12 L17 16 L15 20 M49 12 L47 16 L49 20" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.8"/>
<path d="M15 44 L17 48 L15 52 M49 44 L47 48 L49 52" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.7"/>
<!-- Punho central blindado -->
<circle cx="32" cy="32" r="8" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="1.2"/>
<circle cx="32" cy="32" r="6.4" fill="none" stroke="${GOLD}" stroke-width="1"/>
<path d="M32 27.5 C35 29 35.4 31 34.2 33 C35.6 35 34.8 36.8 32 37.5" fill="none" stroke="${p.stroke}" stroke-width="1"/>
<!-- Olho demoníaco -->
<ellipse cx="32" cy="32" rx="4.4" ry="2.8" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.7"/>
<path d="M32 29.4 L32 34.6" stroke="#0b0614" stroke-width="1.2"/>
<circle cx="30.6" cy="31" r="0.7" fill="#ffffff" opacity="0.9"/>
<!-- Correntes/osso sob o punho -->
<path d="M27 38 C25 42 25 46 27 50 M37 38 C39 42 39 46 37 50" fill="none" stroke="${GOLD_DARK}" stroke-width="1.1" opacity="0.8"/>
</g>`;
}

function axeTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Haste em madeira escura com reforços -->
<path d="M30 12 L34 12 L34 58 L30 58 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.8"/>
<path d="M30 22 L34 22 M30 34 L34 34 M30 46 L34 46" stroke="${GOLD}" stroke-width="1.2" opacity="0.9"/>
<path d="M31 14 L33 16 M31 26 L33 28 M31 38 L33 40 M31 50 L33 52" stroke="${GOLD_LIGHT}" stroke-width="0.6" opacity="0.6"/>
<!-- Lâminas gémeas em meia-lua -->
<path d="M30 7 C23 4 15 6 9 11 C11 19 16 27 24 31 C20 25 20 18 24 14 L30 16 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M34 7 C41 4 49 6 55 11 C53 19 48 27 40 31 C44 25 44 18 40 14 L34 16 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
<!-- Gumes dourados e barbas inferiores -->
<path d="M10 12 C14 18 18 23 24 27 M54 12 C50 18 46 23 40 27" fill="none" stroke="${GOLD_LIGHT}" stroke-width="0.9" opacity="0.8"/>
<path d="M24 28 L21 35 L27 31 Z M40 28 L43 35 L37 31 Z" fill="${GOLD}" stroke="${p.stroke}" stroke-width="0.7"/>
<!-- Espigão superior -->
<path d="M32 0 L36.5 7 L32 13 L27.5 7 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1"/>
<!-- Olho do machado -->
<circle cx="32" cy="16.5" r="4" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="0.9"/>
<circle cx="32" cy="16.5" r="2.4" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.6"/>
<circle cx="31.2" cy="15.7" r="0.7" fill="#ffffff" opacity="0.9"/>
<!-- Runas nas lâminas -->
<path d="M16 14 L18 17 L16 20 M48 14 L46 17 L48 20" fill="none" stroke="${GOLD}" stroke-width="0.9" opacity="0.85"/>
<!-- Pomo em lança -->
<path d="M32 57 L35 60 L32 64 L29 60 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7"/>
</g>`;
}

function spearTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Haste em madeira escura com virolas -->
<path d="M30.6 18 L33.4 18 L33.4 58 L30.6 58 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.7"/>
<path d="M30.6 24 L33.4 24 M30.6 38 L33.4 38 M30.6 50 L33.4 50" stroke="${GOLD}" stroke-width="1" opacity="0.9"/>
<!-- Lâmina em folha com nervura central -->
<path d="M32 0 L37 7 L38.6 14 L35 18.4 L32 19.6 L29 18.4 L25.4 14 L27 7 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
<path d="M32 2.4 L32 18.6" stroke="${p.stroke}" stroke-width="1.1" opacity="0.55"/>
<path d="M32 2.4 L32 18.6" stroke="#ffffff" stroke-width="0.35" opacity="0.5"/>
<!-- Barbatanas laterais em gancho -->
<path d="M28.6 12.5 C23 9.5 17.5 10 13.5 13 C18.5 16.4 24 17.6 29 16.6 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M35.4 12.5 C41 9.5 46.5 10 50.5 13 C45.5 16.4 40 17.6 35 16.6 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M14.4 13.4 L18 15.4 M49.6 13.4 L46 15.4" stroke="${GOLD_LIGHT}" stroke-width="0.7" opacity="0.8"/>
<!-- Virola dourada com gema -->
<path d="M26.5 19 L37.5 19 L36.5 23.5 L27.5 23.5 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<circle cx="32" cy="21.2" r="1.8" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.5"/>
<!-- Runas gravadas na haste -->
<path d="M32 28 L33.4 30 L32 32 L30.6 30 Z M32 44 L33.4 46 L32 48 L30.6 46 Z" fill="${GOLD}" opacity="0.8"/>
<!-- Conto em ponta de lança -->
<path d="M32 57.5 L35 60.5 L32 64 L29 60.5 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
</g>`;
}

function daggerTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Lâmina em presa com bisel -->
<path d="M32 1.5 L36.8 9.5 L36.2 26 L33.4 31 L30.6 31 L27.8 26 L27.2 9.5 Z" fill="url(#${id}-blade)" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
<path d="M32 5 L32 29.5" stroke="${p.stroke}" stroke-width="1.3" opacity="0.5"/>
<path d="M29.6 10 L30.6 27 M34.4 10 L33.4 27" stroke="#ffffff" stroke-width="0.4" opacity="0.4"/>
<!-- Contrafio serrilhado -->
<path d="M27.6 14 L29 15.2 L27.9 17 L29.2 18.4 L28.1 20.2" fill="none" stroke="${GOLD}" stroke-width="0.6" opacity="0.55"/>
<!-- Runa na base da lâmina -->
<path d="M32 20 L33.4 22 L32 24 L30.6 22 Z" fill="${GOLD_LIGHT}" opacity="0.9"/>
<!-- Guarda em chifres curvos -->
<path d="M20.5 31.6 C25 29.6 29 30.4 32 32.6 C35 30.4 39 29.6 43.5 31.6 C40.5 35.8 36 37.2 32 36.2 C28 37.2 23.5 35.8 20.5 31.6 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M20.5 31.6 L16.5 28.5 M43.5 31.6 L47.5 28.5" stroke="${GOLD_LIGHT}" stroke-width="0.9" stroke-linecap="round"/>
<circle cx="32" cy="32.4" r="2.2" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.6"/>
<!-- Punho em couro com fio dourado -->
<path d="M29.6 37 L34.4 37 L34 46.5 L30 46.5 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.7"/>
<path d="M30 39 L34 40.2 M30 41.4 L34 42.6 M30 43.8 L34 45" stroke="${GOLD}" stroke-width="0.7" opacity="0.85"/>
<!-- Pomo com gema em garra -->
<path d="M32 46 L36.4 49.6 L34.6 54.6 L29.4 54.6 L27.6 49.6 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<circle cx="32" cy="50.6" r="2.4" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.5"/>
<circle cx="31.2" cy="49.7" r="0.7" fill="#ffffff" opacity="0.9"/>
</g>`;
}

function staffTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Haste com empunhadura em couro -->
<path d="M30.6 21 L33.4 21 L33.4 59 L30.6 59 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.7"/>
<path d="M30.6 34 L33.4 34 M30.6 46 L33.4 46" stroke="${GOLD}" stroke-width="1" opacity="0.85"/>
<!-- Virola dourada -->
<path d="M27.8 23.5 L36.2 23.5 L35.4 26.6 L28.6 26.6 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
<!-- Crescente que abraça o cristal -->
<path d="M19.4 20.5 C16.6 9.5 24 2.6 32 2.6 C40 2.6 47.4 9.5 44.6 20.5 C43 13.6 38.6 9.4 32 9.4 C25.4 9.4 21 13.6 19.4 20.5 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M20.6 18.6 C22 11.4 26 7.4 32 7.4 C38 7.4 42 11.4 43.4 18.6" fill="none" stroke="${GOLD_LIGHT}" stroke-width="0.6" opacity="0.8"/>
<!-- Cristal arcano suspenso -->
<path d="M32 8 L37 14.6 L32 24.6 L27 14.6 Z" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<path d="M32 8 L32 24.6 M27 14.6 L37 14.6" stroke="#ffffff" stroke-width="0.4" opacity="0.45"/>
<!-- Fragmentos flutuantes -->
<path d="M15 9 L17.4 12 L15 15 L12.6 12 Z M49 9 L51.4 12 L49 15 L46.6 12 Z" fill="${GOLD_LIGHT}" opacity="0.9"/>
<circle cx="32" cy="1.6" r="1.3" fill="${p.fill}" opacity="0.9"/>
<!-- Conto ornamentado -->
<path d="M28 58.5 L36 58.5 L34.6 62.4 L29.4 62.4 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
</g>`;
}

function bowTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Limbo superior com reforço metálico -->
<path d="M33 2 C24 8 17 16 15.6 25 C14.8 31 17.6 36 22 39.4" fill="none" stroke="url(#${id}-metal)" stroke-width="3.2" stroke-linecap="round"/>
<path d="M33 2 C24 8 17 16 15.6 25 C14.8 31 17.6 36 22 39.4" fill="none" stroke="${GOLD}" stroke-width="0.8" opacity="0.7"/>
<!-- Limbo inferior espelhado -->
<path d="M33 62 C24 56 17 48 15.6 39 C14.8 33 17.6 28 22 24.6" fill="none" stroke="url(#${id}-metal)" stroke-width="3.2" stroke-linecap="round"/>
<path d="M33 62 C24 56 17 48 15.6 39 C14.8 33 17.6 28 22 24.6" fill="none" stroke="${GOLD}" stroke-width="0.8" opacity="0.7"/>
<!-- Corda -->
<path d="M33 2 L33 32 L33 62" fill="none" stroke="#e2e8f0" stroke-width="0.7" opacity="0.8"/>
<!-- Empunhadura em couro -->
<path d="M22 24.6 C24.6 22.6 26.6 22.4 28.4 23.4 L28.4 40.6 C26.6 41.6 24.6 41.4 22 39.4 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M23.4 27 L27 28.6 M23.4 30.4 L27 32 M23.4 33.8 L27 35.4 M23.4 37.2 L27 38.8" stroke="${GOLD}" stroke-width="0.7" opacity="0.85"/>
<!-- Pontas ornamentadas -->
<path d="M33 2 L30.6 0 L35.8 1.2 Z M33 62 L30.6 64 L35.8 62.8 Z" fill="${GOLD_LIGHT}" stroke="${p.stroke}" stroke-width="0.5" stroke-linejoin="round"/>
<!-- Espigões de limbo -->
<path d="M16.6 25 L13 22.6 L13.6 27.6 Z M16.6 39 L13 41.4 L13.6 36.4 Z" fill="${GOLD}" stroke="${p.stroke}" stroke-width="0.5" stroke-linejoin="round"/>
<!-- Gema no punho -->
<circle cx="25.4" cy="32" r="2.6" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.6"/>
<circle cx="24.6" cy="31.2" r="0.8" fill="#ffffff" opacity="0.9"/>
</g>`;
}

function maceTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Haste em couro -->
<path d="M30.6 24 L33.4 24 L33.4 59 L30.6 59 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.7"/>
<path d="M30.6 38 L33.4 38 M30.6 48 L33.4 48" stroke="${GOLD}" stroke-width="1" opacity="0.85"/>
<!-- Cabeça flangeda em estrela -->
<path d="M32 1 L36 6 L42 5.4 L44.6 10.6 L49.6 13.6 L48.4 19.6 L50 25 L45 27.6 L40.6 31.4 L35.4 29.4 L32 31.6 L28.6 29.4 L23.4 31.4 L19 27.6 L14 25 L15.6 19.6 L14.4 13.6 L19.4 10.6 L22 5.4 L28 6 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="1.1" stroke-linejoin="round"/>
<!-- Arestas dos flanges -->
<path d="M32 3 L32 30 M17 12 L47 25 M47 12 L17 25" stroke="${p.stroke}" stroke-width="0.6" opacity="0.45"/>
<path d="M32 3 L32 30" stroke="#ffffff" stroke-width="0.4" opacity="0.4"/>
<!-- Banda dourada e gema central -->
<circle cx="32" cy="17" r="6.4" fill="none" stroke="url(#${id}-gold)" stroke-width="1.3"/>
<circle cx="32" cy="17" r="4.4" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.8"/>
<circle cx="30.6" cy="15.6" r="1" fill="#ffffff" opacity="0.9"/>
<!-- Rebites dourados -->
<circle cx="32" cy="5.4" r="1" fill="${GOLD_LIGHT}"/>
<circle cx="20" cy="11" r="0.9" fill="${GOLD_LIGHT}" opacity="0.9"/>
<circle cx="44" cy="11" r="0.9" fill="${GOLD_LIGHT}" opacity="0.9"/>
<circle cx="20" cy="23" r="0.9" fill="${GOLD_LIGHT}" opacity="0.8"/>
<circle cx="44" cy="23" r="0.9" fill="${GOLD_LIGHT}" opacity="0.8"/>
<!-- Pomo -->
<path d="M32 58 L35.4 60.6 L32 64 L28.6 60.6 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
</g>`;
}

function grimoireTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Capa do tomo -->
<path d="M16 14 L46 14 L48 18 L48 50 L46 54 L16 54 L14 50 L14 18 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.4" stroke-linejoin="round"/>
<!-- Lombada em couro -->
<path d="M16 14 L22 14 L22 54 L16 54 L14 50 L14 18 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M18.4 20 L18.4 48 M20.4 20 L20.4 48" stroke="${p.stroke}" stroke-width="0.5" opacity="0.5"/>
<!-- Páginas -->
<path d="M24 16.4 L24 51.6 L45 51.6 L45 16.4 Z" fill="#f8fafc" opacity="0.18"/>
<path d="M26 17.8 L26 50.2 M27.6 17.8 L27.6 50.2" stroke="#f8fafc" stroke-width="0.5" opacity="0.45"/>
<!-- Cantos dourados -->
<path d="M14 18 L20 14 L25 17.6 M48 18 L42 14 L37 17.6 M14 50 L20 54 L25 50.4 M48 50 L42 54 L37 50.4" fill="none" stroke="url(#${id}-gold)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
<!-- Sigilo arcano -->
<circle cx="35.5" cy="33" r="8" fill="none" stroke="${GOLD}" stroke-width="0.9"/>
<path d="M35.5 25 L42.4 37.6 L28.6 37.6 Z" fill="none" stroke="${GOLD_LIGHT}" stroke-width="0.9"/>
<circle cx="35.5" cy="33" r="3.2" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.6"/>
<circle cx="34.6" cy="32.1" r="0.9" fill="#ffffff" opacity="0.9"/>
<!-- Fecho metálico -->
<path d="M45 30.6 L48.6 30.6 L48.6 35.4 L45 35.4 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.6" stroke-linejoin="round"/>
</g>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Armor / Helmet / Shield Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function armorTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Ombros blindados -->
<path d="M18 18 C12 15 5 19 6 26 C9 31 16 32 21 27 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M46 18 C52 15 59 19 58 26 C55 31 48 32 43 27 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M8 22 C12 21 16 22 19 25 M56 22 C52 21 48 22 45 25" fill="none" stroke="${GOLD}" stroke-width="1" stroke-linecap="round"/>
<!-- Peitoral -->
<path d="M22 17 L32 13 L42 17 L45 28 L42 42 L32 50 L22 42 L19 28 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M32 13 L32 50" stroke="${p.stroke}" stroke-width="0.8" opacity="0.4"/>
<path d="M23.6 20 L32 15.6 L40.4 20" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.9"/>
<path d="M24 32 C28 35 36 35 40 32 M24.6 37 C28.4 40 35.6 40 39.4 37" fill="none" stroke="${p.stroke}" stroke-width="0.8" opacity="0.5"/>
<!-- Gema peitoral em engaste dourado -->
<circle cx="32" cy="24" r="4.2" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.9"/>
<circle cx="30.8" cy="22.8" r="1" fill="#ffffff" opacity="0.9"/>
<path d="M32 19 L35 22 L32 25 L29 22 Z" fill="none" stroke="${GOLD_LIGHT}" stroke-width="0.5" opacity="0.8"/>
<!-- Cinturão -->
<path d="M21 43 L43 43 L42 47 L22 47 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<path d="M29 42.6 L35 42.6 L35 47.4 L29 47.4 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.6"/>
<!-- Saiote -->
<path d="M22 47 L26 56 L32 53 L38 56 L42 47 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round" opacity="0.9"/>
<path d="M28 48 L27 54 M36 48 L37 54" stroke="${p.stroke}" stroke-width="0.6" opacity="0.5"/>
</g>`;
}

function robeTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Veste longa com cauda -->
<path d="M22 14 L32 8 L42 14 L46 32 L50 58 L38 60 L32 52 L26 60 L14 58 L18 32 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
<!-- Colarinho alto -->
<path d="M22 14 L32 8 L42 14 L38 18 L32 14 L26 18 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="0.9" stroke-linejoin="round"/>
<!-- Fendas e dobras -->
<path d="M32 18 L32 52" stroke="${p.stroke}" stroke-width="1.1" opacity="0.5"/>
<path d="M24 24 C23 36 21 46 20 55 M40 24 C41 36 43 46 44 55" fill="none" stroke="${p.stroke}" stroke-width="0.7" opacity="0.4"/>
<path d="M28 54 L32 50 L36 54" fill="none" stroke="${GOLD}" stroke-width="0.8" opacity="0.6"/>
<!-- Faixa na cintura -->
<path d="M21 34 L43 34 L42 38 L22 38 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<!-- Broche arcano -->
<circle cx="32" cy="22" r="3.4" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.8"/>
<circle cx="31.1" cy="21.1" r="0.9" fill="#ffffff" opacity="0.9"/>
<!-- Orlas douradas -->
<path d="M14 56 L26 54 M50 56 L38 54" stroke="${GOLD}" stroke-width="0.9" opacity="0.8"/>
</g>`;
}

function helmetTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Plumas -->
<path d="M32 6 C36 2 42 2 45 6 C40 5 35 7 32 11 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.7" opacity="0.9"/>
<!-- Cúpula -->
<path d="M18 34 L18 24 C18 12 46 12 46 24 L46 34 L40 38 L24 38 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
<path d="M32 12 L32 38" stroke="${p.stroke}" stroke-width="0.8" opacity="0.35"/>
<!-- Crista dourada -->
<path d="M18 26 C24 22 40 22 46 26" fill="none" stroke="url(#${id}-gold)" stroke-width="2" stroke-linecap="round"/>
<!-- Fenda do visor -->
<path d="M22 29 L42 29 L41 33 L23 33 Z" fill="#090d16" opacity="0.9"/>
<path d="M25 31 L31 31 M33 31 L39 31" stroke="${p.fill}" stroke-width="0.7" opacity="0.9"/>
<path d="M23 28 L41 28" stroke="${GOLD_LIGHT}" stroke-width="0.5" opacity="0.7"/>
<!-- Guardas de bochecha -->
<path d="M20 34 L26 36 L26 44 L21 42 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<path d="M44 34 L38 36 L38 44 L43 42 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<!-- Rebites -->
<circle cx="22" cy="22" r="0.9" fill="${GOLD_LIGHT}"/>
<circle cx="42" cy="22" r="0.9" fill="${GOLD_LIGHT}"/>
<circle cx="32" cy="20" r="0.9" fill="${GOLD_LIGHT}" opacity="0.9"/>
<!-- Espigão superior -->
<path d="M32 12 L35 5 L32 1 L29 5 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
</g>`;
}

function hoodTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Capuz com dobras -->
<path d="M16 40 C16 16 26 8 32 6 C38 8 48 16 48 40 L40 44 L32 42 L24 44 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M22 36 C24 20 28 12 32 10 M42 36 C40 20 36 12 32 10" fill="none" stroke="${p.stroke}" stroke-width="0.7" opacity="0.45"/>
<path d="M18 34 C14 40 14 46 16 50 M46 34 C50 40 50 46 48 50" fill="none" stroke="${p.stroke}" stroke-width="1" opacity="0.7"/>
<!-- Sombra interna -->
<path d="M22 30 C24 38 40 38 42 30 Z" fill="#090d16" opacity="0.95"/>
<!-- Olhos brilhantes -->
<circle cx="28" cy="32" r="1.6" fill="#38bdf8"/>
<circle cx="36" cy="32" r="1.6" fill="#38bdf8"/>
<circle cx="28" cy="32" r="3" fill="#38bdf8" opacity="0.25"/>
<circle cx="36" cy="32" r="3" fill="#38bdf8" opacity="0.25"/>
<!-- Fivela dourada -->
<path d="M28 42.6 L36 42.6 L35.2 46.4 L28.8 46.4 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
</g>`;
}

function shieldTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Corpo do escudo -->
<path d="M32 3 L50 11 L50 32 C50 48 32 61 32 61 C32 61 14 48 14 32 L14 11 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="1.8" stroke-linejoin="round"/>
<!-- Borda dourada -->
<path d="M32 6 L47 13 L47 32 C47 45 34 56 32 57.6 C30 56 17 45 17 32 L17 13 Z" fill="none" stroke="url(#${id}-gold)" stroke-width="1.6" stroke-linejoin="round"/>
<!-- Quartéis gravados -->
<path d="M32 6 L47 13 L47 32 C47 45 34 56 32 57.6 Z" fill="${p.stroke}" opacity="0.18"/>
<path d="M32 6 L32 57.6" stroke="${p.stroke}" stroke-width="0.7" opacity="0.35"/>
<path d="M17 32 L47 32" stroke="${p.stroke}" stroke-width="0.7" opacity="0.35"/>
<!-- Umbo central com gema -->
<circle cx="32" cy="30" r="8" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="1.1"/>
<circle cx="32" cy="30" r="6" fill="none" stroke="${GOLD}" stroke-width="0.9"/>
<circle cx="32" cy="30" r="3.4" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.7"/>
<circle cx="30.9" cy="28.9" r="0.9" fill="#ffffff" opacity="0.9"/>
<path d="M32 22 L32 38 M24 30 L40 30" stroke="${GOLD_LIGHT}" stroke-width="0.6" opacity="0.7"/>
<!-- Asas ornamentais -->
<path d="M14 11 C9 10 5 14 6 20 C10 18 14 17 17 18 M50 11 C55 10 59 14 58 20 C54 18 50 17 47 18" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round" opacity="0.9"/>
<!-- Rebites -->
<circle cx="21" cy="16" r="0.9" fill="${GOLD_LIGHT}"/>
<circle cx="43" cy="16" r="0.9" fill="${GOLD_LIGHT}"/>
<circle cx="21" cy="47" r="0.8" fill="${GOLD_LIGHT}" opacity="0.8"/>
<circle cx="43" cy="47" r="0.8" fill="${GOLD_LIGHT}" opacity="0.8"/>
</g>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cloak / Boots / Accessory / Body Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function cloakTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Capa drapeada -->
<path d="M22 14 L32 12 L42 14 C50 26 54 42 56 60 L42 58 L32 52 L22 58 L8 60 C10 42 14 26 22 14 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.4" stroke-linejoin="round"/>
<!-- Forro interior -->
<path d="M32 18 C40 26 45 40 47 55 L32 50 Z" fill="${p.stroke}" opacity="0.15"/>
<!-- Dobras -->
<path d="M26 18 C24 30 22 44 21 57 M38 18 C40 30 42 44 43 57" fill="none" stroke="${p.stroke}" stroke-width="0.8" opacity="0.45"/>
<!-- Gola de pele -->
<path d="M20 14 C24 8 40 8 44 14 C40 12 36 11 32 11 C28 11 24 12 20 14 Z" fill="url(#${id}-leather)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<!-- Fecho dourado -->
<circle cx="32" cy="15.4" r="3.2" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.8"/>
<circle cx="32" cy="15.4" r="1.6" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.5"/>
<!-- Orla dourada -->
<path d="M9.4 58.8 C12 46 15.4 32 21 21 M54.6 58.8 C52 46 48.6 32 43 21" fill="none" stroke="${GOLD}" stroke-width="0.9" opacity="0.75"/>
</g>`;
}

function bootsTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Bota esquerda -->
<path d="M17 14 L27 14 L25.6 34 L31 43 L15 43 L15 26 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M17 14 L27 14 L26.6 20 L16.6 20 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
<path d="M15.4 39 L31 39 L31 43.4 L15 43.4 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
<path d="M16.6 26 L25.4 26 M16.2 31 L26 31" stroke="${p.stroke}" stroke-width="0.7" opacity="0.5"/>
<!-- Bota direita -->
<path d="M47 14 L37 14 L38.4 34 L33 43 L49 43 L49 26 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M47 14 L37 14 L37.4 20 L47.4 20 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
<path d="M48.6 39 L33 39 L33 43.4 L49 43.4 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7" stroke-linejoin="round"/>
<path d="M47.4 26 L38.6 26 M47.8 31 L38 31" stroke="${p.stroke}" stroke-width="0.7" opacity="0.5"/>
<!-- Fivelas -->
<circle cx="21" cy="28.5" r="1.4" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.5"/>
<circle cx="43" cy="28.5" r="1.4" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.5"/>
</g>`;
}

function amuletTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Corrente dourada -->
<path d="M18 14 Q32 30 46 14" fill="none" stroke="url(#${id}-gold)" stroke-width="1.6"/>
<circle cx="18" cy="14" r="1.2" fill="${GOLD_LIGHT}"/>
<circle cx="46" cy="14" r="1.2" fill="${GOLD_LIGHT}"/>
<path d="M24 19 Q32 26 40 19" fill="none" stroke="${p.stroke}" stroke-width="0.5" opacity="0.4"/>
<!-- Engaste em garra -->
<path d="M32 26 L41 33 L38 45 L26 45 L23 33 Z" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
<path d="M32 27 L38 33 L35.6 42 L28.4 42 L26 33 Z" fill="${p.stroke}" opacity="0.35"/>
<!-- Gema facetada -->
<path d="M32 29 L37 34.6 L32 41.6 L27 34.6 Z" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.8" stroke-linejoin="round"/>
<path d="M32 29 L32 41.6 M27 34.6 L37 34.6" stroke="#ffffff" stroke-width="0.4" opacity="0.4"/>
<circle cx="30.9" cy="33.4" r="0.8" fill="#ffffff" opacity="0.9"/>
<!-- Pingente -->
<circle cx="32" cy="47.6" r="1.4" fill="${GOLD_LIGHT}" opacity="0.9"/>
</g>`;
}

function heroBodyTemplate(p: SvgTemplateParams): string {
  return `<g${filterAttr(p)}>
${glowFilter(p)}
<!-- Cabeça -->
<ellipse cx="32" cy="12.5" rx="6.2" ry="7.2" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.1"/>
<path d="M25.8 11 C26 5.4 30 3 32 3 C34 3 38 5.4 38.2 11 C36.4 8.6 34.4 7.6 32 7.6 C29.6 7.6 27.6 8.6 25.8 11 Z" fill="${p.stroke}" opacity="0.55"/>
<!-- Pescoço -->
<path d="M29.6 18.6 L34.4 18.6 L34.4 22.4 L29.6 22.4 Z" fill="${p.fill}" opacity="0.9"/>
<!-- Tronco -->
<path d="M23 22 C26 20.6 30 20 32 20 C34 20 38 20.6 41 22 L40 34 L37 40 L27 40 L24 34 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.1" stroke-linejoin="round"/>
<path d="M32 21.6 L32 39" stroke="${p.stroke}" stroke-width="0.6" opacity="0.3"/>
<!-- Braços -->
<path d="M23.6 23.4 C20 26 17.6 30 16.6 35.4" fill="none" stroke="${p.fill}" stroke-width="3.6" stroke-linecap="round"/>
<path d="M40.4 23.4 C44 26 46.4 30 47.4 35.4" fill="none" stroke="${p.fill}" stroke-width="3.6" stroke-linecap="round"/>
<path d="M23.6 23.4 C20 26 17.6 30 16.6 35.4" fill="none" stroke="${p.stroke}" stroke-width="0.7" opacity="0.6"/>
<path d="M40.4 23.4 C44 26 46.4 30 47.4 35.4" fill="none" stroke="${p.stroke}" stroke-width="0.7" opacity="0.6"/>
<circle cx="16.4" cy="36.6" r="2" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8"/>
<circle cx="47.6" cy="36.6" r="2" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.8"/>
<!-- Pernas -->
<path d="M27.4 39.6 L26.2 54" fill="none" stroke="${p.fill}" stroke-width="4.4" stroke-linecap="round"/>
<path d="M36.6 39.6 L37.8 54" fill="none" stroke="${p.fill}" stroke-width="4.4" stroke-linecap="round"/>
<path d="M27.4 39.6 L26.2 54 M36.6 39.6 L37.8 54" stroke="${p.stroke}" stroke-width="0.7" opacity="0.55"/>
<!-- Botas -->
<path d="M23.4 53.4 L29 53.4 L29.4 59.4 L23 59.4 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
<path d="M35 53.4 L40.6 53.4 L41 59.4 L34.6 59.4 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" stroke-linejoin="round"/>
</g>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Aura & Wings Templates
 * ──────────────────────────────────────────────────────────────────────────── */

function auraTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Anéis de energia -->
<ellipse cx="32" cy="32" rx="28" ry="28" fill="none" stroke="${p.fill}" stroke-width="1.2" opacity="0.35"/>
<ellipse cx="32" cy="32" rx="23" ry="23" fill="none" stroke="${p.fill}" stroke-width="0.9" opacity="0.28" stroke-dasharray="4 3"/>
<ellipse cx="32" cy="32" rx="17" ry="17" fill="url(#${id}-gem)" opacity="0.14"/>
<ellipse cx="32" cy="32" rx="11" ry="11" fill="${p.fill}" opacity="0.12"/>
<!-- Runas orbitais -->
<path d="M32 5 L33.6 7 L32 9 L30.4 7 Z M32 55 L33.6 57 L32 59 L30.4 57 Z M5 32 L7 33.6 L5 35.2 L3 33.6 Z M61 32 L59 33.6 L61 35.2 L63 33.6 Z" fill="${p.fill}" opacity="0.7"/>
<!-- Faíscas -->
<circle cx="18" cy="14" r="2.2" fill="${p.fill}" opacity="0.6"/>
<circle cx="46" cy="12" r="1.8" fill="${p.fill}" opacity="0.5"/>
<circle cx="12" cy="38" r="2" fill="${p.fill}" opacity="0.45"/>
<circle cx="50" cy="42" r="2.2" fill="${p.fill}" opacity="0.5"/>
<circle cx="26" cy="52" r="1.4" fill="${p.fill}" opacity="0.4"/>
<circle cx="40" cy="54" r="1.8" fill="${p.fill}" opacity="0.45"/>
<circle cx="22" cy="44" r="1.2" fill="${p.fill}" opacity="0.35"/>
</g>`;
}

function wingsTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Asa esquerda: camadas de penas -->
<path d="M32 32 L6 8 C2 4 4 16 8 22 L18 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" opacity="0.9"/>
<path d="M32 32 L2 18 C0 14 4 24 10 28 L22 34 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="0.8" opacity="0.85"/>
<path d="M32 32 L8 28 C6 26 8 32 14 34 L26 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.6" opacity="0.7"/>
<path d="M32 32 L14 12 M32 32 L10 22" stroke="${GOLD}" stroke-width="0.6" opacity="0.5"/>
<!-- Asa direita -->
<path d="M32 32 L58 8 C62 4 60 16 56 22 L46 30 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1" opacity="0.9"/>
<path d="M32 32 L62 18 C64 14 60 24 54 28 L42 34 Z" fill="url(#${id}-metal)" stroke="${p.stroke}" stroke-width="0.8" opacity="0.85"/>
<path d="M32 32 L56 28 C58 26 56 32 50 34 L38 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="0.6" opacity="0.7"/>
<path d="M32 32 L50 12 M32 32 L54 22" stroke="${GOLD}" stroke-width="0.6" opacity="0.5"/>
<!-- Articulação central -->
<circle cx="32" cy="32" r="3.4" fill="url(#${id}-gold)" stroke="${p.stroke}" stroke-width="0.7"/>
<circle cx="32" cy="32" r="1.4" fill="url(#${id}-gem)"/>
</g>`;
}

function demonWingsTemplate(p: SvgTemplateParams): string {
  const id = svgUid(p);
  return `<g${filterAttr(p)}>
${glowFilter(p)}
${gradients(p)}
<!-- Membrana esquerda -->
<path d="M32 32 L4 12 C8 24 12 36 22 42 C14 36 8 38 4 44 C12 46 22 44 32 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
<!-- Membrana direita -->
<path d="M32 32 L60 12 C56 24 52 36 42 42 C50 36 56 38 60 44 C52 46 42 44 32 36 Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
<!-- Nervuras -->
<path d="M32 32 L8 20 M32 32 L12 34 M32 32 L20 41 M32 32 L56 20 M32 32 L52 34 M32 32 L44 41" stroke="${p.stroke}" stroke-width="0.7" opacity="0.5"/>
<path d="M4 12 L10 18 M60 12 L54 18" stroke="${GOLD_DARK}" stroke-width="0.8" opacity="0.8"/>
<!-- Garras ósseas -->
<path d="M4 12 L1 7 L7 10 Z M60 12 L63 7 L57 10 Z" fill="${GOLD_LIGHT}" stroke="${p.stroke}" stroke-width="0.6" stroke-linejoin="round"/>
<path d="M4 44 L1 49 L7 46 Z M60 44 L63 49 L57 46 Z" fill="${GOLD_LIGHT}" stroke="${p.stroke}" stroke-width="0.6" stroke-linejoin="round"/>
<!-- Gema no dorso -->
<circle cx="32" cy="32" r="3.2" fill="url(#${id}-gem)" stroke="${p.stroke}" stroke-width="0.7"/>
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
  ['warglaive', 'warglaive'],
  ['glaive', 'warglaive'],
  ['azzinoth', 'warglaive'],
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
