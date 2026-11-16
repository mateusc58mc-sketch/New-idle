/**
 * PRNG determinístico — xorshift128.
 *
 * Porque não `Math.random()`: o `CombatState` carrega `seed` + `rngCursor`
 * e a mesma sequência tem de reproduzir a mesma luta no cliente, no servidor
 * (validação anti-cheat) e nos testes de balanceamento.
 *
 * Uso:
 *   const rng = createRng(state.seed);
 *   rng.next();            // 0..1
 *   rng.int(1, 100);       // 1..100
 *   rng.chance(0.15);      // true 15% das vezes
 *   rng.pick(items);       // elemento aleatório
 */

export interface Rng {
  /** Próximo float em [0, 1). */
  next(): number;
  /** Inteiro em [min, max] inclusive. */
  int(min: number, max: number): number;
  /** `true` com probabilidade `p` (0..1). */
  chance(p: number): boolean;
  /** Escolha uniforme. Lança se o array estiver vazio. */
  pick<T>(items: readonly T[]): T;
  /** Escolha ponderada. Pesos ≤ 0 são ignorados. */
  weighted<T>(items: readonly Weighted<T>[]): T;
  /** Fisher–Yates não destrutivo. */
  shuffle<T>(items: readonly T[]): readonly T[];
  /** Estado actual — persistir para retomar exactamente onde parou. */
  getState(): RngState;
}

export interface Weighted<T> {
  readonly value: T;
  readonly weight: number;
}

export interface RngState {
  readonly seed: number;
  readonly s0: number;
  readonly s1: number;
  readonly s2: number;
  readonly s3: number;
  readonly cursor: number;
}

const UINT32 = 0xffffffff;

/** Hash simples para derivar seeds estáveis de strings (ex.: `floor:12:wave:3`). */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normaliseSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1;
  const n = Math.floor(seed) >>> 0;
  return n === 0 ? 0x9e3779b9 : n;
}

export function createRng(seed: number, state?: Omit<RngState, 'seed'>): Rng {
  const base = normaliseSeed(seed);
  let s0 = (state?.s0 ?? base) >>> 0;
  let s1 = (state?.s1 ?? (base ^ 0x9e3779b9)) >>> 0;
  let s2 = (state?.s2 ?? (base ^ 0x243f6a88)) >>> 0;
  let s3 = (state?.s3 ?? (base ^ 0xb7e15162)) >>> 0;
  let cursor = state?.cursor ?? 0;

  // xorshift128 exige estado não nulo.
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;

  const next = (): number => {
    const t = s0 ^ ((s0 << 11) & UINT32);
    s0 = s1;
    s1 = s2;
    s2 = s3;
    s3 = (s3 ^ (s3 >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    cursor += 1;
    // 2^32 → [0, 1)
    return s3 / 4294967296;
  };

  const rng: Rng = {
    next,
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      if (hi < lo) return lo;
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    chance(p) {
      if (p <= 0) return false;
      if (p >= 1) return true;
      return next() < p;
    },
    pick(items) {
      if (items.length === 0) {
        throw new Error('rng.pick: array vazio');
      }
      const index = Math.floor(next() * items.length);
      // `noUncheckedIndexedAccess`: o índice está garantidamente no intervalo.
      const chosen = items[index];
      if (chosen === undefined) {
        throw new Error('rng.pick: índice fora do intervalo');
      }
      return chosen;
    },
    weighted(items) {
      const usable = items.filter((entry) => entry.weight > 0);
      const total = usable.reduce((sum, entry) => sum + entry.weight, 0);
      if (usable.length === 0 || total <= 0) {
        throw new Error('rng.weighted: nenhum peso positivo');
      }
      let roll = next() * total;
      for (const entry of usable) {
        roll -= entry.weight;
        if (roll <= 0) return entry.value;
      }
      const last = usable[usable.length - 1];
      if (!last) throw new Error('rng.weighted: estado impossível');
      return last.value;
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const a = copy[i];
        const b = copy[j];
        if (a === undefined || b === undefined) continue;
        copy[i] = b;
        copy[j] = a;
      }
      return copy;
    },
    getState() {
      return { seed: base, s0, s1, s2, s3, cursor };
    },
  };

  return rng;
}

