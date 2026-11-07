/**
 * Catálogo de raças — 9 raças clássicas.
 *
 * REGRA DE OURO (wiki): raça NÃO restringe classe, e os bónus são pequenos
 * para não trancar builds. Todos os valores são `flat` ou `percent` sobre
 * stats derivados, nunca sobre atributos primários directamente (isso é
 * `attributeBonus`, aplicado na criação).
 *
 * REGRA DE ARTE: `canvas` e `anchors` são IGUAIS em todas as raças. Só o
 * `bodyLayer` muda. É isto que permite reutilizar qualquer armadura em
 * qualquer raça sem desalinhamento — o critério de pronto da wiki.
 *
 * Regeneração (Pandaren/Troll) usa `regenPct` — % do MaxHP por segundo, fora
 * de combate ou em combate conforme o motor decidir. Ver `DerivedStatKey`.
 */
import type { PaperdollAnchor, Race, RacePaperdoll } from '@/types/game';

/** Caixa lógica comum a todas as raças (arte base 256×256). */
export const PAPERDOLL_CANVAS = { width: 256, height: 256, displayScale: 1 } as const;

/**
 * Âncoras partilhadas. Valores em px da arte-base de 256×256, com o avatar
 * centrado. Ajustar aqui desalinha TODAS as raças ao mesmo tempo — é
 * intencional: é o único ponto de calibração do sistema.
 */
const ZERO_ANCHOR: PaperdollAnchor = { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false };

/**
 * Constrói o `RacePaperdoll` de uma raça. Todas as raças passam por aqui,
 * logo é estruturalmente impossível dar âncoras diferentes a uma delas.
 */
function buildPaperdoll(bodySrc: string): RacePaperdoll {
  return {
    bodyLayer: {
      src: bodySrc,
      sheet: { frameWidth: 256, frameHeight: 256, columns: 4, rows: 1, fps: 8 },
    },
    canvas: PAPERDOLL_CANVAS,
    anchors: {
      aura: ZERO_ANCHOR,
      wings: ZERO_ANCHOR,
      body: ZERO_ANCHOR,
      armor: ZERO_ANCHOR,
      helmet: ZERO_ANCHOR,
      weapon: ZERO_ANCHOR,
      vfx: ZERO_ANCHOR,
    },
    animations: ['idle', 'attack', 'hit', 'cast', 'death'],
  };
}

const base = '/assets/paperdoll/races';

