'use client';

/**
 * Ascent Gate Idle — Sprite Synthesizer & Mini-Editor
 *
 * Professional Dark Fantasy asset studio dashboard with a clean 3-column
 * responsive studio grid layout for calibrating parametric SVG layers, rarity glows,
 * animations, and reference overlays.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';

import { AnimationControls } from '@/components/sprite-lab/AnimationControls';
import { LayerControls } from '@/components/sprite-lab/LayerControls';
import { LayerPanel } from '@/components/sprite-lab/LayerPanel';
import { RarityGlowControls } from '@/components/sprite-lab/RarityGlowControls';
import { ReferenceUploader } from '@/components/sprite-lab/ReferenceUploader';
import { SynthesizerCanvas } from '@/components/sprite-lab/SynthesizerCanvas';
import { RARITY_GLOW } from '@/data/paperdoll-layers';
import { createDefaultSynthesizerState } from '@/lib/sprite-lab/default-state';
import { TEMPLATE_BY_ID } from '@/lib/sprite-lab/svg-templates';
import type { SpriteLayerConfig, SynthesizerState } from '@/lib/sprite-lab/types';
import type { PaperdollLayerKey, Rarity } from '@/types/game';

const LAYER_Z_DEFAULTS: Readonly<Record<PaperdollLayerKey, number>> = {
  aura: 10,
  wings: 20,
  body: 30,
  armor: 40,
  helmet: 50,
  weapon: 60,
  vfx: 70,
};

export default function SpriteLabPage() {
  const [state, setState] = useState<SynthesizerState>(() => createDefaultSynthesizerState());
  const [zoom, setZoom] = useState<number>(1);

  // Selected layer
  const selectedLayer = useMemo(() => {
    if (!state.selectedLayerId) return null;
    return state.layers.find((l) => l.id === state.selectedLayerId) ?? null;
  }, [state.layers, state.selectedLayerId]);

  /* ─── Layer management handlers ─── */

  const handleSelectLayer = (id: string | null) => {
    setState((prev) => ({ ...prev, selectedLayerId: id }));
  };

  const handleToggleLayerVisibility = (id: string) => {
    setState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    }));
  };

  const handleAddLayer = (key: PaperdollLayerKey) => {
    const newId = `layer-${key}-${Date.now()}`;
    const zIndex = LAYER_Z_DEFAULTS[key] ?? 50;

    // Default template for this category if available
    const template =
      key === 'weapon'
        ? TEMPLATE_BY_ID.get('sword')
        : key === 'armor'
          ? TEMPLATE_BY_ID.get('plate-armor')
          : key === 'helmet'
            ? TEMPLATE_BY_ID.get('knight-helm')
            : key === 'wings'
              ? TEMPLATE_BY_ID.get('feather-wings')
              : key === 'aura'
                ? TEMPLATE_BY_ID.get('energy-aura')
                : null;

    const fill = key === 'weapon' ? '#38bdf8' : '#a78bfa';
    const stroke = '#ffffff';
    const glowColor = RARITY_GLOW[state.rarity] ?? null;

    const pathData = template
      ? template.render({ fill, stroke, glowColor, scale: 1, filterId: `tplGlow-${newId}` })
      : 'M 16 16 L 48 16 L 48 48 L 16 48 Z';

    const newLayer: SpriteLayerConfig = {
      id: newId,
      key,
      label: `New ${key.toUpperCase()}`,
      visible: true,
      opacity: 1,
      offsetX: 96,
      offsetY: 96,
      scale: 1,
      rotation: 0,
      flipX: false,
      content: {
        type: 'svg',
        pathData,
        fill,
        stroke,
        strokeWidth: 1.5,
      },
      zIndex,
    };

    setState((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
      selectedLayerId: newId,
    }));
  };

  const handleRemoveLayer = (id: string) => {
    setState((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
      selectedLayerId: prev.selectedLayerId === id ? null : prev.selectedLayerId,
    }));
  };

  const handleMoveLayer = (id: string, delta: number) => {
    setState((prev) => {
      const idx = prev.layers.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= prev.layers.length) return prev;

      const newLayers = [...prev.layers];
      const current = newLayers[idx];
      const target = newLayers[targetIdx];
      if (!current || !target) return prev;

      newLayers[idx] = target;
      newLayers[targetIdx] = current;

      return { ...prev, layers: newLayers };
    });
  };

  const handleUpdateLayer = (layerId: string, patch: Partial<SpriteLayerConfig>) => {
    setState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id !== layerId) return l;
        return { ...l, ...patch };
      }),
    }));
  };

  const handleApplyTemplate = (layerId: string, templateId: string) => {
    const tpl = TEMPLATE_BY_ID.get(templateId);
    if (!tpl) return;

    setState((prev) => {
      const target = prev.layers.find((l) => l.id === layerId);
      if (!target || target.content.type !== 'svg') return prev;

      const fill = target.content.fill;
      const stroke = target.content.stroke;
      const glowColor = prev.glowEnabled ? RARITY_GLOW[prev.rarity] ?? null : null;

      const renderedMarkup = tpl.render({
        fill,
        stroke,
        glowColor,
        scale: target.scale,
        filterId: `tplGlow-${layerId}`,
      });

      return {
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            label: tpl.name,
            key: tpl.layer,
            content: {
              ...target.content,
              pathData: renderedMarkup,
            },
          };
        }),
      };
    });
  };

  /* ─── Rarity & Animation handlers ─── */

  const handleRarityChange = (rarity: Rarity) => {
    setState((prev) => ({ ...prev, rarity }));
  };

  const handleGlowToggle = (glowEnabled: boolean) => {
    setState((prev) => ({ ...prev, glowEnabled }));
  };

  const handleIntensityChange = (glowIntensity: number) => {
    setState((prev) => ({ ...prev, glowIntensity }));
  };

  const handleAnimationChange = (animationState: SynthesizerState['animationState']) => {
    setState((prev) => ({ ...prev, animationState }));
  };

  /* ─── Reference Image Handlers ─── */

  const handleImageLoaded = (dataUrl: string) => {
    setState((prev) => ({
      ...prev,
      referenceImage: dataUrl,
      referenceOpacity: prev.referenceOpacity > 0 ? prev.referenceOpacity : 0.4,
    }));
  };

  const handleClearReference = () => {
    setState((prev) => ({ ...prev, referenceImage: null }));
  };

  const handleOpacityChange = (opacity: number) => {
    setState((prev) => ({ ...prev, referenceOpacity: opacity }));
  };

  /* ─── Export handlers ─── */

  const handleExportSvg = () => {
    const glowColor = RARITY_GLOW[state.rarity] ?? 'rgb(156 163 175 / 0.35)';
    const sorted = [...state.layers].sort((a, b) => a.zIndex - b.zIndex);

    const layerMarkups = sorted
      .filter((l) => l.visible)
      .map((l) => {
        const sx = l.flipX ? -l.scale : l.scale;
        const transform = `translate(${l.offsetX}, ${l.offsetY}) scale(${sx}, ${l.scale}) rotate(${l.rotation})`;
        if (l.content.type === 'svg') {
          if (l.content.pathData.trim().startsWith('<')) {
            return `<g transform="${transform}" opacity="${l.opacity}">${l.content.pathData}</g>`;
          }
          return `<g transform="${transform}" opacity="${l.opacity}"><path d="${l.content.pathData}" fill="${l.content.fill}" stroke="${l.content.stroke}" stroke-width="${l.content.strokeWidth}"/></g>`;
        }
        return `<g transform="${transform}" opacity="${l.opacity}"><image href="${l.content.dataUrl}" width="64" height="64"/></g>`;
      })
      .join('\n');

    const svgDocument = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${state.canvasWidth} ${state.canvasHeight}" width="${state.canvasWidth}" height="${state.canvasHeight}">
  <defs>
    <filter id="rarity-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${state.glowIntensity * 5}" result="blur" />
      <feFlood flood-color="${glowColor}" result="color" />
      <feComposite in="color" in2="blur" operator="in" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect width="${state.canvasWidth}" height="${state.canvasHeight}" fill="${state.backgroundColor}"/>
  <g filter="${state.glowEnabled ? 'url(#rarity-glow)' : 'none'}">
${layerMarkups}
  </g>
</svg>`;

    const blob = new Blob([svgDocument], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ascent-gate-sprite-${state.rarity}-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sprite-synthesizer-preset-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 font-sans select-none">
      {/* ── Fixed Top Header Bar (h-14) ── */}
      <header className="h-14 shrink-0 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 flex items-center justify-between z-30">
        {/* Brand & Breadcrumb */}
        <div className="flex items-center gap-3">
          <Link
            href="/game"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition-all border border-transparent hover:border-slate-700"
          >
            <span>←</span>
            <span>Voltar ao Jogo</span>
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className="text-base">🧪</span>
            <span className="text-sm font-bold tracking-wide text-slate-200">
              Ascent Gate Idle
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-arcane-500/10 text-arcane-400 border border-arcane-500/30">
              Sprite Lab Studio
            </span>
          </div>
        </div>

        {/* Center Viewport Controls (Grid & Zoom) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, showGrid: !p.showGrid }))}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-95',
              state.showGrid
                ? 'bg-arcane-500/15 border-arcane-500/60 text-arcane-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800',
            ].join(' ')}
          >
            <span>🌐</span>
            <span>Grid: {state.showGrid ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <span className="text-[11px] font-medium text-slate-400 px-1.5">Zoom:</span>
            {[1, 1.5, 2].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  zoom === z
                    ? 'bg-slate-800 text-arcane-400 shadow-sm border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {z * 100}%
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setState(createDefaultSynthesizerState())}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all active:scale-95"
            title="Restaurar estado inicial"
          >
            ↺ Reset
          </button>
        </div>

        {/* Action Buttons (Export JSON & SVG) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all active:scale-95 shadow-sm"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleExportSvg}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-arcane-500 hover:bg-arcane-400 text-slate-950 transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-arcane-500/20"
          >
            <span>💾</span>
            <span>Export SVG</span>
          </button>
        </div>
      </header>

      {/* ── 3-Column Studio Grid Layout ── */}
      <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr_340px] overflow-hidden">
        {/* ── LEFT COLUMN (320px): Reference Overlay & Layer Management ── */}
        <aside className="h-full border-r border-slate-800 bg-slate-900/30 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
          <div className="shrink-0">
            <ReferenceUploader
              referenceImage={state.referenceImage}
              referenceOpacity={state.referenceOpacity}
              onImageLoaded={handleImageLoaded}
              onClearImage={handleClearReference}
              onOpacityChange={handleOpacityChange}
            />
          </div>

          <LayerPanel
            layers={state.layers}
            selectedLayerId={state.selectedLayerId}
            onSelect={handleSelectLayer}
            onToggleVisibility={handleToggleLayerVisibility}
            onAdd={handleAddLayer}
            onRemove={handleRemoveLayer}
            onMoveUp={(id) => handleMoveLayer(id, -1)}
            onMoveDown={(id) => handleMoveLayer(id, 1)}
          />
        </aside>

        {/* ── CENTER COLUMN (Flex-1): Canvas Viewport & Floating Animation Bar ── */}
        <main className="h-full relative flex flex-col min-h-0 min-w-0 bg-slate-950 overflow-hidden">
          {/* Canvas Viewport with transparent checkerboard background */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[linear-gradient(45deg,#0f172a_25%,transparent_25%),linear-gradient(-45deg,#0f172a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0f172a_75%),linear-gradient(-45deg,transparent_75%,#0f172a_75%)] [background-size:24px_24px] [background-position:0_0,0_12px,12px_-12px,-12px_0px]">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)]"
            >
              <SynthesizerCanvas
                state={state}
                onSelectLayer={(id) => handleSelectLayer(id)}
              />
            </div>
          </div>

          {/* Floating Bottom Bar: Character Animation State Simulator */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-2xl px-4 py-2.5 shadow-2xl ring-1 ring-white/10">
            <AnimationControls
              currentAnimation={state.animationState}
              onAnimationChange={handleAnimationChange}
            />
          </div>
        </main>

        {/* ── RIGHT COLUMN (340px): Calibration Controls & Rarity Glow ── */}
        <aside className="h-full border-l border-slate-800 bg-slate-900/30 flex flex-col p-3 gap-3 min-h-0 overflow-y-auto">
          <RarityGlowControls
            rarity={state.rarity}
            glowEnabled={state.glowEnabled}
            glowIntensity={state.glowIntensity}
            onRarityChange={handleRarityChange}
            onGlowToggle={handleGlowToggle}
            onIntensityChange={handleIntensityChange}
          />

          <LayerControls
            layer={selectedLayer}
            onUpdate={handleUpdateLayer}
            onApplyTemplate={handleApplyTemplate}
          />
        </aside>
      </div>
    </div>
  );
}
