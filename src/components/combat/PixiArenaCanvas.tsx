'use client';

/**
 * PixiArenaCanvas — palco de batalha em WebGL (PixiJS v8), estilo Ragnarök Mobile.
 *
 * Toda a camada MUNDO vive aqui dentro do canvas:
 *  · cenário pintado uma vez por bioma num canvas offscreen (céu, nebulosa,
 *    lua, 3 cordilheiras, chão com banding, poça de luz, pedras, tufos, vinheta);
 *  · unidades em `Container` por combatente — heróis com Paperdoll modular
 *    (corpo da raça + arma raster/vetorial com glow de raridade), monstros
 *    como glifos com aura elementar;
 *  · nameplates MMO (nome + badge de nível + barras de HP/Escudo/Mana/Turno)
 *    desenhados em Graphics — moldura metálica, gloss e fill por percentual;
 *  · floats de combate, lunge/flash de impacto e bob de idle como tweens no
 *    ticker — zero renders React por frame.
 *
 * O que fica em DOM: banner de transição, pulso de chefe e a Skill Bar
 * (`HeroSkillBar`) — HUD, não mundo.
 *
 * O estado do motor chega via props a cada tick; o componente espelha tudo em
 * refs e o ticker do Pixi lê essas refs — o React só renderiza quando o motor
 * renderiza, nunca a 60 fps por conta própria.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColorMatrixFilter, Container, Graphics, Text, Texture, TextStyleOptions } from 'pixi.js';

import { ARENA_OVERLAY_KEYFRAMES } from '@/components/combat/arena-overlays';
import { HeroSkillBar } from '@/components/combat/HeroSkillBar';
import { useFloatingText, type FloatKind } from '@/hooks/useFloatingText';
import {
  ENEMY_LANE_BASE,
  HERO_LANE_BASE,
  biomeLabel,
  monsterGlyphFor,
  parseRgbColor,
  percent,
  place,
  toPixiColor,
  turnPercent,
  type ArenaViewProps,
  type Slot,
} from '@/components/combat/arena-shared';
import { artRectFor, RARITY_COLOR } from '@/data/paperdoll-layers';
import { BASE_CLASSES } from '@/data/classes';
import { ITEM_BY_ID } from '@/data/items';
import { RACE_BY_ID } from '@/data/races';
import { BIOME_BY_ID, MONSTER_BY_ID } from '@/data/tower';
import { emptyEquipment } from '@/lib/game/actors';
import { highestRarity, resolvePaperdoll } from '@/lib/game/paperdoll';
import { frontmostLine } from '@/lib/game/target';
import { getParametricSvgForLayer } from '@/lib/sprite-lab/svg-templates';
import type { EnemyCombatant, EquipmentLoadout, PlayerCombatant, Uuid } from '@/types/game';

const NO_LOADOUTS: Readonly<Record<Uuid, EquipmentLoadout>> = {};
const EMPTY_LOADOUT = emptyEquipment();

/* ==========================================================================
 * CONSTANTES DO MUNDO
 * ========================================================================== */

/** Largura visual do herói no palco (o canvas 256 do Paperdoll escala para isto). */
const DOLL_WIDTH = 160;
const DOLL_SCALE = DOLL_WIDTH / 256;
/** Canvas do Paperdoll: pés em y=202.5 (rect do corpo {32,24,192}). */
const DOLL_FEET_Y = 202.5;

/**
 * Escala de profundidade por lane — a lane de trás assenta no platô elevado
 * do cenário (mais longe da câmara), logo os avatares lá são ligeiramente
 * menores; a frente fica a escala integral no ringue de combate.
 */
const LANE_DEPTH_SCALE: Readonly<Record<'front' | 'mid' | 'back', number>> = {
  front: 1,
  mid: 0.93,
  back: 0.86,
};

/** Tamanho do canvas offscreen do cenário (esticado ao palco). */
const BACKDROP_W = 1280;
const BACKDROP_H = 720;

const FALLBACK_PALETTE = { sky: '#1e3a5f', ground: '#14532d', accent: '#4ade80' } as const;

/** Cores dos floats — hex fixo, sem variáveis CSS (Pixi não resolve var()). */
const FLOAT_COLOR: Readonly<Record<FloatKind, number>> = {
  damage: 0xffffff,
  crit: 0xfbbf24,
  miss: 0x94a3b8,
  heal: 0x34d399,
  shield: 0x7dd3fc,
  death: 0xf87171,
  skill: 0xc4b5fd,
};

const FLOAT_SIZE: Readonly<Record<FloatKind, number>> = {
  damage: 15,
  crit: 25,
  miss: 12,
  heal: 16,
  shield: 13,
  death: 18,
  skill: 12,
};

const FONT_MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
const FONT_SANS = 'system-ui, "Segoe UI", sans-serif';
const FONT_EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

/* ==========================================================================
 * CACHE DE TEXTURAS — módulo-level, sobrevive a remounts (StrictMode)
 * ========================================================================== */

const texturePromises = new Map<string, Promise<Texture | null>>();

function loadTexture(cacheKey: string, loader: () => Promise<Texture | null>): Promise<Texture | null> {
  const existing = texturePromises.get(cacheKey);
  if (existing) return existing;
  const promise = loader().catch(() => null);
  texturePromises.set(cacheKey, promise);
  return promise;
}

/** PNG raster de `/assets/sprites/**` — Assets.load deduplica por URL. */
function loadRasterTexture(url: string): Promise<Texture | null> {
  return loadTexture(`raster:${url}`, async () => {
    const P = await import('pixi.js');
    return P.Assets.load<Texture>(url);
  });
}

/** SVG paramétrico do Paperdoll → data URI → Texture (fallback vetorial). */
function loadSvgTexture(cacheKey: string, svg: string): Promise<Texture | null> {
  return loadTexture(`svg:${cacheKey}`, async () => {
    const P = await import('pixi.js');
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    return P.Texture.from(image);
  });
}

/* ==========================================================================
 * COMPONENTE
 * ========================================================================== */

interface UnitView {
  readonly id: Uuid;
  readonly kind: 'hero' | 'enemy';
  readonly root: Container;
  readonly bodyWrap: Container;
  readonly avatar: Container;
  readonly flashFilter: ColorMatrixFilter;
  readonly toneFilter: ColorMatrixFilter;
  readonly plate: PlateView;
  readonly dir: 1 | -1;
  readonly lungeDistance: number;
  /** Sombra de contacto nos pés — segue o lunge e respira com o bob. */
  readonly shadow: Graphics;
  /** Escala de profundidade da lane (frente 1, lanes recuadas menores). */
  readonly depthScale: number;
  readonly unitTop: number;
  readonly floatBaseY: number;
  bobPhase: number;
  dollKey: string;
  deathAt: number | null;
  lastAlive: boolean;
  rarityColor: number | null;
}

interface PlateBar {
  readonly frame: Graphics;
  readonly fill: Graphics;
}

interface PlateView {
  readonly root: Container;
  setHeader(
    name: string,
    tag: string,
    tagColor: number,
    level: number,
    focused: boolean,
    enemy: boolean,
    boss: boolean,
  ): void;
  update(
    unitTop: number,
    hp: number,
    shield: number,
    mp: number,
    turn: number,
    focused: boolean,
    alive: boolean,
    effects: readonly string[],
    dots: readonly boolean[],
    reducedMotion: boolean,
    now: number,
  ): void;
}

