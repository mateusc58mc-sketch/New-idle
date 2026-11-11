'use client';

/**
 * LayerPanel — sidebar for managing sprite layers.
 *
 * Lists all layers with visibility toggles, add/remove, and selection.
 * Drag-to-reorder is visually indicated (up/down buttons for accessibility).
 */
import type { PaperdollLayerKey } from '@/types/game';
import { PAPERDOLL_LAYER_ORDER } from '@/types/game';
import type { SpriteLayerConfig, SpriteContent } from '@/lib/sprite-lab/types';

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
    <div className="flex flex-col gap-2 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold text-arcane-400 tracking-wide uppercase">
          Layers
        </h3>
        <span className="text-xs text-slate-500">{layers.length}</span>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto space-y-0.5 px-1">
        {layers.length === 0 ? (
          <p className="px-3 py-6 text-xs text-slate-600 text-center">
            No layers yet. Add one below.
          </p>
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
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors cursor-pointer select-none',
                  isSelected
                    ? 'bg-arcane-500/15 ring-1 ring-arcane-500/30'
                    : 'hover:bg-void-700/60',
                ].join(' ')}
              >
                {/* Icon */}
                <span className="text-sm shrink-0 w-5 text-center" aria-hidden>
                  {LAYER_ICONS[layer.key]}
                </span>

                {/* Label + type */}
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-slate-200 truncate">
                    {layer.label}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {layer.key} · z{layer.zIndex}
                    {contentLabel(layer.content)}
                  </span>
                </span>

                {/* Visibility toggle */}
                <button
                  type="button"
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(layer.id);
                  }}
                  className={[
                    'shrink-0 text-xs w-6 h-6 rounded flex items-center justify-center transition-colors',
                    layer.visible
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 hover:text-slate-400',
                  ].join(' ')}
                >
                  {layer.visible ? '👁' : '🚫'}
                </button>

                {/* Reorder buttons */}
                <div className="flex flex-col shrink-0 gap-0.5">
                  <button
                    type="button"
                    title="Move up"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveUp(layer.id);
                    }}
                    className="text-[9px] text-slate-500 hover:text-arcane-400 leading-none"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveDown(layer.id);
                    }}
                    className="text-[9px] text-slate-500 hover:text-arcane-400 leading-none"
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
                  className="shrink-0 text-xs text-slate-600 hover:text-red-400 w-5 h-5 flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
            );
          })}
      </div>

      {/* Add layer dropdown */}
      <div className="border-t border-void-700 pt-2 px-2 pb-2">
        <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">
          Add Layer
        </p>
        <div className="flex flex-wrap gap-1">
          {PAPERDOLL_LAYER_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onAdd(key)}
              className="text-xs px-2 py-1 rounded bg-void-700 hover:bg-void-600 text-slate-300 hover:text-white transition-colors"
            >
              {LAYER_ICONS[key]} {key}
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
  if (content.type === 'image') return ' · img';
  return ' · svg';
}
