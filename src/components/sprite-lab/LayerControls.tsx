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
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-xl text-center flex flex-col items-center justify-center gap-2">
        <span className="text-2xl text-slate-600">🎯</span>
        <p className="text-xs text-slate-400 font-medium">
          Selecione uma camada na barra lateral para calibrar coordenadas, escala e cores.
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
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-xl flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-sm">🎛️</span>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Layer Calibration
          </h3>
        </div>
        <span className="text-[11px] font-mono text-arcane-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate max-w-[130px]">
          {layer.label}
        </span>
      </div>

      {/* Label Edit */}
      <ControlGroup label="Layer Label">
        <input
          type="text"
          value={layer.label}
          onChange={(e) => patch({ label: e.target.value })}
          className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-arcane-400 focus:border-arcane-400 transition-all font-medium"
        />
      </ControlGroup>

      {/* Position */}
      <ControlGroup label="Offset Coordinates (px)">
        <div className="grid grid-cols-2 gap-2.5">
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

      {/* Scale & Rotation */}
      <div className="grid grid-cols-2 gap-2.5">
        <SliderField
          label="Scale"
          value={layer.scale}
          min={0.1}
          max={3.0}
          step={0.05}
          onChange={(v) => patch({ scale: v })}
        />
        <SliderField
          label="Rotation (°)"
          value={layer.rotation}
          min={0}
          max={360}
          step={1}
          onChange={(v) => patch({ rotation: v })}
        />
      </div>

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
      <div className="flex items-center justify-between py-1 px-1 bg-slate-950/60 rounded-lg border border-slate-800">
        <span className="text-xs text-slate-300 font-medium pl-1">Espelhar Horizontalmente (Flip X)</span>
        <button
          type="button"
          onClick={() => patch({ flipX: !layer.flipX })}
          className={[
            'w-9 h-5 rounded-full transition-colors relative cursor-pointer',
            layer.flipX ? 'bg-arcane-500' : 'bg-slate-800 border border-slate-700',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
              layer.flipX ? 'left-[18px]' : 'left-0.5',
            ].join(' ')}
          />
        </button>
      </div>

      {/* SVG-specific controls */}
      {isSvg && svgContent ? (
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          {/* Fill & Stroke colors */}
          <div className="grid grid-cols-2 gap-2">
            <ControlGroup label="Fill Color">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 rounded-lg p-1">
                <input
                  type="color"
                  value={svgContent.fill}
                  onChange={(e) => patchContent({ fill: e.target.value })}
                  className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={svgContent.fill}
                  onChange={(e) => patchContent({ fill: e.target.value })}
                  className="w-full bg-transparent text-[11px] font-mono text-slate-300 focus:outline-none"
                />
              </div>
            </ControlGroup>

            <ControlGroup label="Stroke Color">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 rounded-lg p-1">
                <input
                  type="color"
                  value={svgContent.stroke}
                  onChange={(e) => patchContent({ stroke: e.target.value })}
                  className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={svgContent.stroke}
                  onChange={(e) => patchContent({ stroke: e.target.value })}
                  className="w-full bg-transparent text-[11px] font-mono text-slate-300 focus:outline-none"
                />
              </div>
            </ControlGroup>
          </div>

          {/* Stroke Width */}
          <SliderField
            label="Stroke Width"
            value={svgContent.strokeWidth}
            min={0}
            max={5}
            step={0.25}
            onChange={(v) => patchContent({ strokeWidth: v })}
          />
        </div>
      ) : null}

      {/* Template Selector */}
      <div className="pt-2 border-t border-slate-800/80">
        <ControlGroup label="Preset SVG Template">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onApplyTemplate(layer.id, e.target.value);
              }
            }}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-arcane-400 cursor-pointer font-medium"
          >
            <option value="">Carregar template pronto...</option>
            {SVG_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({tpl.category})
              </option>
            ))}
          </select>
        </ControlGroup>
      </div>
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
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
        {label}
      </span>
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
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-300">{label}</span>
        <span className="text-[11px] font-mono font-bold text-arcane-400 tabular-nums">
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
        className="w-full h-1.5 rounded-lg appearance-none bg-slate-800 accent-arcane-400 cursor-pointer"
      />
    </div>
  );
}
