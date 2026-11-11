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
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">✨</span>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Rarity & Aura Glow
          </h3>
        </div>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-md border tracking-wide uppercase transition-all"
          style={{
            color: activeColor,
            borderColor: `${activeColor}66`,
            backgroundColor: `${activeColor}15`,
            boxShadow: glowEnabled ? `0 0 10px ${activeGlow}` : 'none',
          }}
        >
          {RARITY_LABEL[rarity]}
        </span>
      </div>

      {/* Rarity grid selection */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
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
                'px-2 py-2 rounded-lg text-xs font-semibold transition-all text-center border active:scale-95 select-none',
                isSelected
                  ? 'border-white/40 bg-slate-800 font-bold shadow-md scale-[1.02]'
                  : 'border-slate-800/80 bg-slate-950/70 hover:bg-slate-800/80 hover:border-slate-700 text-slate-400',
              ].join(' ')}
              style={{
                color: isSelected ? color : undefined,
                boxShadow: isSelected && glowEnabled ? `0 0 12px ${glow}` : 'none',
              }}
            >
              {RARITY_LABEL[tier]}
            </button>
          );
        })}
      </div>

      {/* Glow Enable Toggle */}
      <div className="flex items-center justify-between py-2 border-t border-slate-800/80">
        <span className="text-xs font-medium text-slate-300">Shader Glow Filter</span>
        <button
          type="button"
          onClick={() => onGlowToggle(!glowEnabled)}
          className={[
            'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
            glowEnabled ? 'bg-arcane-500' : 'bg-slate-800 border border-slate-700',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
              glowEnabled ? 'left-[22px]' : 'left-0.5',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Intensity slider */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400 font-medium">Glow Intensity</span>
          <span className="text-xs text-arcane-400 font-mono font-bold tabular-nums">
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
          className="w-full h-1.5 rounded-lg appearance-none bg-slate-800 accent-arcane-400 cursor-pointer disabled:opacity-30"
        />
      </div>
    </div>
  );
}
