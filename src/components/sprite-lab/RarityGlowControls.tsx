'use client';

/**
 * RarityGlowControls — controls for the rarity and glow settings in Sprite Lab.
 *
 * Lets developers toggle glow, tune glow intensity, and select the active rarity
 * tier (common, uncommon, rare, epic, legendary, mythic) with live previews.
 */
import { RARITY_COLOR, RARITY_GLOW, RARITY_LABEL } from '@/data/paperdoll-layers';
import type { Rarity } from '@/types/game';
import { RARITY_ORDER } from '@/types/game';

export interface RarityGlowControlsProps {
  readonly rarity: Rarity;
  readonly glowEnabled: boolean;
  readonly glowIntensity: number;
  readonly onRarityChange: (rarity: Rarity) => void;
  readonly onGlowToggle: (enabled: boolean) => void;
  readonly onIntensityChange: (intensity: number) => void;
}

export function RarityGlowControls({
  rarity,
  glowEnabled,
  glowIntensity,
  onRarityChange,
  onGlowToggle,
  onIntensityChange,
}: RarityGlowControlsProps) {
  const activeColor = RARITY_COLOR[rarity];
  const activeGlow = RARITY_GLOW[rarity];

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-arcane-400 tracking-wide uppercase">
          Rarity & Glow
        </h3>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded border"
          style={{
            color: activeColor,
            borderColor: `${activeColor}66`,
            backgroundColor: `${activeColor}15`,
            boxShadow: glowEnabled ? `0 0 8px ${activeGlow}` : 'none',
          }}
        >
          {RARITY_LABEL[rarity]}
        </span>
      </div>

      {/* Rarity grid selection */}
      <div className="grid grid-cols-3 gap-1.5">
        {RARITY_ORDER.map((tier) => {
          const isSelected = tier === rarity;
          const color = RARITY_COLOR[tier];
          const glow = RARITY_GLOW[tier];

          return (
            <button
              key={tier}
              type="button"
              onClick={() => onRarityChange(tier)}
              className={[
                'px-2 py-1.5 rounded text-xs font-medium transition-all text-center border',
                isSelected
                  ? 'border-white/50 bg-void-700 font-bold scale-[1.02]'
                  : 'border-void-700 bg-void-800/80 hover:bg-void-700 text-slate-300',
              ].join(' ')}
              style={{
                color,
                boxShadow: isSelected && glowEnabled ? `0 0 10px ${glow}` : 'none',
              }}
            >
              {RARITY_LABEL[tier]}
            </button>
          );
        })}
      </div>

      {/* Glow Enable Toggle */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-300">Enable Glow Filter</span>
        <button
          type="button"
          onClick={() => onGlowToggle(!glowEnabled)}
          className={[
            'w-9 h-5 rounded-full transition-colors relative cursor-pointer',
            glowEnabled ? 'bg-arcane-500' : 'bg-void-600',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              glowEnabled ? 'left-[18px]' : 'left-0.5',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Intensity slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Glow Intensity</span>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {(glowIntensity * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min={0.1}
          max={1.5}
          step={0.05}
          value={glowIntensity}
          disabled={!glowEnabled}
          onChange={(e) => onIntensityChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-void-700 accent-arcane-500 cursor-pointer disabled:opacity-30"
        />
      </div>
    </div>
  );
}
