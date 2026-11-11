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
    <div className="flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-arcane-400 tracking-wide uppercase">
          Animation State
        </h4>
        <span className="text-[11px] text-slate-500 capitalize">{currentAnimation}</span>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {ANIMATION_PRESETS.map((anim) => {
          const isActive = anim.id === currentAnimation;
          return (
            <button
              key={anim.id}
              type="button"
              onClick={() => onAnimationChange(anim.id)}
              className={[
                'flex flex-col items-center justify-center p-1.5 rounded text-center transition-all border',
                isActive
                  ? 'bg-arcane-500/20 border-arcane-500 text-arcane-400 font-bold scale-[1.03]'
                  : 'bg-void-800/80 border-void-700 text-slate-400 hover:text-slate-200 hover:bg-void-700',
              ].join(' ')}
              title={`Simulate ${anim.label}`}
            >
              <span className="text-sm">{anim.icon}</span>
              <span className="text-[10px] mt-0.5">{anim.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
