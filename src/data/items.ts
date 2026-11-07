/**
 * Catálogo de itens — 20 itens base do MVP.
 *
 * Regras da wiki aplicadas:
 *  · Slots fixos; peitoral e arma recebem 0–4 sockets de carta.
 *  · Refino +1..+15, 5% de bónus por nível (aplicado em `stats.ts`).
 *  · Itens comuns vendem-se a NPC; raridades altas sustentam o mercado.
 *  · `paperdoll` liga o item à camada visual — os 9 slots têm peça visual.
 */
import type { BaseClass, ContentId, DerivedStatKey, Item, PaperdollLayerKey, Rarity, StatModifier } from '@/types/game';

interface ItemSeed {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly slot: Item['slot'];
  readonly weaponType: Item['weaponType'];
  readonly rarity: Rarity;
  readonly level: number;
  readonly classes: readonly BaseClass[] | null;
  readonly mods: readonly { readonly stat: DerivedStatKey; readonly value: number }[];
  readonly sockets: number;
  readonly affixPool: readonly DerivedStatKey[];
  readonly npcValue: number;
  readonly dropWeight: number;
  readonly icon: string;
  readonly glow: string | null;
  readonly layer: PaperdollLayerKey;
  readonly folder: string;
}

const SEEDS: readonly ItemSeed[] = [
  /* ------------------------------------------------------------- ARMAS */
  { id: 'wpn.iron_sword', name: 'Espada de Ferro', description: 'Lâmina de guarnição simples.', slot: 'weapon', weaponType: 'sword', rarity: 'common', level: 1, classes: ['warrior'], mods: [{ stat: 'atk', value: 28 }], sockets: 2, affixPool: ['atk', 'crit'], npcValue: 40, dropWeight: 100, icon: 'sword', glow: null, layer: 'weapon', folder: 'weapon' },
  { id: 'wpn.hunter_bow', name: 'Arco do Caçador', description: 'Curvado em madeira de teixo.', slot: 'weapon', weaponType: 'bow', rarity: 'uncommon', level: 5, classes: ['hunter'], mods: [{ stat: 'atk', value: 44 }, { stat: 'hit', value: 6 }], sockets: 2, affixPool: ['atk', 'crit', 'hit'], npcValue: 120, dropWeight: 70, icon: 'bow', glow: null, layer: 'weapon', folder: 'weapon' },
  { id: 'wpn.arcane_staff', name: 'Cajado Arcano', description: 'Cristal que bebe mana do ar.', slot: 'weapon', weaponType: 'staff', rarity: 'rare', level: 10, classes: ['mage', 'cleric'], mods: [{ stat: 'matk', value: 62 }, { stat: 'maxMp', value: 30 }], sockets: 2, affixPool: ['matk', 'castTime', 'healPower'], npcValue: 320, dropWeight: 45, icon: 'staff', glow: 'rgb(56 189 248 / 0.5)', layer: 'weapon', folder: 'weapon' },
  { id: 'wpn.shadow_dagger', name: 'Adaga das Sombras', description: 'Leve, silenciosa, venenosa.', slot: 'weapon', weaponType: 'dagger', rarity: 'epic', level: 20, classes: ['hunter'], mods: [{ stat: 'atk', value: 88 }, { stat: 'crit', value: 8 }], sockets: 3, affixPool: ['atk', 'crit', 'lifesteal'], npcValue: 900, dropWeight: 18, icon: 'dagger', glow: 'rgb(167 139 250 / 0.55)', layer: 'weapon', folder: 'weapon' },
  { id: 'wpn.iron_mace', name: 'Maça de Guerra', description: 'Simples e eficaz contra armaduras.', slot: 'weapon', weaponType: 'mace', rarity: 'uncommon', level: 6, classes: ['cleric', 'warrior'], mods: [{ stat: 'atk', value: 40 }, { stat: 'def', value: 8 }], sockets: 2, affixPool: ['atk', 'def'], npcValue: 110, dropWeight: 65, icon: 'mace', glow: null, layer: 'weapon', folder: 'weapon' },
  { id: 'wpn.dragon_spear', name: 'Lança do Dragão', description: 'Forjada com uma garra de draconato.', slot: 'weapon', weaponType: 'spear', rarity: 'legendary', level: 30, classes: ['warrior'], mods: [{ stat: 'atk', value: 156 }, { stat: 'maxHp', value: 80 }], sockets: 4, affixPool: ['atk', 'maxHp', 'def'], npcValue: 3400, dropWeight: 5, icon: 'spear', glow: 'rgb(251 191 36 / 0.6)', layer: 'weapon', folder: 'weapon' },

  /* ----------------------------------------------------------- ARMADURAS */
  { id: 'arm.leather_vest', name: 'Colete de Couro', description: 'Protecção de caçador.', slot: 'armor', weaponType: null, rarity: 'common', level: 1, classes: null, mods: [{ stat: 'def', value: 12 }, { stat: 'maxHp', value: 40 }], sockets: 4, affixPool: ['def', 'maxHp', 'flee'], npcValue: 60, dropWeight: 100, icon: 'vest', glow: null, layer: 'armor', folder: 'armor' },
  { id: 'arm.plate_mail', name: 'Cota de Malha', description: 'Pesada, mas segura.', slot: 'armor', weaponType: null, rarity: 'uncommon', level: 8, classes: ['warrior'], mods: [{ stat: 'def', value: 38 }, { stat: 'maxHp', value: 120 }], sockets: 4, affixPool: ['def', 'maxHp', 'mdef'], npcValue: 240, dropWeight: 60, icon: 'mail', glow: null, layer: 'armor', folder: 'armor' },
  { id: 'arm.arcane_robe', name: 'Túnica Arcana', description: 'Tecida com fios de mana.', slot: 'armor', weaponType: null, rarity: 'rare', level: 15, classes: ['mage', 'cleric'], mods: [{ stat: 'def', value: 20 }, { stat: 'matk', value: 34 }, { stat: 'mdef', value: 26 }], sockets: 4, affixPool: ['matk', 'mdef', 'healPower'], npcValue: 520, dropWeight: 30, icon: 'robe', glow: 'rgb(56 189 248 / 0.5)', layer: 'armor', folder: 'armor' },
  { id: 'arm.scout_garb', name: 'Traje de Batedor', description: 'Leve como sombra.', slot: 'armor', weaponType: null, rarity: 'uncommon', level: 6, classes: ['hunter'], mods: [{ stat: 'def', value: 18 }, { stat: 'flee', value: 14 }], sockets: 4, affixPool: ['def', 'flee', 'attackSpeed'], npcValue: 150, dropWeight: 55, icon: 'garb', glow: null, layer: 'armor', folder: 'armor' },
  { id: 'arm.abyssal_plate', name: 'Placa Abissal', description: 'Endurecida no fundo da torre.', slot: 'armor', weaponType: null, rarity: 'mythic', level: 35, classes: null, mods: [{ stat: 'def', value: 92 }, { stat: 'maxHp', value: 340 }, { stat: 'mdef', value: 60 }], sockets: 4, affixPool: ['def', 'maxHp', 'mdef', 'lifesteal'], npcValue: 12000, dropWeight: 1, icon: 'abyss', glow: 'rgb(244 114 182 / 0.65)', layer: 'armor', folder: 'armor' },

  /* --------------------------------------------------------------- ELMOS */
  { id: 'hlm.leather_cap', name: 'Gorro de Couro', description: 'Simples, mas não é nada.', slot: 'helmet', weaponType: null, rarity: 'common', level: 1, classes: null, mods: [{ stat: 'def', value: 6 }], sockets: 0, affixPool: ['def', 'hit'], npcValue: 25, dropWeight: 100, icon: 'cap', glow: null, layer: 'helmet', folder: 'helmet' },
  { id: 'hlm.iron_helm', name: 'Elmo de Ferro', description: 'Cobertura total.', slot: 'helmet', weaponType: null, rarity: 'uncommon', level: 10, classes: ['warrior'], mods: [{ stat: 'def', value: 22 }, { stat: 'maxHp', value: 60 }], sockets: 0, affixPool: ['def', 'maxHp'], npcValue: 180, dropWeight: 55, icon: 'helm', glow: null, layer: 'helmet', folder: 'helmet' },
  { id: 'hlm.arcane_hood', name: 'Capuz Arcano', description: 'Esconde o rosto e os pensamentos.', slot: 'helmet', weaponType: null, rarity: 'rare', level: 18, classes: ['mage', 'cleric'], mods: [{ stat: 'mdef', value: 24 }, { stat: 'matk', value: 18 }], sockets: 0, affixPool: ['mdef', 'matk', 'castTime'], npcValue: 420, dropWeight: 25, icon: 'hood', glow: 'rgb(56 189 248 / 0.5)', layer: 'helmet', folder: 'helmet' },

  /* --------------------------------------------------------- MÃO SECUNDÁRIA */
  { id: 'off.wooden_shield', name: 'Escudo de Madeira', description: 'Melhor que nada.', slot: 'offhand', weaponType: null, rarity: 'common', level: 1, classes: ['warrior'], mods: [{ stat: 'def', value: 14 }], sockets: 0, affixPool: ['def', 'mdef'], npcValue: 30, dropWeight: 90, icon: 'shield', glow: null, layer: 'weapon', folder: 'weapon' },
  { id: 'off.tower_shield', name: 'Escudo Torre', description: 'Uma parede portátil.', slot: 'offhand', weaponType: null, rarity: 'epic', level: 25, classes: ['warrior'], mods: [{ stat: 'def', value: 68 }, { stat: 'maxHp', value: 180 }], sockets: 0, affixPool: ['def', 'maxHp', 'mdef'], npcValue: 1600, dropWeight: 10, icon: 'tower_shield', glow: 'rgb(167 139 250 / 0.55)', layer: 'weapon', folder: 'weapon' },
  { id: 'off.grimoire', name: 'Grimório', description: 'Páginas que se escrevem sozinhas.', slot: 'offhand', weaponType: null, rarity: 'rare', level: 20, classes: ['mage'], mods: [{ stat: 'matk', value: 46 }, { stat: 'maxMp', value: 40 }], sockets: 0, affixPool: ['matk', 'maxMp', 'castTime'], npcValue: 780, dropWeight: 15, icon: 'grimoire', glow: 'rgb(56 189 248 / 0.5)', layer: 'weapon', folder: 'weapon' },

  /* ---------------------------------------------------- CAPA / BOTAS / ACESSÓRIO */
  { id: 'clk.traveler_cloak', name: 'Capa do Viajante', description: 'Já viu muitas torres.', slot: 'cloak', weaponType: null, rarity: 'uncommon', level: 5, classes: null, mods: [{ stat: 'flee', value: 12 }], sockets: 0, affixPool: ['flee', 'def'], npcValue: 90, dropWeight: 65, icon: 'cloak', glow: null, layer: 'body', folder: 'armor' },
  { id: 'bts.swift_boots', name: 'Botas Velozes', description: 'Pisadas que não deixam marca.', slot: 'boots', weaponType: null, rarity: 'rare', level: 12, classes: null, mods: [{ stat: 'attackSpeed', value: 8 }], sockets: 0, affixPool: ['attackSpeed', 'flee'], npcValue: 340, dropWeight: 28, icon: 'boots', glow: 'rgb(56 189 248 / 0.5)', layer: 'armor', folder: 'armor' },
  { id: 'acc.lucky_charm', name: 'Amuleto da Sorte', description: 'Dizem que atrai cartas.', slot: 'accessory', weaponType: null, rarity: 'epic', level: 22, classes: null, mods: [{ stat: 'crit', value: 9 }, { stat: 'dropBonus', value: 6 }], sockets: 0, affixPool: ['crit', 'dropBonus', 'expBonus'], npcValue: 1400, dropWeight: 8, icon: 'charm', glow: 'rgb(167 139 250 / 0.55)', layer: 'vfx', folder: 'aura' },
] as const;

