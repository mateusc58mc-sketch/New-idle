'use client';

/**
 * PaperdollAvatar — composição de camadas PNG transparentes.
 *
 * Ordem rígida (fundo → frente):
 *   Aura → Asas → Corpo da Raça → Armadura → Elmo → Arma → VFX
 *
 * As âncoras vêm de `Race.paperdoll.anchors`, que é IDÊNTICO em todas as
 * raças — é isso que garante alinhamento. O componente não sabe nada de jogo:
 * recebe `PaperdollState` já resolvido e desenha.
 *
 * Estratégia de render: DOM/CSS (não Canvas). Razões:
 *  · 4 avatares em combate não justificam um canvas;
 *  · permite glow por `box-shadow`/`filter` sem shaders;
 *  · acessibilidade e selecção de texto funcionam;
 *  · sprite-sheet de 1 frame por vez com `background-position` é trivial.
 * Se um dia forem 20+ avatares, `mode="canvas"` fica preparado para migrar.
 *
 * Fallback (Stage 8.5): a arte em `public/assets/paperdoll/**` ainda não
 * existe. Em vez de um rectângulo cinzento, o avatar mostra SEMPRE uma carta
 * de RPG: gradiente da classe, silhueta do herói, borda com a cor da raridade
 * e uma faixa com os slots equipados. Quando os PNGs chegarem, cobrem a carta
 * camada a camada — a identidade visual já está pronta.
 */
import { useId, useMemo, useState } from 'react';

import { RACE_BY_ID } from '@/data/races';
import { RARITY_COLOR, RARITY_GLOW } from '@/data/paperdoll-layers';
import { layerStyle } from '@/lib/game/paperdoll';
import { getParametricSvgForLayer } from '@/lib/sprite-lab/svg-templates';
import type {
  BaseClass,
  EquipmentSlot,
  PaperdollLayerKey,
  PaperdollState,
  Rarity,
  ResolvedLayer,
} from '@/types/game';

export type PaperdollSize = 'sm' | 'md' | 'lg' | 'xl';

export interface PaperdollAvatarProps {
  readonly state: PaperdollState;
  /** Tamanho em px (o `displayScale` da raça multiplica por cima). */
  readonly size?: PaperdollSize;
  /** Anel de glow por raridade do conjunto. */
  readonly showGlow?: boolean;
  /** Moldura + fundo do slot. */
  readonly showFrame?: boolean;
  /** Nome acessível; sem ele o avatar é decorativo. */
  readonly label?: string;
  readonly className?: string;
  /**
   * Glifo de fallback (ex.: ícone da classe). Sem ele usa-se a inicial da
   * raça. Nunca é mostrado por cima da arte resolvida.
   */
  readonly fallbackGlyph?: string | undefined;
  /** Classe-base — define o gradiente da carta de fallback. */
  readonly baseClass?: BaseClass | undefined;
  /** Raridade do conjunto — define a borda/glow da carta. */
  readonly rarity?: Rarity | null | undefined;
}

const SIZE_PX: Readonly<Record<PaperdollSize, number>> = {
  sm: 56,
  md: 96,
  lg: 160,
  xl: 256,
} as const;

const LAYER_Z_INDEX: Readonly<Record<PaperdollLayerKey, number>> = {
  aura: 10,
  wings: 20,
  body: 30,
  armor: 40,
  helmet: 50,
  weapon: 60,
  vfx: 70,
};

const FALLBACK_ACCENT = '#94a3b8';

interface ClassTheme {
  readonly from: string;
  readonly via: string;
  readonly ring: string;
  readonly silhouette: string;
}

/** Paleta da carta por classe — legível mesmo sem qualquer PNG. */
const CLASS_THEME: Readonly<Record<BaseClass, ClassTheme>> = {
  warrior: { from: '#24070d', via: '#7f1d1d', ring: '#fca5a5', silhouette: '#fecaca' },
  hunter: { from: '#042318', via: '#166534', ring: '#4ade80', silhouette: '#bbf7d0' },
  cleric: { from: '#261d05', via: '#a16207', ring: '#fde68a', silhouette: '#fef3c7' },
  mage: { from: '#180a30', via: '#5b21b6', ring: '#c4b5fd', silhouette: '#ddd6fe' },
} as const;

const DEFAULT_THEME: ClassTheme = { from: '#0f172a', via: '#334155', ring: FALLBACK_ACCENT, silhouette: '#e2e8f0' };