export const RACES: readonly Race[] = [
  /* ---------------------------------------------------------------- 1/9 */
  {
    id: 'race.human',
    name: 'Humano',
    slug: 'human',
    lore: 'Adaptáveis por natureza. Não brilham em nada, aprendem tudo.',
    modifiers: [
      { stat: 'expBonus', kind: 'percent', value: 6 },
      { stat: 'dropBonus', kind: 'flat', value: 2 },
    ],
    attributeBonus: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
    paperdoll: buildPaperdoll(`${base}/human.png`),
    palette: { skin: '#e8c39e', hair: '#4a3728', primary: '#3b82f6', accent: '#93c5fd' },
    unlock: 'default',
  },

  /* ---------------------------------------------------------------- 2/9 */
  {
    id: 'race.dwarf',
    name: 'Anão',
    slug: 'dwarf',
    lore: 'Forjados na pedra. Aguardam o golpe que não chega a doer.',
    modifiers: [
      { stat: 'maxHp', kind: 'percent', value: 6 },
      { stat: 'def', kind: 'flat', value: 14 },
    ],
    attributeBonus: { vit: 3, str: 1 },
    paperdoll: buildPaperdoll(`${base}/dwarf.png`),
    palette: { skin: '#d9a87c', hair: '#a16207', primary: '#b45309', accent: '#fbbf24' },
    unlock: 'default',
  },

  /* ---------------------------------------------------------------- 3/9 */
  {
    id: 'race.elf',
    name: 'Elfo',
    slug: 'elf',
    lore: 'Ligeiros como folhas ao vento. Raramente são atingidos.',
    modifiers: [
      { stat: 'flee', kind: 'flat', value: 16 },
      { stat: 'hit', kind: 'flat', value: 6 },
    ],
    attributeBonus: { agi: 2, dex: 2 },
    paperdoll: buildPaperdoll(`${base}/elf.png`),
    palette: { skin: '#f2d9c0', hair: '#e8e8e8', primary: '#10b981', accent: '#6ee7b7' },
    unlock: 'default',
  },

  /* ---------------------------------------------------------------- 4/9 */
  {
    id: 'race.goblin',
    name: 'Goblin',
    slug: 'goblin',
    lore: 'Pequenos, nervosos, rápidos. Batem três vezes antes do primeiro golpe alheio.',
    modifiers: [
      // +ASPD é o bónus identitário: acelera o farm sem inflacionar dano por golpe.
      { stat: 'attackSpeed', kind: 'percent', value: 12 },
      { stat: 'crit', kind: 'flat', value: 3 },
    ],
    attributeBonus: { agi: 2, dex: 2 },
    paperdoll: buildPaperdoll(`${base}/goblin.png`),
    palette: { skin: '#7cb342', hair: '#3e2723', primary: '#65a30d', accent: '#bef264' },
    unlock: 'default',
  },

  /* ---------------------------------------------------------------- 5/9 */
  {
    id: 'race.orc',
    name: 'Orc',
    slug: 'orc',
    lore: 'Troca resiliência por fúria. Bate mais forte quanto menos lhe resta.',
    modifiers: [
      // +ATK condicionado: a fórmula de HP baixo entra em stats.ts (lowHpAtk).
      { stat: 'atk', kind: 'percent', value: 6 },
      { stat: 'lowHpAtk', kind: 'percent', value: 25 },
    ],
    attributeBonus: { str: 3, vit: 1 },
    paperdoll: buildPaperdoll(`${base}/orc.png`),
    palette: { skin: '#6b8f3a', hair: '#1c1917', primary: '#7f1d1d', accent: '#f97316' },
    unlock: 'default',
  },

  /* ---------------------------------------------------------------- 6/9 */
  {
    id: 'race.tauren',
    name: 'Tauren',
    slug: 'tauren',
    lore: 'Uma montanha que respira. Não foge, não cede, não cai.',
    modifiers: [
      { stat: 'maxHp', kind: 'percent', value: 12 },
      { stat: 'def', kind: 'flat', value: 6 },
    ],
    attributeBonus: { vit: 4, str: 1 },
    paperdoll: buildPaperdoll(`${base}/tauren.png`),
    palette: { skin: '#8d6e63', hair: '#4e342e', primary: '#78350f', accent: '#fcd34d' },
    unlock: 'default',
  },

  /* ---------------------------------------------------------------- 7/9 */
  {
    id: 'race.pandaren',
    name: 'Pandaren',
    slug: 'pandaren',
    lore: 'Come, dorme, aguenta. O que não o mata, alimenta-o.',
    modifiers: [
      // Regeneração + resistência a controlo: puro utilitário idle.
      { stat: 'regenPct', kind: 'flat', value: 1.5 },
      { stat: 'controlResist', kind: 'flat', value: 15 },
    ],
    attributeBonus: { vit: 2, str: 2 },
    paperdoll: buildPaperdoll(`${base}/pandaren.png`),
    palette: { skin: '#f5f0e1', hair: '#1f2937', primary: '#0f766e', accent: '#5eead4' },
    unlock: 'market',
  },

  /* ---------------------------------------------------------------- 8/9 */
  {
    id: 'race.undead',
    name: 'Morto-Vivo',
    slug: 'undead',
    lore: 'Já morreu uma vez. A morte perdeu o interesse nele.',
    modifiers: [
      { stat: 'lifesteal', kind: 'flat', value: 5 },
      { stat: 'mdef', kind: 'flat', value: 10 },
    ],
    attributeBonus: { int: 2, luk: 2 },
    paperdoll: buildPaperdoll(`${base}/undead.png`),
    palette: { skin: '#9ca3af', hair: '#1e1b4b', primary: '#6d28d9', accent: '#a78bfa' },
    unlock: 'achievement',
  },

  /* ---------------------------------------------------------------- 9/9 */
  {
    id: 'race.troll',
    name: 'Troll',
    slug: 'troll',
    lore: 'Corta-lhe um braço e volta a crescer. E depois morde-te.',
    modifiers: [
      // Regeneração acelerada + aceleração de bónus (haste de efeitos positivos).
      { stat: 'regenPct', kind: 'flat', value: 3 },
      { stat: 'buffDuration', kind: 'percent', value: 20 },
    ],
    attributeBonus: { agi: 2, vit: 2 },
    paperdoll: buildPaperdoll(`${base}/troll.png`),
    palette: { skin: '#4d7c0f', hair: '#1c1917', primary: '#365314', accent: '#a3e635' },
    unlock: 'market',
  },
] as const;

/** Índice por id — usado pelo resolvedor de Paperdoll (O(1)). */
export const RACE_BY_ID: ReadonlyMap<string, Race> = new Map(RACES.map((race) => [race.id, race]));

/** Raças disponíveis na criação de personagem. */
export const STARTER_RACES: readonly Race[] = RACES.filter((race) => race.unlock === 'default');

export function getRace(raceId: string): Race | null {
  return RACE_BY_ID.get(raceId) ?? null;
}
