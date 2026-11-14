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
        const rgba = (hex: string, a: number) => {
          const { r, g, b } = parseRgbColor(hex);
          return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
        };
        const ctx = backdropCtx;
        ctx.clearRect(0, 0, BACKDROP_W, BACKDROP_H);

        // Céu base — gradiente do bioma morrendo em noite.
        const sky = ctx.createLinearGradient(0, 0, 0, BACKDROP_H);
        sky.addColorStop(0, p.sky);
        sky.addColorStop(1, '#020617');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, BACKDROP_W, BACKDROP_H);

        // Banda de neblina atmosférica na altura do horizonte.
        const nebula = ctx.createLinearGradient(0, BACKDROP_H * 0.46, 0, BACKDROP_H * 0.68);
        nebula.addColorStop(0, 'rgba(0,0,0,0)');
        nebula.addColorStop(0.55, rgba(p.accent, 0.07));
        nebula.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = nebula;
        ctx.fillRect(0, BACKDROP_H * 0.46, BACKDROP_W, BACKDROP_H * 0.22);

        // Lua / fonte de luz do bioma.
        const moon = ctx.createRadialGradient(BACKDROP_W * 0.72, BACKDROP_H * 0.08, 0, BACKDROP_W * 0.72, BACKDROP_H * 0.08, 190);
        moon.addColorStop(0, rgba(p.accent, 0.22));
        moon.addColorStop(0.7, 'rgba(0,0,0,0)');
        moon.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = moon;
        ctx.fillRect(BACKDROP_W * 0.72 - 190, BACKDROP_H * 0.08 - 190, 380, 380);

        // Cordilheiras — montes radiais suaves, três profundidades.
        const mound = (cx: number, bottomY: number, rx: number, ry: number, color: string) => {
          const gradient = ctx.createRadialGradient(cx, bottomY, 0, cx, bottomY, rx);
          gradient.addColorStop(0, color);
          gradient.addColorStop(0.7, 'rgba(0,0,0,0)');
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.save();
          ctx.translate(cx, bottomY);
          ctx.scale(1, ry / rx);
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };
        // Camada 1 — distante, cor do céu.
        mound(BACKDROP_W * 0.14, BACKDROP_H * 0.74, BACKDROP_W * 0.58, BACKDROP_H * 0.26, rgba(p.sky, 0.75));
        mound(BACKDROP_W * 0.58, BACKDROP_H * 0.74, BACKDROP_W * 0.5, BACKDROP_H * 0.26, rgba(p.sky, 0.55));
        mound(BACKDROP_W * 0.94, BACKDROP_H * 0.74, BACKDROP_W * 0.42, BACKDROP_H * 0.26, rgba(p.sky, 0.7));
        // Camada 2 — colinas médias, cor do chão.
        mound(BACKDROP_W * 0.3, BACKDROP_H * 0.81, BACKDROP_W * 0.46, BACKDROP_H * 0.17, rgba(p.ground, 0.85));
        mound(BACKDROP_W * 0.78, BACKDROP_H * 0.81, BACKDROP_W * 0.4, BACKDROP_H * 0.17, rgba(p.ground, 0.7));
        // Camada 3 — silhuetas próximas, quase pretas.
        mound(BACKDROP_W * 0.06, BACKDROP_H * 0.855, BACKDROP_W * 0.18, BACKDROP_H * 0.1, 'rgba(2,6,23,0.9)');
        mound(BACKDROP_W * 0.36, BACKDROP_H * 0.855, BACKDROP_W * 0.14, BACKDROP_H * 0.1, 'rgba(2,6,23,0.85)');
        mound(BACKDROP_W * 0.68, BACKDROP_H * 0.855, BACKDROP_W * 0.16, BACKDROP_H * 0.1, 'rgba(2,6,23,0.88)');
        mound(BACKDROP_W * 0.96, BACKDROP_H * 0.855, BACKDROP_W * 0.13, BACKDROP_H * 0.1, 'rgba(2,6,23,0.9)');

        // Chão — gradiente com luz do bioma a morrer no horizonte.
        const floor = ctx.createLinearGradient(0, BACKDROP_H * 0.7, 0, BACKDROP_H);
        floor.addColorStop(0, 'rgba(0,0,0,0)');
        floor.addColorStop(0.22, rgba(p.ground, 0.5));
        floor.addColorStop(1, 'rgba(2,6,23,0.92)');
        ctx.fillStyle = floor;
        ctx.fillRect(0, BACKDROP_H * 0.7, BACKDROP_W, BACKDROP_H * 0.3);

        // Banding do piso — linhas horizontais densas ao fundo (perspectiva).
        for (let y = Math.ceil(BACKDROP_H * 0.7); y < BACKDROP_H; y += 5) {
          const t = (y - BACKDROP_H * 0.7) / (BACKDROP_H * 0.3);
          const alpha = 0.05 * Math.max(0, Math.min(1, (t - 0.34) / 0.66));
          if (alpha <= 0.001) continue;
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fillRect(0, y, BACKDROP_W, 1);
        }

        // Poça de luz sob o centro — onde o combate acontece.
        const pool = ctx.createRadialGradient(BACKDROP_W * 0.5, BACKDROP_H * 0.93, 0, BACKDROP_W * 0.5, BACKDROP_H * 0.93, BACKDROP_W * 0.23);
        pool.addColorStop(0, rgba(p.accent, 0.12));
        pool.addColorStop(0.68, 'rgba(0,0,0,0)');
        pool.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pool;
        ctx.save();
        ctx.translate(BACKDROP_W * 0.5, BACKDROP_H * 0.93);
        ctx.scale(1, (BACKDROP_H * 0.07) / (BACKDROP_W * 0.23));
        ctx.beginPath();
        ctx.arc(0, 0, BACKDROP_W * 0.23, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Pedras no piso — posições determinísticas (i*const % range).
        for (let i = 0; i < 9; i++) {
          const left = (4 + ((i * 37 + 11) % 92)) / 100;
          const bottom = (1 + ((i * 17) % 24)) / 100;
          const width = 12 + ((i * 13) % 14);
          const height = 5 + ((i * 7) % 5);
          const opacity = 0.35 + (((i * 11) % 30) / 100);
          const cx = left * BACKDROP_W;
          const cy = BACKDROP_H - bottom * BACKDROP_H - height / 2;
          const stone = ctx.createLinearGradient(0, cy - height / 2, 0, cy + height / 2);
          stone.addColorStop(0, `rgba(148,163,184,${0.4 * opacity})`);
          stone.addColorStop(0.7, `rgba(2,6,23,${0.9 * opacity})`);
          ctx.fillStyle = stone;
          ctx.beginPath();
          ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Tufos de grama — levemente inclinados, cor do bioma escurecida.
        for (let i = 0; i < 16; i++) {
          const left = (2 + ((i * 23 + 5) % 96)) / 100;
          const bottom = (0.5 + ((i * 13) % 26)) / 100;
          const height = 5 + ((i * 5) % 6);
          const tilt = (((i * 29) % 14) - 7) * (Math.PI / 180);
          const opacity = 0.4 + (((i * 7) % 25) / 100);
          const x = left * BACKDROP_W;
          const y = BACKDROP_H - bottom * BACKDROP_H;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(tilt);
          const tuft = ctx.createLinearGradient(0, -height, 0, 0);
          tuft.addColorStop(0, rgba(p.accent, 0.55 * opacity));
          tuft.addColorStop(1, rgba(p.ground, 0.9 * opacity));
          ctx.fillStyle = tuft;
          ctx.beginPath();
          ctx.roundRect(-1.25, -height, 2.5, height, 2);
          ctx.fill();
          ctx.restore();
        }

        // Linha do horizonte.
        const horizon = ctx.createLinearGradient(0, 0, BACKDROP_W, 0);
        horizon.addColorStop(0, 'rgba(0,0,0,0)');
        horizon.addColorStop(0.5, rgba(p.accent, 0.35));
        horizon.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = horizon;
        ctx.fillRect(0, BACKDROP_H * 0.7, BACKDROP_W, 2);

        // Vinheta.
        const radius = Math.hypot(BACKDROP_W, BACKDROP_H) / 2;
        const vignette = ctx.createRadialGradient(BACKDROP_W / 2, BACKDROP_H / 2, radius * 0.55, BACKDROP_W / 2, BACKDROP_H / 2, radius);
        vignette.addColorStop(0, 'rgba(2,6,23,0)');
        vignette.addColorStop(1, 'rgba(2,6,23,0.85)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, BACKDROP_W, BACKDROP_H);

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
          const holder = new P.Container();
          holder.position.set(rect.x, rect.y);
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
            sprite.width = rect.size;
            sprite.height = rect.size;
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
            glowHolder.position.set(rect.x, rect.y);
            const glowSprite = new P.Sprite(P.Texture.EMPTY);
            glowSprite.filters = [new P.BlurFilter({ strength: 8 })];
            glowSprite.tint = toPixiColor(RARITY_COLOR[layer.rarity]);
            glowSprite.alpha = 0.85;
            glowHolder.addChild(glowSprite);
            const applyGlow = (texture: Texture | null): void => {
              if (texture === null || glowSprite.destroyed) return;
              glowSprite.texture = texture;
              glowSprite.width = rect.size;
              glowSprite.height = rect.size;
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
        glyph.position.set(0, -glyphSize * 0.55);
        avatar.addChild(glyph);
        return { container: avatar, glyphSize };
      }

      function makeShadow(rx: number): Graphics {
        const shadow = new P.Graphics();
        shadow.ellipse(0, 0, rx, rx * 0.18).fill({ color: 0x000000, alpha: 0.55 });
        shadow.position.set(0, -6);
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

        const root = new P.Container();
        const bodyWrap = new P.Container();
        const avatar = new P.Container();
        const flashFilter = new P.ColorMatrixFilter();
        const toneFilter = new P.ColorMatrixFilter();
        avatar.filters = [flashFilter, toneFilter];
        bodyWrap.addChild(avatar);

        const plate = buildNameplate(150, false);
        root.addChild(makeShadow(48), bodyWrap, plate.root);
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
          unitTop: (DOLL_FEET_Y - 24) * DOLL_SCALE,
          floatBaseY: 105,
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
        const root = new P.Container();
        const bodyWrap = new P.Container();
        const avatar = new P.Container();
        const flashFilter = new P.ColorMatrixFilter();
        const toneFilter = new P.ColorMatrixFilter();
        avatar.filters = [flashFilter, toneFilter];
        bodyWrap.addChild(avatar);

        const plate = buildNameplate(136, true);
        root.addChild(makeShadow(isBoss ? 65 : 40), bodyWrap, plate.root);
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
          unitTop: glyphSize * 0.95,
          floatBaseY: glyphSize * 0.8,
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
          return;
        }
        const t = (now - stamp) / 320;
        if (t < 0 || t >= 1) {
          view.bodyWrap.x = 0;
          return;
        }
        const k = t < 0.45 ? Math.sin((t / 0.45) * Math.PI * 0.5) : 1 - (t - 0.45) / 0.55;
        view.bodyWrap.x = view.dir * view.lungeDistance * k;
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

        const bobPeriod = 3.4;
        const bobAmp = alive && !reducedMotion ? 4.5 : 0;
        view.bodyWrap.y = -Math.abs(Math.sin(((now / 1000 + view.bobPhase) * 2 * Math.PI) / bobPeriod)) * bobAmp;

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

        const bobAmp = alive && !reducedMotion ? 4 : 0;
        view.bodyWrap.y = -Math.abs(Math.sin(((now / 1000 + view.bobPhase) * 2 * Math.PI) / 2.8)) * bobAmp;

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
