/**
 * Fronteira de dados não confiáveis (JSON do cliente, Postgres, API).
 *
 * O projecto não usa `any`: dados externos chegam como `unknown` e são
 * estreitados por estes type-guards antes de tocar em lógica de jogo.
 */
import type { AttributeBlock, PrimaryAttribute, Rarity } from '@/types/game';
import { RARITY_ORDER } from '@/types/game';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

export function isPositiveInt(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && (RARITY_ORDER as readonly string[]).includes(value);
}

export function isPrimaryAttribute(value: unknown): value is PrimaryAttribute {
  return value === 'str' || value === 'agi' || value === 'vit' || value === 'int' || value === 'dex' || value === 'luk';
}

/** Extrai `field` de um record, devolvendo `undefined` sem lançar. */
export function readField(source: unknown, field: string): unknown {
  if (!isRecord(source)) return undefined;
  return source[field];
}

export function readString(source: unknown, field: string, fallback = ''): string {
  const value = readField(source, field);
  return isString(value) ? value : fallback;
}

export function readNumber(source: unknown, field: string, fallback = 0): number {
  const value = readField(source, field);
  return isFiniteNumber(value) ? value : fallback;
}

export function readBoolean(source: unknown, field: string, fallback = false): boolean {
  const value = readField(source, field);
  return isBoolean(value) ? value : fallback;
}

/** Normaliza um bloco de atributos vindo de fora, preenchendo zeros. */
export function toAttributeBlock(value: unknown): AttributeBlock {
  const block: Record<PrimaryAttribute, number> = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
  if (!isRecord(value)) return block;
  for (const [key, raw] of Object.entries(value)) {
    if (!isPrimaryAttribute(key)) continue;
    if (!isFiniteNumber(raw)) continue;
    block[key] = Math.max(0, Math.floor(raw));
  }
  return block;
}

/** Asserção de exaustividade para uniões fechadas. */
export function assertNever(value: never, message = 'valor inesperado'): never {
  throw new Error(`${message}: ${String(value)}`);
}
