'use client';

/**
 * LayerControls — property editor for the currently selected sprite layer.
 *
 * Sliders for position, scale, rotation, opacity. Toggles for flipX.
 * Color pickers for fill/stroke. SVG template selector dropdown.
 */
import type { SpriteLayerConfig, SpriteContent } from '@/lib/sprite-lab/types';
import { SVG_TEMPLATES } from '@/lib/sprite-lab/svg-templates';

/* ────────────────────────────────────────────────────────────────────────────
 * Props
 * ──────────────────────────────────────────────────────────────────────────── */

export interface LayerControlsProps {
  readonly layer: SpriteLayerConfig | null;
  readonly onUpdate: (layerId: string, patch: Partial<SpriteLayerConfig>) => void;
  readonly onApplyTemplate: (layerId: string, templateId: string) => void;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

export function LayerControls({ layer, onUpdate, onApplyTemplate }: LayerControlsProps) {
  if (!layer) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-xs text-slate-600 text-center">
          Select a layer to edit its properties.
        </p>
      </div>
    );
  }

  const isSvg = layer.content.type === 'svg';
  const svgContent = isSvg ? layer.content : null;
  const targetId = layer.id;

  function patch(partial: Partial<SpriteLayerConfig>) {
    onUpdate(targetId, partial);
  }

  function patchContent(partial: Partial<SpriteContent & { readonly type: 'svg' }>) {
    if (!svgContent) return;
    onUpdate(targetId, {
      content: { ...svgContent, ...partial },
    });
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-2 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-arcane-400 tracking-wide uppercase">
          Properties
        </h3>
        <span className="text-xs text-slate-500 truncate max-w-[120px]">
          {layer.label}
        </span>
      </div>

      {/* Label */}
      <ControlGroup label="Label">
        <input
          type="text"
          value={layer.label}
          onChange={(e) => patch({ label: e.target.value })}
          className="w-full bg-void-800 border border-void-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-arcane-500"
        />
      </ControlGroup>

      {/* Position */}
      <ControlGroup label="Position">
        <div className="grid grid-cols-2 gap-2">
          <SliderField
            label="X"
            value={layer.offsetX}
            min={-128}
            max={384}
            step={1}
            onChange={(v) => patch({ offsetX: v })}
          />
          <SliderField
            label="Y"
            value={layer.offsetY}
            min={-128}
            max={384}
            step={1}
            onChange={(v) => patch({ offsetY: v })}
          />
        </div>
      </ControlGroup>

      {/* Scale */}
      <SliderField
        label="Scale"
        value={layer.scale}
        min={0.1}
        max={3.0}
        step={0.05}
        onChange={(v) => patch({ scale: v })}
      />

      {/* Rotation */}
      <SliderField
        label="Rotation"
        value={layer.rotation}
        min={0}
        max={360}
        step={1}
        onChange={(v) => patch({ rotation: v })}
      />

      {/* Opacity */}
      <SliderField
        label="Opacity"
        value={layer.opacity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => patch({ opacity: v })}
      />

      {/* FlipX */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Flip X</span>
        <button
          type="button"
          onClick={() => patch({ flipX: !layer.flipX })}
          className={[
            'w-9 h-5 rounded-full transition-colors relative',
            layer.flipX ? 'bg-arcane-500' : 'bg-void-600',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              layer.flipX ? 'left-[18px]' : 'left-0.5',
            ].join(' ')}
          />
        </button>
      </div>

      {/* SVG-specific controls */}
      {isSvg && svgContent ? (
        <>
          <hr className="border-void-700" />

          {/* Fill */}
          <ControlGroup label="Fill Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={svgContent.fill}
                onChange={(e) => patchContent({ fill: e.target.value })}
                className="w-7 h-7 rounded border border-void-600 bg-void-800 cursor-pointer"
              />
              <input
                type="text"
                value={svgContent.fill}
                onChange={(e) => patchContent({ fill: e.target.value })}
                className="flex-1 bg-void-800 border border-void-600 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-arcane-500"
              />
            </div>
          </ControlGroup>

          {/* Stroke */}
          <ControlGroup label="Stroke Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={svgContent.stroke}
                onChange={(e) => patchContent({ stroke: e.target.value })}
                className="w-7 h-7 rounded border border-void-600 bg-void-800 cursor-pointer"
              />
              <input
                type="text"
                value={svgContent.stroke}
                onChange={(e) => patchContent({ stroke: e.target.value })}
                className="flex-1 bg-void-800 border border-void-600 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-arcane-500"
              />
            </div>
          </ControlGroup>

          {/* Stroke Width */}
          <SliderField
            label="Stroke Width"
            value={svgContent.strokeWidth}
            min={0}
            max={5}
            step={0.25}
            onChange={(v) => patchContent({ strokeWidth: v })}
          />
        </>
      ) : null}

      {/* Template Selector */}
      <hr className="border-void-700" />
      <ControlGroup label="Apply Template">
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onApplyTemplate(layer.id, e.target.value);
            }
          }}
          className="w-full bg-void-800 border border-void-600 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-arcane-500"
        >
          <option value="">Select template…</option>
          {SVG_TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name} ({tpl.category})
            </option>
          ))}
        </select>
      </ControlGroup>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────────────────────── */

function ControlGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs text-slate-500 font-mono tabular-nums w-12 text-right">
          {typeof value === 'number' ? (Number.isInteger(step) ? value : value.toFixed(2)) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-void-700 accent-arcane-500 cursor-pointer"
      />
    </div>
  );
}