export function PixiArenaCanvas({
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
  const [casts, setCasts] = useState<Readonly<Record<string, number>>>({});
  const [transition, setTransition] = useState<{ kind: 'wave' | 'floor'; label: string; at: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousWaveRef = useRef<number>(wave);

  /* Refs espelho — o ticker do Pixi lê daqui, sem renders React por frame. */
  const stateRef = useRef(state);
  stateRef.current = state;
  const floatsRef = useRef(floats);
  floatsRef.current = floats;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const biomeRef = useRef(biome);
  biomeRef.current = biome;
  const equipmentRef = useRef(equipmentByCharacterId);
  equipmentRef.current = equipmentByCharacterId;
  const lungesRef = useRef<Record<Uuid, number>>({});
  const hitsRef = useRef<Record<Uuid, number>>({});

  // 1. Drena eventos do motor → floats + stamps de lunge/flash/cast.
  useEffect(() => {
    const events = onDrainEvents();
    if (events.length === 0) return;
    push(events);

    const now = Date.now();
    const nextLunges = { ...lungesRef.current };
    const nextHits = { ...hitsRef.current };
    let lungesChanged = false;
    let hitsChanged = false;

    for (const event of events) {
      if (event.type === 'damage' || event.type === 'skill_cast') {
        nextLunges[event.sourceId] = now;
        lungesChanged = true;
      }
      if ((event.type === 'damage' && !event.isMiss) || event.type === 'shield') {
        nextHits[event.targetId] = now;
        hitsChanged = true;
      }
    }
    if (lungesChanged) lungesRef.current = nextLunges;
    if (hitsChanged) hitsRef.current = nextHits;

    if (events.some((event) => event.type === 'skill_cast')) {
      setCasts((previous) => {
        const next = { ...previous };
        for (const event of events) {
          if (event.type === 'skill_cast') next[event.skillId] = now;
        }
        return next;
      });
    }
  }, [state.elapsedSec, onDrainEvents, push]);

  // 2. Transições: wave nova ou andar novo.
  useEffect(() => {
    if (wave !== previousWaveRef.current) {
      previousWaveRef.current = wave;
      setTransition({ kind: 'wave', label: wave === totalWaves && isBossFloor ? 'CHEFE' : `WAVE ${wave}`, at: Date.now() });
    }
  }, [wave, totalWaves, isBossFloor]);

  useEffect(() => {
    setTransition({ kind: 'floor', label: `${floorName.toUpperCase()} · ${biomeLabel(biome)}`, at: Date.now() });
  }, [floorName, biome]);

  /* Heróis/monstros para o HUD DOM e o pulso de chefe. */
  const heroes = useMemo(
    () => state.combatants.filter((actor): actor is PlayerCombatant => actor.team === 'squad'),
    [state.combatants],
  );
  const enemies = useMemo(
    () => state.combatants.filter((actor): actor is EnemyCombatant => actor.team === 'enemy'),
    [state.combatants],
  );
  const boss = enemies.find((enemy) => enemy.tier === 'boss' && enemy.hp > 0) ?? null;

  const palette = BIOME_BY_ID.get(biome)?.palette ?? FALLBACK_PALETTE;
  const transitionVisible = transition !== null && Date.now() - transition.at < 1400;

  /* ════════════════════════════════════════════════════════════════════
   * MOTOR PIXI — inicializa uma vez; o ticker sincroniza com as refs.
   * ════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    let dispose: (() => void) | null = null;

    void (async () => {
      const P = await import('pixi.js');
      if (cancelled) return;

      const app = new P.Application();
      try {
        await app.init({
          resizeTo: container,
          antialias: true,
          backgroundAlpha: 0,
          preference: 'webgl',
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
      } catch {
        // WebGL indisponível — mantém só o HUD DOM (banner + skill bar).
        return;
      }
      if (cancelled) {
        app.destroy({ removeView: true }, { children: true });
        return;
      }

      /* ── Cenário ────────────────────────────────────────────────────── */
      const backdropCanvas = document.createElement('canvas');
      backdropCanvas.width = BACKDROP_W;
      backdropCanvas.height = BACKDROP_H;
      const backdropCtx = backdropCanvas.getContext('2d');
      const backdropTexture = P.Texture.from(backdropCanvas);
      const backdrop = new P.Sprite(backdropTexture);
      backdrop.zIndex = 0;

      const paintBackdrop = (biomeId: string): void => {
        if (!backdropCtx) return;
        const p = BIOME_BY_ID.get(biomeId)?.palette ?? FALLBACK_PALETTE;
        const W = BACKDROP_W;
        const H = BACKDROP_H;

        /* Cores derivadas — atmosfera harmônica construída a partir da paleta
         * oficial do bioma (nada de cinza genérico: tudo é mix/shade do trio
         * sky/ground/accent, então cada bioma mantém identidade própria). */
        const comp = (c: string): [number, number, number] => {
          const { r, g, b } = parseRgbColor(c);
          return [Math.round(r), Math.round(g), Math.round(b)];
        };
        const mixc = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
          Math.round(a[0] + (b[0] - a[0]) * t),
          Math.round(a[1] + (b[1] - a[1]) * t),
          Math.round(a[2] + (b[2] - a[2]) * t),
        ];
        const css = (c: [number, number, number], alpha = 1): string => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

        const skyC = comp(p.sky);
        const groundC = comp(p.ground);
        const accentC = comp(p.accent);
        const nightC: [number, number, number] = [2, 6, 23];
        const whiteC: [number, number, number] = [248, 250, 252];

        const horizonY = H * 0.52; // linha do horizonte
        const terraceTop = H * 0.355; // platô recuado onde a lane de trás se apoia
        const terraceFront = H * 0.50; // frente do platô (degrau do penhasco)
        const ctx = backdropCtx;
        ctx.clearRect(0, 0, W, H);

        /* ── 1. CÉU ATMOSFÉRICO ──
         * Zênite escuro → azul do bioma → glow quente do accent no horizonte. */
        const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
        sky.addColorStop(0, css(mixc(skyC, nightC, 0.45)));
        sky.addColorStop(0.45, css(skyC));
        sky.addColorStop(0.82, css(mixc(skyC, accentC, 0.22)));
        sky.addColorStop(1, css(mixc(skyC, accentC, 0.38)));
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, horizonY + 2);

        // Estrelas — firmamento denso no zênite, apagando perto do horizonte.
        for (let i = 0; i < 90; i++) {
          const x = (((i * 97 + 13) % 100) / 100) * W;
          const y = (((i * 61 + 7) % 55) / 100) * horizonY * 0.72;
          const size = 0.6 + ((i * 7) % 10) / 8;
          const fade = 1 - (y / (horizonY * 0.72)) * 0.6;
          const isAccent = i % 9 === 0;
          ctx.fillStyle = css(isAccent ? mixc(accentC, whiteC, 0.4) : whiteC, (0.16 + ((i * 13) % 40) / 100) * fade);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Lua / fonte de luz do bioma — halo duplo + núcleo com crateras.
        const moonX = W * 0.74;
        const moonY = H * 0.13;
        const halo = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 170);
        halo.addColorStop(0, css(accentC, 0.18));
        halo.addColorStop(0.55, css(accentC, 0.07));
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(moonX - 170, moonY - 170, 340, 340);
        const coreC = mixc(accentC, whiteC, 0.72);
        ctx.fillStyle = css(coreC, 0.95);
        ctx.beginPath();
        ctx.arc(moonX, moonY, 24, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2.39) % (Math.PI * 2);
          const dist = 5 + ((i * 11) % 14);
          ctx.fillStyle = css(mixc(coreC, nightC, 0.35), 0.3);
          ctx.beginPath();
          ctx.arc(moonX + Math.cos(angle) * dist, moonY + Math.sin(angle) * dist, 2 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }

        // Bancos de nuvens suaves, arrastando na direção do horizonte.
        for (let i = 0; i < 5; i++) {
          const cx = (((i * 311 + 40) % 100) / 100) * W;
          const cy = H * (0.16 + ((i * 17) % 26) / 100);
          const rx = 90 + ((i * 53) % 130);
          const ry = 10 + ((i * 7) % 9);
          const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
          cloud.addColorStop(0, css(mixc(skyC, whiteC, 0.55), 0.09));
          cloud.addColorStop(0.7, 'rgba(0,0,0,0)');
          cloud.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cloud;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, ry / rx);
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        /* ── 2. CORDILHEIRAS DE PROFUNDIDADE ──
         * Silhuetas serrilhadas com perspectiva atmosférica: quanto mais
         * distante, mais dissolvidas na cor do céu; rim light no cume vindo
         * da lua do bioma. */
        const ridge = (
          baseY: number,
          peakMin: number,
          peakMax: number,
          peaks: number,
          seed: number,
          topColor: [number, number, number],
          bottomColor: [number, number, number],
          alpha: number,
          rimAlpha: number,
        ): void => {
          const points: Array<[number, number]> = [[0, baseY]];
          const seg = W / peaks;
          for (let i = 0; i < peaks; i++) {
            const valleyX = seg * i + ((i * seed) % 14) - 7;
            const valleyY = baseY - ((i * seed * 3) % Math.max(1, Math.round(peakMin * 0.35)));
            const peakX = seg * (i + 0.5) + ((i * seed) % 22) - 11;
            const peakY = baseY - (peakMin + ((i * seed * 7) % Math.max(1, peakMax - peakMin)));
            points.push([valleyX, valleyY], [peakX, peakY]);
          }
          points.push([W, baseY]);
          const firstPoint = points[0];
          if (!firstPoint) return;
          ctx.beginPath();
          ctx.moveTo(firstPoint[0], firstPoint[1]);
          for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
          ctx.lineTo(W, horizonY + 40);
          ctx.lineTo(0, horizonY + 40);
          ctx.closePath();
          const gradient = ctx.createLinearGradient(0, baseY - peakMax, 0, horizonY + 30);
          gradient.addColorStop(0, css(topColor, alpha));
          gradient.addColorStop(1, css(bottomColor, alpha));
          ctx.fillStyle = gradient;
          ctx.fill();
          // rim light no cume
          ctx.beginPath();
          ctx.moveTo(firstPoint[0], firstPoint[1]);
          for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
          ctx.strokeStyle = css(mixc(topColor, whiteC, 0.5), rimAlpha);
          ctx.lineWidth = 1.4;
          ctx.stroke();
        };

        // Camada distante — quase dissolvida na cor do céu.
        ridge(horizonY - 8, 100, 175, 5, 17,
          mixc(skyC, groundC, 0.3), mixc(skyC, groundC, 0.55), 0.78, 0.28);
        // Camada média — tons intermédios, picos mais fechados.
        ridge(horizonY - 4, 115, 190, 4, 29,
          mixc(skyC, groundC, 0.58), mixc(groundC, nightC, 0.15), 0.88, 0.2);

        /* ── 3. PLATÔ RECUADO (lane de trás) + FACE DO DEGRAU ──
         * Terreno escalonado de torre: a lane "back" fica sobre um platô
         * elevado, em tons dissolvidos pela distância, com degrau em sombra
         * caindo até o horizonte — as unidades ficam visivelmente apoiadas. */
        ctx.beginPath();
        ctx.moveTo(0, terraceTop + 8);
        for (let i = 0; i <= 8; i++) {
          ctx.lineTo((W / 8) * i, terraceTop + (((i * 23) % 12) - 6));
        }
        ctx.lineTo(W, terraceFront);
        ctx.lineTo(0, terraceFront);
        ctx.closePath();
        const terrace = ctx.createLinearGradient(0, terraceTop, 0, terraceFront);
        terrace.addColorStop(0, css(mixc(groundC, skyC, 0.45), 0.85));
        terrace.addColorStop(1, css(mixc(groundC, skyC, 0.22), 0.95));
        ctx.fillStyle = terrace;
        ctx.fill();
        // rim da frente do platô — luz batendo na aresta do degrau
        ctx.fillStyle = css(mixc(accentC, whiteC, 0.35), 0.4);
        ctx.fillRect(0, terraceFront - 2, W, 2);
        // pedras espalhadas no platô
        for (let i = 0; i < 6; i++) {
          const cx = (((i * 151 + 23) % 96) / 100) * W;
          const cy = terraceTop + 18 + ((i * 37) % Math.max(1, Math.round(terraceFront - terraceTop - 30)));
          ctx.fillStyle = css(mixc(groundC, nightC, 0.35), 0.5);
          ctx.beginPath();
          ctx.ellipse(cx, cy, 7 + ((i * 13) % 8), 3 + ((i * 7) % 3), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // face vertical do degrau — penhasco em sombra
        const cliff = ctx.createLinearGradient(0, terraceFront, 0, horizonY);
        cliff.addColorStop(0, css(mixc(groundC, nightC, 0.55), 0.95));
        cliff.addColorStop(1, css(mixc(groundC, nightC, 0.75), 0.98));
        ctx.fillStyle = cliff;
        ctx.fillRect(0, terraceFront, W, horizonY - terraceFront);

        /* ── 4. LINHA DO HORIZONTE MARCADA ── */
        const glow = ctx.createLinearGradient(0, horizonY - 26, 0, horizonY + 6);
        glow.addColorStop(0, 'rgba(0,0,0,0)');
        glow.addColorStop(1, css(accentC, 0.16));
        ctx.fillStyle = glow;
        ctx.fillRect(0, horizonY - 26, W, 32);
        ctx.fillStyle = css(accentC, 0.35);
        ctx.fillRect(0, horizonY - 4, W, 1.5);
        ctx.fillStyle = css(mixc(accentC, whiteC, 0.5), 0.8);
        ctx.fillRect(0, horizonY - 1, W, 2);

        /* ── 5. PISO DE TERRENO TEXTURIZADO ──
         * Do horizonte (luz do accent a morrer) até o primeiro plano (noite).
         * Textura em três escalas: grama em perspectiva, grão do terreno e
         * banding de anéis — as unidades "assentam" num chão real. */
        const floorTop = horizonY;
        const floor = ctx.createLinearGradient(0, floorTop, 0, H);
        floor.addColorStop(0, css(mixc(groundC, accentC, 0.32)));
        floor.addColorStop(0.28, css(groundC));
        floor.addColorStop(1, css(mixc(groundC, nightC, 0.72)));
        ctx.fillStyle = floor;
        ctx.fillRect(0, floorTop, W, H - floorTop);

        // Banding de perspectiva — anéis do terreno espaçando ao aproximar.
        let ringY = floorTop + 6;
        let spacing = 3;
        while (ringY < H) {
          const depth = (ringY - floorTop) / (H - floorTop);
          ctx.fillStyle = css(mixc(groundC, nightC, 0.4), 0.1 * (1 - depth * 0.6));
          ctx.fillRect(0, ringY, W, 1.2);
          ringY += spacing;
          spacing = 3 + depth * 9;
        }

        // Grão do terreno — speckles claros/escuros determinísticos.
        for (let i = 0; i < 380; i++) {
          const x = (((i * 137 + 29) % 100) / 100) * W;
          const y = floorTop + (((i * 89 + 53) % 100) / 100) * (H - floorTop);
          const light = i % 3 !== 0;
          ctx.fillStyle = light
            ? css(mixc(groundC, whiteC, 0.4), 0.05 + ((i * 7) % 6) / 100)
            : css(mixc(groundC, nightC, 0.7), 0.07 + ((i * 5) % 7) / 100);
          ctx.fillRect(x, y, 1 + (i % 3), 1);
        }

        // Grama em perspectiva — fios curvos crescendo ao aproximar.
        for (let i = 0; i < 130; i++) {
          const x = (((i * 173 + 31) % 100) / 100) * W;
          const depth = ((i * 41 + 11) % 100) / 100;
          const y = floorTop + 8 + depth * (H - floorTop - 12);
          const scale = 0.55 + depth * 0.75;
          const len = (5 + ((i * 13) % 10)) * scale;
          const tilt = (((i * 29) % 36) - 18) * (Math.PI / 180);
          const alpha = 0.1 + ((i * 7) % 18) / 100;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(tilt);
          ctx.strokeStyle = css(mixc(accentC, groundC, 0.35), alpha);
          ctx.lineWidth = 1 + scale * 0.6;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(len * 0.2, -len * 0.6, 0, -len);
          ctx.stroke();
          ctx.restore();
        }

        // Silhuetas de vegetação na base do degrau — soldam piso ao penhasco.
        for (let i = 0; i < 10; i++) {
          const cx = (((i * 197 + 17) % 98) / 100) * W;
          const baseY = floorTop + 4 + ((i * 31) % 14);
          const h = 10 + ((i * 7) % 16);
          ctx.fillStyle = css(mixc(groundC, nightC, 0.6), 0.9);
          ctx.beginPath();
          ctx.ellipse(cx, baseY, 9 + ((i * 11) % 10), h, 0, Math.PI, Math.PI * 2);
          ctx.fill();
        }

        // Poça de luz — o ringue de combate onde as unidades se enfrentam.
        const poolX = W * 0.5;
        const poolY = H * 0.8;
        const pool = ctx.createRadialGradient(poolX, poolY, 0, poolX, poolY, W * 0.24);
        pool.addColorStop(0, css(accentC, 0.15));
        pool.addColorStop(0.55, css(accentC, 0.06));
        pool.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pool;
        ctx.save();
        ctx.translate(poolX, poolY);
        ctx.scale(1, (H * 0.1) / (W * 0.24));
        ctx.beginPath();
        ctx.arc(0, 0, W * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Pedras — sombreadas com brilho superior (luz da lua do bioma) e
        // sombra projetada no chão.
        for (let i = 0; i < 12; i++) {
          const left = ((i * 37 + 11) % 94) / 100;
          const depth = ((i * 17) % 100) / 100;
          const width = (14 + ((i * 13) % 16)) * (0.6 + depth * 0.7);
          const height = width * 0.42;
          const cx = left * W;
          const cy = floorTop + 14 + depth * (H - floorTop - 26);
          const alpha = 0.4 + ((i * 11) % 30) / 100;
          const stone = ctx.createLinearGradient(0, cy - height / 2, 0, cy + height / 2);
          stone.addColorStop(0, css(mixc(groundC, whiteC, 0.45), 0.5 * alpha));
          stone.addColorStop(0.35, css(mixc(groundC, nightC, 0.35), 0.9 * alpha));
          stone.addColorStop(1, css(nightC, 0.95 * alpha));
          ctx.fillStyle = stone;
          ctx.beginPath();
          ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = css(nightC, 0.25 * alpha);
          ctx.beginPath();
          ctx.ellipse(cx + width * 0.16, cy + height * 0.55, width * 0.42, height * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Tufos de grama — clusters de 3 fios, cor do bioma.
        for (let i = 0; i < 18; i++) {
          const left = ((i * 23 + 5) % 96) / 100;
          const depth = ((i * 13) % 100) / 100;
          const x = left * W;
          const y = floorTop + 10 + depth * (H - floorTop - 20);
          const scale = 0.6 + depth * 0.8;
          const tilt = (((i * 29) % 16) - 8) * (Math.PI / 180);
          const alpha = 0.3 + ((i * 7) % 25) / 100;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(tilt);
          const tuft = ctx.createLinearGradient(0, 0, 0, -14 * scale);
          tuft.addColorStop(0, css(mixc(accentC, groundC, 0.5), 0.9 * alpha));
          tuft.addColorStop(1, css(mixc(accentC, whiteC, 0.25), alpha));
          ctx.strokeStyle = tuft;
          ctx.lineWidth = 1.3 * scale;
          for (const blade of [-3, 0, 3]) {
            ctx.beginPath();
            ctx.moveTo(blade * scale, 0);
            ctx.quadraticCurveTo(blade * 1.4 * scale, -7 * scale, blade * 0.8 * scale, -14 * scale);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Neblina rasteira na base do penhasco — assenta as montanhas no chão.
        const mist = ctx.createLinearGradient(0, horizonY - 4, 0, horizonY + 30);
        mist.addColorStop(0, css(mixc(accentC, whiteC, 0.5), 0.1));
        mist.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mist;
        ctx.fillRect(0, horizonY - 4, W, 34);

        /* ── 6. VINHETA ── */
        const radius = Math.hypot(W, H) / 2;
        const vignette = ctx.createRadialGradient(W / 2, H / 2, radius * 0.55, W / 2, H / 2, radius);
        vignette.addColorStop(0, 'rgba(2,6,23,0)');
        vignette.addColorStop(1, 'rgba(2,6,23,0.85)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, W, H);

        backdropTexture.source.update();
      };

      paintBackdrop(biomeRef.current);

      /* ── Mundo ──────────────────────────────────────────────────────── */
      const world = new P.Container();
      world.sortableChildren = true;
      world.addChild(backdrop);
      app.stage.addChild(world);

      // Partículas ambientes (poeira/brasas do bioma) — círculos que derivam.
      interface ParticleDef {
        readonly startX: number;
        readonly startY: number;
        readonly radius: number;
        readonly duration: number;
        readonly delay: number;
      }
      const particleDefs: readonly ParticleDef[] = Array.from({ length: 18 }, (_, i) => ({
        startX: (i * 53) / 100,
        startY: (8 + ((i * 29) % 55)) / 100,
        radius: 1 + (i % 3) * 0.8,
        duration: 7 + (i % 5) * 1.6,
        delay: i * 0.9,
      }));
      const particleLayer = new P.Container();
      particleLayer.zIndex = 1;
      world.addChild(particleLayer);
      const particles = particleDefs.map((def) => {
        const view = new P.Graphics();
        view.circle(0, 0, def.radius).fill({ color: toPixiColor(palette.accent), alpha: 0.8 });
        particleLayer.addChild(view);
        return { def, view };
      });
      let particleAccent = toPixiColor(palette.accent);

      // Camada dos floats (números de dano) — por cima de tudo.
      const floatLayer = new P.Container();
      floatLayer.zIndex = 200;
      world.addChild(floatLayer);

      /* ── Nameplate MMO em Graphics ──────────────────────────────────── */
      const HP_TRACK = 7;
      const SUB_TRACK = 4;
      const TURN_TRACK = 2.5;

      function drawBarFrame(g: Graphics, width: number, trackH: number): void {
        const h = trackH + 4;
        g.clear();
        g.roundRect(0, 0, width, h, trackH >= 6 ? 6 : h / 2).fill({ color: 0x2b374b });
        g.roundRect(0, h * 0.55, width, h * 0.45, h / 2).fill({ color: 0x060a13 });
        g.roundRect(0.5, 0.5, width - 1, h - 1, h / 2).stroke({ width: 1, color: 0x94a3b8, alpha: 0.38 });
        g.roundRect(2, 2, width - 4, trackH, trackH / 2).fill({ color: 0x020617, alpha: 0.92 });
        g.roundRect(2, 2, width - 4, 1.2).fill({ color: 0xffffff, alpha: 0.1 });
      }

      function drawBarFill(g: Graphics, width: number, trackH: number, value: number, color: number): void {
        g.clear();
        const fillW = ((width - 4) * Math.max(0, Math.min(100, value))) / 100;
        if (fillW < 0.5) return;
        g.roundRect(2, 2, fillW, trackH, trackH / 2).fill({ color });
        g.roundRect(2, 2 + trackH * 0.55, fillW, trackH * 0.45, trackH / 2).fill({ color: 0x000000, alpha: 0.3 });
        g.roundRect(2, 2, fillW, trackH * 0.46, trackH / 2).fill({ color: 0xffffff, alpha: 0.3 });
      }

      function truncate(text: string, max: number): string {
        return text.length > max ? `${text.slice(0, max - 1)}…` : text;
      }

      function buildNameplate(width: number, enemy: boolean): PlateView {
        const root = new P.Container();

        const nameText = new P.Text({
          text: '',
          style: {
            fontFamily: FONT_SANS,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 0.4,
            fill: enemy ? 0xfecaca : 0xf8fafc,
            dropShadow: { color: 0x020617, alpha: 0.9, blur: 2, distance: 1, angle: Math.PI / 6 },
          },
          resolution: 2,
        });
        nameText.anchor.set(0.5, 0);
        nameText.position.set(width / 2 - 12, 0);

        const levelBadge = new P.Graphics();
        const levelText = new P.Text({
          text: '',
          style: { fontFamily: FONT_MONO, fontSize: 9, fontWeight: '700', fill: 0xe2e8f0 },
          resolution: 2,
        });
        levelText.anchor.set(0.5);
        levelText.position.set(width - 17, 6.5);

        const tagText = new P.Text({
          text: '',
          style: { fontFamily: FONT_SANS, fontSize: 8.5, fontWeight: '600', letterSpacing: 0.8, fill: 0xfda4af },
          resolution: 2,
        });
        tagText.anchor.set(0.5, 0);
        tagText.position.set(width / 2 - 10, 15);

        // Badge ALVO — alvo atual dos inimigos (pulsa no ticker).
        const alvo = new P.Container();
        const alvoBg = new P.Graphics();
        alvoBg.roundRect(0, 0, 30, 11, 5.5).fill({ color: 0x38bdf8 });
        const alvoText = new P.Text({
          text: 'ALVO',
          style: { fontFamily: FONT_MONO, fontSize: 7.5, fontWeight: '700', letterSpacing: 0.8, fill: 0x06121f },
          resolution: 2,
        });
        alvoText.anchor.set(0.5);
        alvoText.position.set(15, 5.5);
        alvo.addChild(alvoBg, alvoText);
        alvo.position.set(width - 34, 14);
        alvo.visible = false;

        const bars: Readonly<Record<'hp' | 'shield' | 'mp' | 'turn', PlateBar>> = {
          hp: { frame: new P.Graphics(), fill: new P.Graphics() },
          shield: { frame: new P.Graphics(), fill: new P.Graphics() },
          mp: { frame: new P.Graphics(), fill: new P.Graphics() },
          turn: { frame: new P.Graphics(), fill: new P.Graphics() },
        };
        drawBarFrame(bars.hp.frame, width, HP_TRACK);
        drawBarFrame(bars.shield.frame, width, SUB_TRACK);
        drawBarFrame(bars.mp.frame, width, SUB_TRACK);
        drawBarFrame(bars.turn.frame, width, TURN_TRACK);

        const effectsText = new P.Text({
          text: '',
          style: { fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 0.5, fill: 0x4ade80 },
          resolution: 2,
        });
        effectsText.anchor.set(0, 0);
        effectsText.visible = false;

        const dots: Graphics[] = [0, 1, 2, 3].map(() => new P.Graphics());

        root.addChild(
          nameText, levelBadge, levelText, tagText, alvo,
          bars.hp.frame, bars.hp.fill,
          bars.shield.frame, bars.shield.fill,
          bars.mp.frame, bars.mp.fill,
          bars.turn.frame, bars.turn.fill,
          effectsText, ...dots,
        );

        let lastHeader = '';
        let lastConfig = '';
        let lastHp = -1;
        let lastShield = -1;
        let lastMp = -1;
        let lastTurn = -1;
        let lastEffects = '';
        let lastDots = '';
        let plateHeight = 44;

        const view: PlateView = {
          root,
          setHeader(name, tag, tagColor, level, focused, isEnemy, isBoss) {
            const key = `${name}|${tag}|${level}|${tagColor}|${focused}|${isBoss}`;
            if (key === lastHeader) return;
            lastHeader = key;
            nameText.text = truncate(name, isEnemy ? 10 : 12);
            nameText.style.fill = focused ? 0x7dd3fc : isEnemy ? 0xfecaca : 0xf8fafc;
            nameText.style.dropShadow = isBoss
              ? { color: 0xef4444, alpha: 0.8, blur: 8, distance: 0, angle: Math.PI / 6 }
              : { color: 0x020617, alpha: 0.9, blur: 2, distance: 1, angle: Math.PI / 6 };
            tagText.text = tag.toUpperCase();
            tagText.style.fill = tagColor;
            levelText.text = String(level);
            levelBadge.clear();
            levelBadge.roundRect(width - 30, 0, 26, 13, 6.5).fill({ color: 0x334155 });
            levelBadge.roundRect(width - 30, 6.5, 26, 6.5, 3).fill({ color: 0x0f172a });
            levelBadge.roundRect(width - 30, 0, 26, 13, 6.5).stroke({ width: 1, color: 0x94a3b8, alpha: 0.5 });
            levelBadge.roundRect(width - 29, 1, 24, 2).fill({ color: 0xffffff, alpha: 0.14 });
          },
          update(unitTop, hp, shield, mp, turn, focused, alive, effects, dotsNow, reducedMotion, now) {
            const showShield = shield > 0.5;
            const showMp = mp > 0.5;
            const showTurn = turn > 0.5;
            const hasRow = effects.length > 0 || dotsNow.some(Boolean);
            const configKey = `${showShield}${showMp}${showTurn}${hasRow}`;

            if (configKey !== lastConfig) {
              lastConfig = configKey;
              let y = 30; // nome (0..15) + tag (15..30)
              bars.hp.frame.y = y;
              bars.hp.fill.y = y;
              y += HP_TRACK + 4 + 3;
              bars.shield.frame.visible = showShield;
              bars.shield.fill.visible = showShield;
              bars.shield.frame.y = y;
              bars.shield.fill.y = y;
              if (showShield) y += SUB_TRACK + 4 + 3;
              bars.mp.frame.visible = showMp;
              bars.mp.fill.visible = showMp;
              bars.mp.frame.y = y;
              bars.mp.fill.y = y;
              if (showMp) y += SUB_TRACK + 4 + 3;
              bars.turn.frame.visible = showTurn;
              bars.turn.fill.visible = showTurn;
              bars.turn.frame.y = y;
              bars.turn.fill.y = y;
              if (showTurn) y += TURN_TRACK + 4 + 3;
              effectsText.visible = hasRow;
              effectsText.y = y + 1;
              for (const [index, dot] of dots.entries()) {
                dot.visible = hasRow && index < dotsNow.length;
                dot.y = y + 5;
                dot.x = 8 + index * 9;
              }
              if (hasRow) {
                effectsText.x = 8 + dotsNow.length * 9 + 4;
                plateHeight = y + 12;
              } else {
                plateHeight = y + 2;
              }
            }

            // Fills — só redesenha quando o percentual arredondado muda.
            const hpR = Math.round(hp * 2) / 2;
            if (hpR !== lastHp) {
              lastHp = hpR;
              drawBarFill(bars.hp.fill, width, HP_TRACK, hpR, 0xef4444);
            }
            const shieldR = Math.round(shield * 2) / 2;
            if (shieldR !== lastShield) {
              lastShield = shieldR;
              drawBarFill(bars.shield.fill, width, SUB_TRACK, shieldR, 0x38bdf8);
            }
            const mpR = Math.round(mp * 2) / 2;
            if (mpR !== lastMp) {
              lastMp = mpR;
              drawBarFill(bars.mp.fill, width, SUB_TRACK, mpR, 0x3b82f6);
            }
            const turnR = Math.round(turn * 2) / 2;
            if (turnR !== lastTurn) {
              lastTurn = turnR;
              drawBarFill(bars.turn.fill, width, TURN_TRACK, turnR, 0xf59e0b);
            }

            const effectsKey = effects.join(',');
            if (effectsKey !== lastEffects) {
              lastEffects = effectsKey;
              effectsText.text = effects.join(' ').toUpperCase();
              effectsText.style.fill = effects.some((effect) => effect === 'dot') ? 0xf87171 : 0x4ade80;
            }
            const dotsKey = dotsNow.map(Boolean).join('');
            if (dotsKey !== lastDots) {
              lastDots = dotsKey;
              for (const [index, dot] of dots.entries()) {
                dot.clear();
                const ready = dotsNow[index] ?? false;
                dot.circle(0, 0, 2.5).fill({ color: ready ? 0xa78bfa : 0x334155 });
              }
            }

            alvo.visible = focused;
            if (focused && !reducedMotion) {
              alvo.alpha = 0.81 + 0.19 * Math.sin((now * 2 * Math.PI) / 1500);
            } else {
              alvo.alpha = 1;
            }

            root.alpha = alive ? 1 : 0.45;
            root.position.set(-width / 2, -(unitTop + plateHeight + 6));
          },
        };
        return view;
      }

      /* ── Corpo do herói — Paperdoll modular ─────────────────────────── */
      function buildHeroDoll(hero: PlayerCombatant): { container: Container; key: string; rarityColor: number | null } {
        const doll = new P.Container();
        const loadout = equipmentRef.current[hero.characterId] ?? EMPTY_LOADOUT;
        const equipKey = Object.values(loadout)
          .map((item) => item?.itemId ?? '')
          .join(',');
        const key = `${hero.characterId}|${equipKey}|${hero.appearance.skinTone}`;
        const race = RACE_BY_ID.get(hero.appearance.raceId);
        const resolved = race
          ? resolvePaperdoll({
              race,
              appearance: hero.appearance,
              equipment: loadout,
              catalogue: ITEM_BY_ID,
              animation: hero.hp > 0 ? 'idle' : 'death',
            })
          : null;
        const layers = resolved?.state.layers ?? [];
        const rarityColor: number | null = (() => {
          const top = highestRarity(layers.flatMap((layer) => (layer.rarity ? [layer.rarity] : [])));
          return top ? toPixiColor(RARITY_COLOR[top]) : null;
        })();

        for (const layer of layers) {
          const rect = artRectFor(layer.key, layer.slot);
          // Âncora oficial do design system — offset de calibração, escala e
          // espelho aplicados SOBRE o rect. É a MESMA geometria que
          // `layerStyle` usa no DOM, para que a transição Raça Pura → traje
          // de Classe (e qualquer `anchorOverride` de item) calibre igual
          // na arena Pixi e no inventário.
          const anchorScale = Math.max(0.05, layer.anchor.scale);
          const holder = new P.Container();
          holder.position.set(rect.x + layer.anchor.x, rect.y + layer.anchor.y);
          if (layer.anchor.flipX) holder.scale.x = -1;
          holder.alpha = layer.opacity;

          // Fallback vetorial — resolvido uma vez, partilhado pela lâmina e pelo glow.
          const svg = layer.rasterSrc
            ? null
            : getParametricSvgForLayer(layer.key, layer.slot, {
                assetSrc: layer.asset.src,
                rarityGlow: layer.rarity ? RARITY_COLOR[layer.rarity] : null,
                instanceId: `${hero.id}-${layer.key}`,
              });
          const sized = svg
            ? svg.replace('width="100%" height="100%"', `width="${rect.size * 2}" height="${rect.size * 2}"`)
            : null;

          const sprite = new P.Sprite(P.Texture.EMPTY);
          const applyTexture = (texture: Texture | null): void => {
            if (texture === null || sprite.destroyed) return;
            sprite.texture = texture;
            sprite.width = rect.size * anchorScale;
            sprite.height = rect.size * anchorScale;
          };
          if (layer.rasterSrc) {
            void loadRasterTexture(layer.rasterSrc).then(applyTexture);
          } else if (sized) {
            const cacheKey = `${layer.key}|${layer.slot ?? ''}|${layer.asset.src ?? ''}|${layer.rarity ?? ''}`;
            void loadSvgTexture(cacheKey, sized).then(applyTexture);
          }
          holder.addChild(sprite);

          // Glow de raridade da arma — cópia borrada e tingida atrás da lâmina.
          if (layer.key === 'weapon' && layer.slot === 'weapon' && layer.rarity) {
            const glowHolder = new P.Container();
            glowHolder.position.set(rect.x + layer.anchor.x, rect.y + layer.anchor.y);
            if (layer.anchor.flipX) glowHolder.scale.x = -1;
            const glowSprite = new P.Sprite(P.Texture.EMPTY);
            glowSprite.filters = [new P.BlurFilter({ strength: 8 })];
            glowSprite.tint = toPixiColor(RARITY_COLOR[layer.rarity]);
            glowSprite.alpha = 0.85;
            glowHolder.addChild(glowSprite);
            const applyGlow = (texture: Texture | null): void => {
              if (texture === null || glowSprite.destroyed) return;
              glowSprite.texture = texture;
              glowSprite.width = rect.size * anchorScale;
              glowSprite.height = rect.size * anchorScale;
            };
            if (layer.rasterSrc) {
              void loadRasterTexture(layer.rasterSrc).then(applyGlow);
            } else if (sized) {
              const glowCacheKey = `glow|${layer.key}|${layer.asset.src ?? ''}|${layer.rarity ?? ''}`;
              void loadSvgTexture(glowCacheKey, sized).then(applyGlow);
            }
            doll.addChild(glowHolder);
          }

          doll.addChild(holder);
        }

        return { container: doll, key, rarityColor };
      }

      /** Corpo do monstro — glifo emoji com aura elementar. */
      function buildEnemyAvatar(enemy: EnemyCombatant): { container: Container; glyphSize: number } {
        const isBoss = enemy.tier === 'boss';
        const glyphSize = isBoss ? 150 : enemy.tier === 'elite' ? 108 : 86;
        const monster = MONSTER_BY_ID.get(enemy.monsterId);
        const glowKey = monster?.element ?? '';
        const glow = toPixiColor(glowKey);
        const glowAlpha = parseRgbColor(glowKey).a;
        const avatar = new P.Container();
        const glyph = new P.Text({
          text: monsterGlyphFor(monster?.sprite.src ?? '', isBoss),
          style: {
            fontFamily: FONT_EMOJI,
            fontSize: glyphSize,
            fill: 0xffffff,
            dropShadow: { color: glow, alpha: glowAlpha, blur: 14, distance: 0, angle: Math.PI / 6 },
          },
          resolution: 2,
        });
        glyph.anchor.set(0.5);
        // Base do glifo afunda ~6% na linha do chão — o em-box do emoji tem
        // folga transparente em baixo, e este overlap é o que faz o monstro
        // parecer de pé no terreno em vez de pairar sobre ele.
        glyph.position.set(0, -glyphSize * 0.44);
        avatar.addChild(glyph);
        return { container: avatar, glyphSize };
      }

      /**
       * Sombra de contacto nos pés — elipse em duas camadas (penumbra externa
       * + núcleo escuro) centrada NA linha do chão do slot. É o que dá peso
       * ao avatar: o corpo pode bobbar/lungear, a sombra fica pregada ao solo.
       */
      function makeShadow(rx: number): Graphics {
        const shadow = new P.Graphics();
        shadow.ellipse(0, 1.5, rx, rx * 0.2).fill({ color: 0x020617, alpha: 0.3 });
        shadow.ellipse(0, 1.5, rx * 0.66, rx * 0.13).fill({ color: 0x020617, alpha: 0.4 });
        return shadow;
      }

      /* ── Unidades ───────────────────────────────────────────────────── */
      const units = new Map<Uuid, UnitView>();
      const floatViews = new Map<string, {
        view: Text;
        createdAt: number;
        durationMs: number;
        offsetX: number;
        isCrit: boolean;
        isSkill: boolean;
      }>();

      function ensureHeroView(hero: PlayerCombatant): UnitView {
        const existing = units.get(hero.id);
        if (existing) return existing;

        const laneScale = LANE_DEPTH_SCALE[hero.position];
        const root = new P.Container();
        const bodyWrap = new P.Container();
        const avatar = new P.Container();
        const flashFilter = new P.ColorMatrixFilter();
        const toneFilter = new P.ColorMatrixFilter();
        avatar.filters = [flashFilter, toneFilter];
        bodyWrap.addChild(avatar);

        const plate = buildNameplate(150, false);
        const shadow = makeShadow(48 * laneScale);
        root.addChild(shadow, bodyWrap, plate.root);
        world.addChild(root);

        const view: UnitView = {
          id: hero.id,
          kind: 'hero',
          root,
          bodyWrap,
          avatar,
          flashFilter,
          toneFilter,
          plate,
          dir: 1,
          lungeDistance: 30,
          shadow,
          depthScale: laneScale,
          unitTop: (DOLL_FEET_Y - 24) * DOLL_SCALE * laneScale,
          floatBaseY: 105 * laneScale,
          bobPhase: -(hero.position === 'front' ? 0 : hero.position === 'mid' ? 1.3 : 2.1),
          dollKey: '',
          deathAt: null,
          lastAlive: true,
          rarityColor: null,
        };
        units.set(hero.id, view);
        return view;
      }

      function ensureEnemyView(enemy: EnemyCombatant): UnitView {
        const existing = units.get(enemy.id);
        if (existing) return existing;

        const isBoss = enemy.tier === 'boss';
        const glyphSize = isBoss ? 150 : enemy.tier === 'elite' ? 108 : 86;
        const laneScale = LANE_DEPTH_SCALE[enemy.position];
        const root = new P.Container();
        const bodyWrap = new P.Container();
        const avatar = new P.Container();
        const flashFilter = new P.ColorMatrixFilter();
        const toneFilter = new P.ColorMatrixFilter();
        avatar.filters = [flashFilter, toneFilter];
        bodyWrap.addChild(avatar);

        const plate = buildNameplate(136, true);
        const shadow = makeShadow((isBoss ? 65 : 40) * laneScale);
        root.addChild(shadow, bodyWrap, plate.root);
        world.addChild(root);

        const view: UnitView = {
          id: enemy.id,
          kind: 'enemy',
          root,
          bodyWrap,
          avatar,
          flashFilter,
          toneFilter,
          plate,
          dir: -1,
          lungeDistance: 26,
          shadow,
          depthScale: laneScale,
          unitTop: glyphSize * 0.95 * laneScale,
          floatBaseY: glyphSize * 0.8 * laneScale,
          bobPhase: -((enemy.position === 'front' ? 59 : enemy.position === 'mid' ? 72 : 85) % 2.2),
          dollKey: '',
          deathAt: null,
          lastAlive: true,
          rarityColor: null,
        };
        units.set(enemy.id, view);
        return view;
      }

      /* ── Sincronização por frame ────────────────────────────────────── */
      const COOLDOWN_EPSILON = 0.001;

      function tweenLunge(view: UnitView, now: number): void {
        const stamp = lungesRef.current[view.id];
        if (!stamp || now - stamp > 500) {
          view.bodyWrap.x = 0;
          view.shadow.x = 0;
          return;
        }
        const t = (now - stamp) / 320;
        if (t < 0 || t >= 1) {
          view.bodyWrap.x = 0;
          view.shadow.x = 0;
          return;
        }
        const k = t < 0.45 ? Math.sin((t / 0.45) * Math.PI * 0.5) : 1 - (t - 0.45) / 0.55;
        view.bodyWrap.x = view.dir * view.lungeDistance * k;
        // A sombra acompanha o deslize — o corpo nunca "sai" da própria sombra.
        view.shadow.x = view.bodyWrap.x;
      }

      function tweenFlash(view: UnitView, now: number): void {
        const stamp = hitsRef.current[view.id];
        if (!stamp || now - stamp > 500) {
          view.flashFilter.brightness(1, false);
          return;
        }
        const t = Math.max(0, Math.min(1, (now - stamp) / 240));
        const boost = Math.sin(t * Math.PI);
        view.flashFilter.brightness(1 + 1.1 * boost, false);
      }

      function tweenDeath(view: UnitView, alive: boolean, now: number): void {
        if (alive) {
          if (!view.lastAlive) {
            view.deathAt = null;
            view.toneFilter.saturate(1, false);
          }
          view.lastAlive = true;
          return;
        }
        if (view.lastAlive) {
          view.deathAt = now;
          view.lastAlive = false;
        }
        const start = view.deathAt ?? now;
        const t = Math.min(1, (now - start) / 480);
        const eased = 1 - (1 - t) * (1 - t);
        view.bodyWrap.rotation = view.dir * 0.24 * eased;
        view.bodyWrap.y = 10 * eased;
        view.toneFilter.saturate(Math.max(0, 1 - eased), false);
      }

      function updateHeroView(view: UnitView, hero: PlayerCombatant, slot: Slot, focusedLine: string | null, now: number, reducedMotion: boolean): void {
        const alive = hero.hp > 0;

        // Paperdoll — reconstrói quando equipamento/aparência muda.
        const loadout = equipmentRef.current[hero.characterId] ?? EMPTY_LOADOUT;
        const equipKey = Object.values(loadout)
          .map((item) => item?.itemId ?? '')
          .join(',');
        const dollKey = `${hero.characterId}|${equipKey}|${hero.appearance.skinTone}`;
        if (dollKey !== view.dollKey) {
          view.dollKey = dollKey;
          for (const child of [...view.avatar.children]) child.destroy({ children: true });
          const { container: doll, rarityColor } = buildHeroDoll(hero);
          doll.scale.set(DOLL_SCALE);
          doll.position.set(-128 * DOLL_SCALE, -DOLL_FEET_Y * DOLL_SCALE);
          view.avatar.addChild(doll);
          view.rarityColor = rarityColor;
        }

        view.root.position.set((slot.x / 100) * app.screen.width, (slot.y / 100) * app.screen.height);
        view.root.zIndex = Math.round(slot.y);

        // Escala de profundidade da lane — a lane de trás, no platô, fica
        // visivelmente menor (mais longe da câmara).
        view.bodyWrap.scale.set(view.depthScale);

        const bobPeriod = 3.4;
        const bobAmp = alive && !reducedMotion ? 3 : 0;
        const bobY = -Math.abs(Math.sin(((now / 1000 + view.bobPhase) * 2 * Math.PI) / bobPeriod)) * bobAmp;
        view.bodyWrap.y = bobY;
        // A sombra "respira" com o bob — corpo no alto, sombra mais suave e
        // aberta, como uma personagem a fazer um pequeno salto de idle.
        const bobT = bobAmp > 0 ? -bobY / bobAmp : 0;
        view.shadow.alpha = 1 - bobT * 0.35;
        view.shadow.scale.set(1 + bobT * 0.1);

        tweenLunge(view, now);
        tweenFlash(view, now);
        tweenDeath(view, alive, now);

        const classDefinition = BASE_CLASSES.find((candidate) => candidate.id === hero.baseClass) ?? null;
        view.plate.setHeader(
          hero.name,
          classDefinition ? `${classDefinition.icon} ${classDefinition.name}` : hero.baseClass,
          view.rarityColor ?? 0x94a3b8,
          hero.level,
          focusedLine === hero.position,
          false,
          false,
        );
        view.plate.update(
          view.unitTop,
          percent(hero.hp, hero.maxHp),
          percent(hero.shield, hero.maxHp),
          hero.maxMp > 0 ? percent(hero.mp, hero.maxMp) : 0,
          turnPercent(hero.attackCooldownSec, hero.stats.attackSpeed),
          focusedLine === hero.position,
          alive,
          hero.effects.slice(0, 3).map((effect) => effect.kind),
          hero.skills.slice(0, 4).map((skill) => (hero.skillCooldowns[skill.skillId] ?? 0) <= COOLDOWN_EPSILON),
          reducedMotion,
          now,
        );
      }

      function updateEnemyView(view: UnitView, enemy: EnemyCombatant, slot: Slot, now: number, reducedMotion: boolean): void {
        const alive = enemy.hp > 0;
        const isBoss = enemy.tier === 'boss';

        if (view.avatar.children.length === 0) {
          const { container } = buildEnemyAvatar(enemy);
          view.avatar.addChild(container);
        }

        view.root.position.set((slot.x / 100) * app.screen.width, (slot.y / 100) * app.screen.height);
        view.root.zIndex = Math.round(slot.y);

        // Escala de profundidade da lane, igual aos heróis.
        view.bodyWrap.scale.set(view.depthScale);

        const bobAmp = alive && !reducedMotion ? 3 : 0;
        const bobY = -Math.abs(Math.sin(((now / 1000 + view.bobPhase) * 2 * Math.PI) / 2.8)) * bobAmp;
        view.bodyWrap.y = bobY;
        const bobT = bobAmp > 0 ? -bobY / bobAmp : 0;
        view.shadow.alpha = 1 - bobT * 0.35;
        view.shadow.scale.set(1 + bobT * 0.1);

        tweenLunge(view, now);
        tweenFlash(view, now);
        tweenDeath(view, alive, now);

        const monster = MONSTER_BY_ID.get(enemy.monsterId);
        view.plate.setHeader(
          `${isBoss ? '👑 ' : ''}${enemy.name}`,
          isBoss ? 'CHEFE' : (monster?.race ?? 'monstro'),
          isBoss ? 0xfca5a5 : 0xfda4af,
          enemy.level,
          false,
          true,
          isBoss,
        );
        view.plate.update(
          view.unitTop,
          percent(enemy.hp, enemy.maxHp),
          0,
          0,
          isBoss ? turnPercent(enemy.attackCooldownSec, enemy.stats.attackSpeed) : 0,
          false,
          alive,
          [],
          [],
          reducedMotion,
          now,
        );
      }

      function syncFloats(now: number): void {
        const list = floatsRef.current;
        const seen = new Set<string>();
        for (const float of list) {
          seen.add(float.id);
          const unit = units.get(float.targetId);
          if (!unit) continue;

          let entry = floatViews.get(float.id);
          if (!entry) {
            const isCrit = float.kind === 'crit';
            const style: TextStyleOptions = {
              fontFamily: FONT_MONO,
              fontWeight: isCrit ? '900' : '700',
              fontSize: FLOAT_SIZE[float.kind],
              fill: FLOAT_COLOR[float.kind],
              dropShadow: isCrit
                ? { color: 0xfbbf24, alpha: 0.95, blur: 10, distance: 0, angle: Math.PI / 6 }
                : { color: 0x000000, alpha: 0.7, blur: 3, distance: 1, angle: Math.PI / 6 },
              letterSpacing: isCrit ? 0.5 : 0.2,
            };
            if (isCrit) style.stroke = { color: 0xffffff, width: 2 };
            const text = new P.Text({ text: float.text, style, resolution: 2 });
            text.anchor.set(0.5);
            text.position.set(unit.root.x + float.offsetX, unit.root.y - unit.floatBaseY);
            floatLayer.addChild(text);
            entry = {
              view: text,
              createdAt: float.createdAt,
              durationMs: float.durationMs,
              offsetX: float.offsetX,
              isCrit,
              isSkill: float.kind === 'skill',
            };
            floatViews.set(float.id, entry);
          }

          const t = Math.max(0, Math.min(1, (now - entry.createdAt) / entry.durationMs));
          const baseY = unit.root.y - unit.floatBaseY - 20;
          entry.view.x = unit.root.x + entry.offsetX;
          entry.view.y = baseY - t * 70;
          const alpha = t < 0.18 ? t / 0.18 : Math.max(0, 1 - Math.max(0, (t - 0.75) / 0.25));
          entry.view.alpha = alpha;
          const scale = entry.isCrit
            ? t < 0.14
              ? 0.5 + 0.88 * (t / 0.14)
              : t < 0.26
                ? 1.38 - 0.2 * ((t - 0.14) / 0.12)
                : 1.18 - 0.14 * ((t - 0.26) / 0.74)
            : entry.isSkill
              ? 1
              : t < 0.18
                ? 0.7 + 0.38 * (t / 0.18)
                : 1.08 - 0.14 * ((t - 0.18) / 0.82);
          entry.view.scale.set(scale);
        }
        for (const [id, entry] of [...floatViews]) {
          if (seen.has(id)) continue;
          entry.view.destroy();
          floatViews.delete(id);
        }
      }

      function updateParticles(now: number, reducedMotion: boolean): void {
        for (const { def, view } of particles) {
          const t = reducedMotion ? 0 : ((now / 1000 + def.delay) % def.duration) / def.duration;
          view.x = def.startX * app.screen.width + t * 0.04 * app.screen.width;
          view.y = def.startY * app.screen.height - t * 0.34 * app.screen.height;
          view.alpha = reducedMotion
            ? 0.8
            : t < 0.12
              ? (t / 0.12) * 0.8
              : t > 0.88
                ? ((1 - t) / 0.12) * 0.7
                : 0.7;
        }
      }

      let currentBiome = biomeRef.current;
      const onTick = (): void => {
        const now = Date.now();
        const combat = stateRef.current;
        const reducedMotion = reducedRef.current;

        backdrop.width = app.screen.width;
        backdrop.height = app.screen.height;
        if (biomeRef.current !== currentBiome) {
          currentBiome = biomeRef.current;
          paintBackdrop(currentBiome);
          const accent = toPixiColor(BIOME_BY_ID.get(currentBiome)?.palette.accent ?? FALLBACK_PALETTE.accent);
          if (accent !== particleAccent) {
            particleAccent = accent;
            for (const { def, view } of particles) {
              view.clear();
              view.circle(0, 0, def.radius).fill({ color: accent, alpha: 0.8 });
            }
          }
        }

        const combatHeroes = combat.combatants.filter((actor): actor is PlayerCombatant => actor.team === 'squad');
        const combatEnemies = combat.combatants.filter((actor): actor is EnemyCombatant => actor.team === 'enemy');
        const focusedLine = combatEnemies.some((enemy) => enemy.hp > 0)
          ? frontmostLine(combatHeroes.filter((hero) => hero.hp > 0))
          : null;

        for (const unit of place(combatEnemies, ENEMY_LANE_BASE)) {
          updateEnemyView(ensureEnemyView(unit.actor), unit.actor, unit.slot, now, reducedMotion);
        }
        for (const unit of place(combatHeroes, HERO_LANE_BASE)) {
          updateHeroView(ensureHeroView(unit.actor), unit.actor, unit.slot, focusedLine, now, reducedMotion);
        }

        const aliveIds = new Set(combat.combatants.map((actor) => actor.id));
        for (const [id, view] of [...units]) {
          if (aliveIds.has(id)) continue;
          view.root.destroy({ children: true });
          units.delete(id);
        }

        syncFloats(now);
        updateParticles(now, reducedMotion);
      };

      app.ticker.add(onTick);
      onTick(); // primeiro frame completo — unidades no palco mesmo antes do primeiro tick
      app.render();

      container.insertBefore(app.canvas as HTMLCanvasElement, container.firstChild);

      dispose = () => {
        app.ticker.stop();
        app.destroy({ removeView: true }, { children: true });
      };
    })();

    return () => {
      cancelled = true;
      dispose?.();
      dispose = null;
    };
  }, []);

  /* ════════════════════════════════════════════════════════════════════
   * HUD DOM — banner de transição, pulso de chefe e Skill Bar.
   * ════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{ARENA_OVERLAY_KEYFRAMES}</style>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: `linear-gradient(180deg, ${palette.sky} 0%, #020617 100%)`,
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

        {/* Pulso de chefe */}
        {boss && !reducedMotion && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 70,
              pointerEvents: 'none',
              animation: 'aetheria-boss-pulse 2.2s ease-in-out infinite',
            }}
          />
        )}

        {/* HUD inferior — Skill Bar estilo Ulala: skills dos 4 heróis. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 12,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 80,
            pointerEvents: 'none',
          }}
        >
          <HeroSkillBar heroes={heroes} castStamps={casts} reducedMotion={reducedMotion} />
        </div>
      </div>
    </>
  );
}