function toItem(seed: ItemSeed): Item {
  const modifiers: readonly StatModifier[] = seed.mods.map((modifier) => ({
    stat: modifier.stat,
    kind: 'flat',
    value: modifier.value,
    source: { type: 'item' as const, itemId: `item.${seed.id}` },
  }));

  return {
    id: `item.${seed.id}`,
    name: seed.name,
    description: seed.description,
    category: 'equipment',
    slot: seed.slot,
    weaponType: seed.weaponType,
    rarity: seed.rarity,
    levelRequirement: seed.level,
    classRestriction: seed.classes,
    baseModifiers: modifiers,
    socketCount: seed.sockets,
    affixPool: seed.affixPool,
    bindRule: seed.rarity === 'mythic' ? 'binds_on_equip' : 'unbound',
    npcSellValue: seed.npcValue,
    dropWeight: seed.dropWeight,
    icon: `/assets/ui/items/${seed.icon}.png`,
    paperdoll: {
      layer: seed.layer,
      asset: { src: `/assets/paperdoll/${seed.folder}/${seed.icon}.png`, sheet: null },
      anchorOverride: null,
      glow: seed.glow,
    },
    tradable: seed.rarity !== 'mythic',
  };
}

export const ITEMS: readonly Item[] = SEEDS.map(toItem);

export const ITEM_BY_ID: ReadonlyMap<ContentId, Item> = new Map(ITEMS.map((item) => [item.id, item]));

export function itemsForSlot(slot: Item['slot']): readonly Item[] {
  return ITEMS.filter((item) => item.slot === slot);
}

/** Itens que podem cair de um mob de nível `level`. */
export function droppableItems(level: number): readonly Item[] {
  return ITEMS.filter((item) => item.levelRequirement <= level + 5 && item.dropWeight > 0);
}