const SLOT_META: Readonly<Record<EquipmentSlot, { readonly icon: string; readonly label: string }>> = {
  helmet: { icon: '⛑', label: 'Elmo' },
  armor: { icon: '🛡', label: 'Armadura' },
  weapon: { icon: '⚔', label: 'Arma' },
  offhand: { icon: '🗡', label: 'Mão secundária' },
  cloak: { icon: '🧣', label: 'Capa' },
  boots: { icon: '👢', label: 'Botas' },
  accessory: { icon: '💍', label: 'Acessório' },
  aura: { icon: '✨', label: 'Aura' },
  wings: { icon: '🪽', label: 'Asas' },
} as const;

export function PaperdollAvatar({
  state,
  size = 'md',
  showGlow = true,
  showFrame = true,
  label,
  className,
  fallbackGlyph,
  baseClass,
  rarity = null,
}: PaperdollAvatarProps) {
  const px = SIZE_PX[size];
  const race = RACE_BY_ID.get(state.raceId);
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const theme = baseClass ? CLASS_THEME[baseClass] : DEFAULT_THEME;
  const glyph = fallbackGlyph ?? race?.name.slice(0, 1) ?? '?';

  const rarityColor = rarity ? RARITY_COLOR[rarity] : null;
  const rarityGlow = rarity ? (RARITY_GLOW[rarity] ?? null) : null;
  const borderColor = rarityColor ?? `${theme.ring}aa`;
  const glowColor = rarityGlow ?? `${theme.ring}66`;

  // Slots com equipamento — derivados das camadas resolvidas.
  const equippedSlots = useMemo(() => {
    const seen = new Set<EquipmentSlot>();
    for (const layer of state.layers) {
      if (layer.slot && !seen.has(layer.slot)) seen.add(layer.slot);
    }
    return [...seen];
  }, [state.layers]);
  const visibleSlots = equippedSlots.slice(0, 5);

  // Camadas já vêm ordenadas de `resolvePaperdoll`; não reordenar aqui.
  const layers = state.layers;

  const containerStyle = useMemo(
    () => ({
      width: px,
      height: px,
      position: 'relative' as const,
      overflow: 'hidden' as const,
      borderRadius: showFrame ? Math.round(px * 0.18) : 0,
      background: showFrame
        ? `linear-gradient(155deg, ${theme.from} 0%, ${theme.via} 62%, ${theme.from} 100%)`
        : 'transparent',
      border: showFrame ? `2px solid ${borderColor}` : undefined,
      boxShadow: showGlow
        ? `0 0 0 1px rgba(2,6,23,.7), 0 0 ${Math.round(px * 0.2)}px -2px ${glowColor}, inset 0 0 ${Math.round(px * 0.22)}px rgba(2,6,23,.55)`
        : showFrame
          ? 'inset 0 0 0 1px #334155'
          : 'none',
      transition: 'box-shadow 200ms ease, border-color 200ms ease',
    }),
    [px, showFrame, showGlow, theme.from, theme.via, borderColor, glowColor],
  );

  return (
    <div
      className={className}
      style={containerStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-animation={state.animation}
    >
      {/* Vinheta + brilho diagonal: profundidade de carta, não bloco plano. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 30% 18%, ${theme.ring}33 0%, transparent 46%), linear-gradient(115deg, transparent 38%, rgba(255,255,255,.12) 50%, transparent 62%)`,
        }}
      />

      {/* Silhueta estática removida: a camada `body` desenha o herói
          paramétrico, por isso não há duplicação de silhueta na carta. */}

      {/* Glifo da classe — pequeno selo no canto, não o herói inteiro. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: Math.max(2, Math.round(px * 0.05)),
          left: Math.max(2, Math.round(px * 0.05)),
          width: Math.round(px * 0.26),
          height: Math.round(px * 0.26),
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(2,6,23,.6)',
          border: `1px solid ${theme.ring}66`,
          fontSize: Math.round(px * 0.16),
          lineHeight: 1,
          color: theme.ring,
          textShadow: `0 0 6px ${theme.ring}`,
          userSelect: 'none',
        }}
      >
        {glyph}
      </div>

      {/* Faixa de equipamento: slots com peça equipada. */}
      {showFrame && visibleSlots.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Math.max(1, Math.round(px * 0.025)),
            padding: `${Math.max(1, Math.round(px * 0.035))}px 2px`,
            background: 'linear-gradient(0deg, rgba(2,6,23,.92), rgba(2,6,23,.35) 70%, transparent)',
          }}
        >
          {visibleSlots.map((slot) => (
            <span
              key={slot}
              title={SLOT_META[slot].label}
              style={{
                width: Math.round(px * 0.145),
                height: Math.round(px * 0.145),
                borderRadius: Math.max(2, Math.round(px * 0.035)),
                display: 'grid',
                placeItems: 'center',
                fontSize: Math.round(px * 0.1),
                lineHeight: 1,
                color: rarityColor ?? theme.ring,
                background: 'rgba(15,23,42,.8)',
                border: `1px solid ${(rarityColor ?? theme.ring)}88`,
                boxShadow: rarityGlow ? `0 0 5px -1px ${rarityGlow}` : 'none',
              }}
            >
              {SLOT_META[slot].icon}
            </span>
          ))}
          {equippedSlots.length > visibleSlots.length ? (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: Math.max(6, Math.round(px * 0.1)),
                color: rarityColor ?? theme.ring,
              }}
            >
              +{equippedSlots.length - visibleSlots.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {layers.map((layer, index) => (
        <LayerImage
          key={`${layer.key}-${layer.slot ?? 'base'}-${index}`}
          layer={layer}
          canvasWidth={state.canvas.width}
          canvasHeight={state.canvas.height}
          instanceId={`${instanceId}-${index}`}
          accent={theme.ring}
          accentDark={theme.from}
          rarityGlow={rarityGlow}
        />
      ))}
    </div>
  );
}

function LayerImage({
  layer,
  canvasWidth,
  canvasHeight,
  instanceId,
  accent,
  accentDark,
  rarityGlow,
}: {
  readonly layer: ResolvedLayer;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly instanceId: string;
  readonly accent: string;
  readonly accentDark: string;
  readonly rarityGlow: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const zIndex = LAYER_Z_INDEX[layer.key] + (layer.zOffset < 0 ? -5 : 0);
  const style = { ...layerStyle(layer, canvasWidth, canvasHeight), zIndex };
  const sheet = layer.asset.sheet;

  // Sem arte física PNG, recorre ao SVG paramétrico do slot (bow, staff,
  // robe, hood...), já posicionado no rect oficial do canvas 256×256.
  if (failed) {
    const layerGlow = layer.rarity ? RARITY_COLOR[layer.rarity] : rarityGlow;
    const isBody = layer.key === 'body';
    const parametricSvg = getParametricSvgForLayer(layer.key, layer.slot, {
      assetSrc: layer.asset.src,
      rarityGlow: layerGlow,
      instanceId,
      fill: isBody ? (layer.tint ?? accent) : accent,
      stroke: isBody ? '#7c5a3a' : accentDark,
    });
    if (!parametricSvg) return null;
    return (
      <div
        aria-hidden
        style={{ ...style, aspectRatio: '1 / 1' }}
        dangerouslySetInnerHTML={{ __html: parametricSvg }}
      />
    );
  }

  if (sheet) {
    // Sprite-sheet: mostra o primeiro frame via background-position.
    return (
      <div
        aria-hidden
        style={{
          ...style,
          aspectRatio: `${sheet.frameWidth} / ${sheet.frameHeight}`,
          backgroundImage: `url(${layer.asset.src})`,
          backgroundSize: `${sheet.columns * 100}% ${sheet.rows * 100}%`,
          backgroundPosition: '0 0',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <img
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          src={layer.asset.src}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
        />
      </div>
    );
  }

  return (
    <img
      src={layer.asset.src}
      alt=""
      aria-hidden
      draggable={false}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      style={{
        ...style,
        objectFit: 'contain',
      }}
    />
  );
}

/** Esqueleto para estados de carregamento (inventário, mercado). */
export function PaperdollSkeleton({ size = 'md' }: { readonly size?: PaperdollSize }) {
  const px = SIZE_PX[size];
  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: Math.round(px * 0.18),
        background: 'linear-gradient(110deg, #12121f 8%, #1a1a2e 18%, #12121f 33%)',
        backgroundSize: '200% 100%',
        animation: 'paperdoll-shimmer 1.4s linear infinite',
      }}
    />
  );
}
