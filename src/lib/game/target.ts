import type { Combatant, FormationPosition } from '@/types/game';

const LINE_PRIORITY: Readonly<Record<FormationPosition, number>> = {
  front: 0,
  mid: 1,
  back: 2,
};

/** Ordena alvos vivos pela linha mais próxima ainda ocupada. */
export function prioritizeTargetLines<T extends Pick<Combatant, 'position'>>(
  combatants: readonly T[],
): T[] {
  return [...combatants].sort((left, right) => LINE_PRIORITY[left.position] - LINE_PRIORITY[right.position]);
}
