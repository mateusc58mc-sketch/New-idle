'use client';

/**
 * AnimationControls — controls to preview character animation states on the sprite canvas.
 *
 * States correspond to game engine states: idle, attack, hit, cast, death.
 */
import type { SynthesizerState } from '@/lib/sprite-lab/types';

export interface AnimationControlsProps {
  readonly currentAnimation: SynthesizerState['animationState'];
  readonly onAnimationChange: (animation: SynthesizerState['animationState']) => void;
}

const ANIMATION_PRESETS: readonly {
  readonly id: SynthesizerState['animationState'];
  readonly label: string;
  readonly icon: string;
}[] = [
  { id: 'idle', label: 'Idle', icon: '🍃' },
  { id: 'attack', label: 'Attack', icon: '⚔️' },
  { id: 'hit', label: 'Hit', icon: '💥' },
  { id: 'cast', label: 'Cast', icon: '🔮' },
  { id: 'death', label: 'Death', icon: '💀' },
] as const;

export function AnimationControls({
  currentAnimation,
  onAnimationChange,
}: AnimationControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-800 shrink-0">
        <span className="w-2 h-2 rounded-full bg-arcane-400 animate-pulse" />
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Animation Engine
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {ANIMATION_PRESETS.map((anim) => {
          const isActive = anim.id === currentAnimation;
          return (
            <button
              key={anim.id}
              type="button"
              onClick={() => onAnimationChange(anim.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border select-none active:scale-95',
                isActive
                  ? 'bg-arcane-500/20 border-arcane-400 text-arcane-300 shadow-lg shadow-arcane-500/10 ring-1 ring-arcane-400/30'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 hover:border-slate-700',
              ].join(' ')}
              title={`Simulate state: ${anim.label}`}
            >
              <span className="text-sm">{anim.icon}</span>
              <span>{anim.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
