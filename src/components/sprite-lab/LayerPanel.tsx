'use client';

/**
 * LayerPanel — sidebar for managing sprite layers.
 *
 * Lists all layers with visibility toggles, add/remove, and selection.
 * Drag-to-reorder is visually indicated (up/down buttons for accessibility).
 */
import type { PaperdollLayerKey } from '@/types/game';
import { PAPERDOLL_LAYER_ORDER } from '@/types/game';
import type { SpriteContent, SpriteLayerConfig } from '@/lib/sprite-lab/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────────────────────── */

const LAYER_ICONS: Readonly<Record<PaperdollLayerKey, string>> = {
  aura: '✨',
  wings: '🪽',
  body: '🧍',
  armor: '🛡',
  helmet: '⛑',
  weapon: '⚔',
  vfx: '💫',
};

/* ────────────────────────────────────────────────────────────────────────────
 * Props
 * ──────────────────────────────────────────────────────────────────────────── */

export interface LayerPanelProps {
  readonly layers: readonly SpriteLayerConfig[];
  readonly selectedLayerId: string | null;
  readonly onSelect: (layerId: string) => void;
  readonly onToggleVisibility: (layerId: string) => void;
  readonly onAdd: (key: PaperdollLayerKey) => void;
  readonly onRemove: (layerId: string) => void;
  readonly onMoveUp: (layerId: string) => void;
  readonly onMoveDown: (layerId: string) => void;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

export function LayerPanel({
  layers,
  selectedLayerId,
  onSelect,
  onToggleVisibility,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
}: LayerPanelProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-xl flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">📑</span>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Sprite Layers
          </h3>
        </div>
        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
          {layers.length}
        </span>
      </div>

      {/* Layer list with independent scroll */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {layers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Nenhuma camada ativa. Adicione uma abaixo.
          </div>
        ) : null}

        {[...layers]
          .sort((a, b) => b.zIndex - a.zIndex)
          .map((layer) => {
            const isSelected = layer.id === selectedLayerId;
            return (
              <div
                key={layer.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(layer.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(layer.id);
                  }
                }}
                className={[
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer select-none border',
                  isSelected
                    ? 'bg-arcane-500/15 border-arcane-500/60 shadow-md shadow-arcane-500/5 ring-1 ring-arcane-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300',
                ].join(' ')}
              >
                {/* Icon */}
                <span className="text-base shrink-0 w-6 text-center" aria-hidden>
                  {LAYER_ICONS[layer.key]}
                </span>

                {/* Label + type */}
                <div className="flex-1 min-w-0">
                  <span className={`block text-xs font-semibold truncate ${isSelected ? 'text-arcane-300' : 'text-slate-200'}`}>
                    {layer.label}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="uppercase font-medium text-slate-400">{layer.key}</span>
                    <span>•</span>
                    <span>z-{layer.zIndex}</span>
                    <span>{contentLabel(layer.content)}</span>
                  </div>
                </div>

                {/* Visibility toggle */}
                <button
                  type="button"
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(layer.id);
                  }}
                  className={[
                    'shrink-0 text-xs w-6 h-6 rounded-md flex items-center justify-center transition-colors border',
                    layer.visible
                      ? 'border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:border-slate-600'
                      : 'border-slate-800 bg-slate-950 text-slate-600 hover:text-slate-400',
                  ].join(' ')}
                >
                  {layer.visible ? '👁' : '🚫'}
                </button>

                {/* Reorder buttons */}
                <div className="flex flex-col shrink-0 gap-0.5">
                  <button
                    type="button"
                    title="Move up (higher z-index)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveUp(layer.id);
                    }}
                    className="text-[9px] w-5 h-3 rounded flex items-center justify-center text-slate-500 hover:text-arcane-400 hover:bg-slate-800 transition-colors"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    title="Move down (lower z-index)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveDown(layer.id);
                    }}
                    className="text-[9px] w-5 h-3 rounded flex items-center justify-center text-slate-500 hover:text-arcane-400 hover:bg-slate-800 transition-colors"
                  >
                    ▼
                  </button>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  title="Remove layer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(layer.id);
                  }}
                  className="shrink-0 text-xs text-slate-600 hover:text-rose-400 w-6 h-6 rounded-md flex items-center justify-center hover:bg-rose-950/30 transition-colors"
                >
                  ✕
                </button>
              </div>
            );
          })}
      </div>

      {/* Add layer quick buttons */}
      <div className="border-t border-slate-800 pt-2.5 mt-2 shrink-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          + Add Paperdoll Slot
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {PAPERDOLL_LAYER_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onAdd(key)}
              className="flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md bg-slate-950/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-[11px] text-slate-300 hover:text-white transition-all active:scale-95"
            >
              <span className="text-xs">{LAYER_ICONS[key]}</span>
              <span className="capitalize truncate text-[10px]">{key}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function contentLabel(content: SpriteContent): string {
  if (content.type === 'image') return '· img';
  return '· svg';
}
