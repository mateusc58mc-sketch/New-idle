/**
 * arena-overlays — keyframes das camadas DOM sobre o canvas Pixi.
 *
 * Só o que ainda é DOM sobrevive aqui: banner de transição (wave/floor),
 * pulso de chefe. Todo o resto do palco (bob, floats, partículas, pulso do
 * ALVO) virou tween no ticker do Pixi.
 */
export const ARENA_OVERLAY_KEYFRAMES = `
@keyframes aetheria-wave-flash {
  0%   { opacity: 0; }
  30%  { opacity: 0.85; }
  100% { opacity: 0; }
}
@keyframes aetheria-floor-rise {
  0%   { opacity: 0; transform: translateY(18px) scale(0.96); }
  20%  { opacity: 1; transform: translateY(0) scale(1); }
  80%  { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-14px) scale(1.02); }
}
@keyframes aetheria-boss-pulse {
  0%, 100% { box-shadow: inset 0 0 40px rgba(239,68,68,.25); }
  50%      { box-shadow: inset 0 0 70px rgba(239,68,68,.55); }
}
`;
