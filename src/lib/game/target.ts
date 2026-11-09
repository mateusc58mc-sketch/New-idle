import type { Combatant, FormationPosition } from '@/types/game';

/**
 * Prioridade de linhas: Front → Mid → Back.
 *
 * A regra é absoluta: só se avança para a linha seguinte quando **todos** os
 * membros vivos da linha atual tiverem caído. Se Front e Mid estiverem
 * vazios/mortos, a Back Line é o alvo obrigatório — é isto que mantém o
 * combate a fluir (sem alvos "presos") depois de um wipe parcial.
 */
const LINE_PRIORITY: Readonly<Record<FormationPosition, number>> = {
  front: 0,
  mid: 1,
  back: 2,
};

/**
 * Rank seguro de uma linha. Posições ausentes/corrompidas (dados antigos,
 * seeds de teste) vão para o fim em vez de produzirem `NaN` no sort.
 */
export function lineRank(position: FormationPosition | null | undefined): number {
  if (!position) return Number.MAX_SAFE_INTEGER;
  return LINE_PRIORITY[position] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Ordena alvos vivos pela linha mais próxima ainda ocupada.
 * Sort estável: dentro da mesma linha preserva a ordem recebida.
 */
export function prioritizeTargetLines<T extends Pick<Combatant, 'position'>>(
  combatants: readonly T[],
): T[] {
  return combatants
    .map((actor, index) => ({ actor, index, rank: lineRank(actor.position) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.actor);
}

/**
 * Linha mais avançada com pelo menos um membro (vivo — o chamador filtra).
 * `null` quando não há combatentes.
 */
export function frontmostLine<T extends Pick<Combatant, 'position'>>(
  combatants: readonly T[],
): FormationPosition | null {
  const first = prioritizeTargetLines(combatants)[0];
  return first ? first.position : null;
}
