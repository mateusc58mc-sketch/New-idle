/**
 * ============================================================================
 *  ASCENT GATE IDLE — Tipagens canónicas do domínio de jogo
 * ============================================================================
 *  Fonte de verdade: wiki do projeto (Notion) — "Idle RPG Torre + RMT".
 *  Regras numeradas neste ficheiro seguem as páginas:
 *    · Sistemas, Atributos e Progressão
 *    · Combate e Atributos
 *    · Classes, Skills e Templo das Artes Mágicas
 *    · Progressão da Torre · XP e Leveling · Drops e Itens · Mercado e Economia
 *    · Direção de Arte, Tecnologia e Produção (Paperdoll 2D)
 *
 *  CONVENÇÕES DESTE FICHEIRO
 *  ------------------------------------------------------------------------
 *  1. `type` para uniões/aliases, `interface` para entidades extensíveis.
 *  2. ZERO `any`. Estado aberto usa `unknown` + type-guard na fronteira
 *     (ver `isRecord` em src/lib/game/guards.ts, a criar na etapa 3).
 *  3. Todos os números do jogo são `number` (finitude garantida na
 *     normalização). Nada de `bigint` — serializa mal em JSON/Supabase.
 *  4. Fronteira client/server explícita: entidades de persistência são
 *     `Row` (snake_case, Postgres) e o domínio é camelCase. A conversão
 *     vive em src/lib/supabase/mappers.ts (etapa 4).
 *  5. Tudo o que é "rascunho de balanceamento" na wiki está marcado com
 *     `@tuning` — valor provisório, isolado em src/data/balance.ts.
 *  6. Nenhum tipo importa outro módulo: este ficheiro é a raiz do grafo.
 * ============================================================================
 */

/* ==========================================================================
 * 1. PRIMITIVOS E IDENTIFICADORES
 * ========================================================================== */

/** UUID v4 em minúsculas. Itens/mercado preservam o UUID (requisito da wiki). */
export type Uuid = string;

/** Identificador estável de conteúdo (catálogo), ex.: `skill.arch.meteoro`. */
export type ContentId = string;

/** Timestamps sempre em ISO-8601 UTC (`2026-11-06T19:25:00.000Z`). */
export type IsoTimestamp = string;

/** Milissegundos desde a época (uso interno do loop de combate). */
export type EpochMs = number;

/** Moedas do jogo. Gold = farm; Cristais = premium; Cash = RMT. */
export type Currency = 'gold' | 'crystals' | 'cash';

/** Raridade única partilhada por itens, skills e cosméticos (6 níveis). */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

/** Ordem canónica de raridade — usada para glow, filtros e pity. */
export const RARITY_ORDER: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
] as const;

/** Os seis atributos primários (STR/AGI/VIT/INT/DEX/LUK). */
export type PrimaryAttribute = 'str' | 'agi' | 'vit' | 'int' | 'dex' | 'luk';

/** Mapa de atributos primários — sempre completo, nunca parcial. */
export type AttributeBlock = Readonly<Record<PrimaryAttribute, number>>;

/* ==========================================================================
 * 2. RAÇAS
 * ========================================================================== */

/**
 * Modificador racial aplicado sobre um stat derivado.
 * A wiki exige bónus pequenos ("não trancar builds") e raça NÃO restringe
 * classe — logo nenhum campo aqui pode ser exclusivo.
 */
export interface RaceModifier {
  /** Stat derivado afectado (ver `DerivedStats`). */
  readonly stat: DerivedStatKey;
  /** `flat` soma antes de percentagens; `percent` multiplica no fim. */
  readonly kind: 'flat' | 'percent';
  /** Valor do modificador (ex.: 5 = +5% em `percent`). */
  readonly value: number;
}

/**
 * Definição de raça — conteúdo estático servido pelo catálogo
 * (src/data/races.ts), nunca pelo cliente no momento da criação.
 */
export interface Race {
  readonly id: ContentId;
  readonly name: string;
  readonly slug: string;
  readonly lore: string;
  /** Bónus raciais (ex.: anão +VIT, elfo +FLEE, humano +EXP). */
  readonly modifiers: readonly RaceModifier[];
  /** Bónus de atributo primário fixo aplicado na criação. */
  readonly attributeBonus: Partial<AttributeBlock>;
  /**
   * Âncoras do Paperdoll para esta raça. Todas as raças partilham a MESMA
   * grelha de coordenadas; só o `bodyLayer` muda (requisito do projeto).
   */
  readonly paperdoll: RacePaperdoll;
  /** Paleta base para previews de mercado e molduras de raridade. */
  readonly palette: RacePalette;
  readonly unlock: RaceUnlock;
}

/** Chaves de camada do Paperdoll, na ordem de renderização (fundo → frente). */
export type PaperdollLayerKey =
  | 'aura'
  | 'wings'
  | 'body'
  | 'armor'
  | 'helmet'
  | 'weapon'
  | 'vfx';

/** Ordem rígida de composição. Alterar aqui muda TODOS os avatares. */
export const PAPERDOLL_LAYER_ORDER: readonly PaperdollLayerKey[] = [
  'aura',
  'wings',
  'body',
  'armor',
  'helmet',
  'weapon',
  'vfx',
] as const;

/** Configuração de um slot de equipamento no Paperdoll. */
export interface PaperdollAnchor {
  /** Posição do canto superior-esquerdo da camada, em px da arte-base. */
  readonly x: number;
  readonly y: number;
  /** Escala aplicada à camada (1 = tamanho nominal da arte). */
  readonly scale: number;
  /** Deslocamento em z-index relativo dentro da sua camada (ex.: capa atrás). */
  readonly zOffset: number;
  /** Se `true`, a camada é espelhada horizontalmente. */
  readonly flipX: boolean;
}

/**
 * Especificação do Paperdoll por raça.
 * `canvas` é a caixa lógica comum a TODAS as raças — garante alinhamento.
 */
export interface RacePaperdoll {
  readonly bodyLayer: AssetRef;
  /** Resolução lógica da arte-base (ex.: 256×256) — igual em todas as raças. */
  readonly canvas: PaperdollCanvas;
  /** Âncora por slot de equipamento. Slots ausentes não são renderizados. */
  readonly anchors: Readonly<Record<PaperdollLayerKey, PaperdollAnchor>>;
  /** Estado de animação disponível (idle sempre presente). */
  readonly animations: readonly PaperdollAnimation[];
}

export interface PaperdollCanvas {
  readonly width: number;
  readonly height: number;
  /** Escala de exibição em CSS px (ex.: 1 para 256px, 2 para miniaturas). */
  readonly displayScale: number;
}

export type PaperdollAnimation = 'idle' | 'attack' | 'hit' | 'cast' | 'death';

/** Referência a um asset estático em /public. Nunca URLs absolutas externas. */
export interface AssetRef {
  /** Caminho público, ex.: `/assets/paperdoll/races/human.png`. */
  readonly src: string;
  /** Índice de sprite-sheet quando aplicável (null = imagem única). */
  readonly sheet: SpriteSheetMeta | null;
}

export interface SpriteSheetMeta {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly columns: number;
  readonly rows: number;
  readonly fps: number;
}

export interface RacePalette {
  readonly skin: string;
  readonly hair: string;
  readonly primary: string;
  readonly accent: string;
}

export type RaceUnlock = 'default' | 'achievement' | 'market' | 'premium';

/* ==========================================================================
 * 3. CLASSES, ESPECIALIZAÇÕES E POSIÇÕES
 * ========================================================================== */

/** As quatro classes-base escolhidas no nível 10. */
export type BaseClass = 'warrior' | 'hunter' | 'cleric' | 'mage';

/** As oito especializações escolhidas no nível 40 (duas por classe). */
export type Specialization =
  | 'paladin'
  | 'berserker'
  | 'sharpshooter'
  | 'assassin'
  | 'divine_priest'
  | 'inquisitor'
  | 'archmage'
  | 'warlock';

/** Papel de squad — define prioridade de targeting e composição. */
export type SquadRole = 'tank' | 'healer' | 'dps';

/** Posição na formação; afecta targeting e multiplicadores. */
export type FormationPosition = 'front' | 'mid' | 'back';

/**
 * Mapeamento canónico classe → papel.
 * A wiki fixa squad de 4 = 1 tanque + 1 healer + 2 DPS.
 */
export const CLASS_ROLE: Readonly<Record<BaseClass, SquadRole>> = {
  warrior: 'tank',
  hunter: 'dps',
  cleric: 'healer',
  mage: 'dps',
} as const;

/** Especialização → classe-base, usado para validar escolhas no servidor. */
export const SPEC_BASE_CLASS: Readonly<Record<Specialization, BaseClass>> = {
  paladin: 'warrior',
  berserker: 'warrior',
  sharpshooter: 'hunter',
  assassin: 'hunter',
  divine_priest: 'cleric',
  inquisitor: 'cleric',
  archmage: 'mage',
  warlock: 'mage',
} as const;

/** Atributo principal por classe (base das fórmulas de ATK/MATK). */
export const CLASS_MAIN_ATTRIBUTE: Readonly<Record<BaseClass, PrimaryAttribute>> = {
  warrior: 'str',
  hunter: 'dex',
  cleric: 'int',
  mage: 'int',
} as const;

/* ==========================================================================
 * 4. STATS DERIVADOS
 * ========================================================================== */

/** Todos os stats derivados calculáveis a partir dos primários + equipamento. */
export type DerivedStatKey =
  | 'maxHp'
  | 'maxMp'
  | 'atk'
  | 'matk'
  | 'def'
  | 'mdef'
  | 'hit'
  | 'flee'
  | 'crit'
  | 'critDamage'
  | 'attackSpeed'
  | 'castTime'
  | 'healPower'
  | 'lifesteal'
  | 'expBonus'
  | 'dropBonus'
  /** Regeneração de HP por segundo, em % do MaxHP (Pandaren, Troll). */
  | 'regenPct'
  /** Resistência a controlo (stun/silence), em % (Pandaren). */
  | 'controlResist'
  /** ATK extra quando o HP está abaixo de 30%, em % (Orc). */
  | 'lowHpAtk'
  /** Duração de buffs positivos, em % (Troll). */
  | 'buffDuration';

/** Bloco de stats derivados. Todas as chaves presentes após normalização. */
export type DerivedStats = Readonly<Record<DerivedStatKey, number>>;

/**
 * Contribuição de um item/skill para os stats derivados.
 * `flat` soma; `percent` acumula e aplica no final (ordem documentada).
 */
export interface StatModifier {
  readonly stat: DerivedStatKey;
  readonly kind: 'flat' | 'percent';
  readonly value: number;
  /** Fonte do modificador — para auditoria e UI de comparação lado a lado. */
  readonly source: StatModifierSource;
}

export type StatModifierSource =
  | { readonly type: 'item'; readonly itemId: Uuid }
  | { readonly type: 'card'; readonly cardId: ContentId }
  | { readonly type: 'skill'; readonly skillId: ContentId }
  | { readonly type: 'race'; readonly raceId: ContentId }
  | { readonly type: 'buff'; readonly buffId: Uuid }
  | { readonly type: 'talent'; readonly talentId: ContentId }
  | { readonly type: 'prestige'; readonly level: number };

/* ==========================================================================
 * 5. ELEMENTOS, TAMANHOS E RAÇAS DE MONSTRO (multiplicadores de dano)
 * ========================================================================== */

export type Element = 'neutral' | 'water' | 'earth' | 'fire' | 'wind' | 'holy' | 'dark' | 'poison';

export type MonsterSize = 'small' | 'medium' | 'large';

export type MonsterRace =
  | 'beast'
  | 'undead'
  | 'demon'
  | 'dragon'
  | 'humanoid'
  | 'elemental'
  | 'plant';

export type MonsterTier = 'normal' | 'elite' | 'boss';

/**
 * Multiplicadores acumuláveis de dano. Todos se multiplicam entre si
 * (regra da wiki: tamanho × raça × elemento × chefe).
 */
export interface DamageModifiers {
  readonly bySize: Readonly<Partial<Record<MonsterSize, number>>>;
  readonly byRace: Readonly<Partial<Record<MonsterRace, number>>>;
  readonly byElement: Readonly<Partial<Record<Element, number>>>;
  readonly byTier: Readonly<Partial<Record<MonsterTier, number>>>;
}

/* ==========================================================================
 * 6. SKILLS
 * ========================================================================== */

/** Tipo de skill no catálogo (120 linhas na wiki). */
export type SkillKind = 'active' | 'passive' | 'supreme';

/** Função mecânica — dirige o executor de efeitos. */
export type SkillFunction =
  | 'damage'
  | 'aoe_damage'
  | 'dot'
  | 'heal'
  | 'hot'
  | 'shield'
  | 'buff'
  | 'debuff'
  | 'control'
  | 'summon'
  | 'utility'
  | 'revive';

/** Base do valor escalado por raridade (coluna "Base do valor" da wiki). */
export type SkillScalingBase =
  | 'atk'
  | 'matk'
  | 'def'
  | 'mdef'
  | 'max_hp'
  | 'target_max_hp'
  | 'caster_matk_pct';

/**
 * Valor por raridade (Comum → Mítica). Índice = RARITY_ORDER.
 * `[420, 470, 520, 580, 650, 750]` no caso de "Explosão do Piromante".
 */
export type RarityValueTable = Readonly<Record<Rarity, number>>;

/** Efeito concreto executado pelo motor de combate. */
export interface SkillEffect {
  readonly function: SkillFunction;
  readonly scaling: SkillScalingBase;
  /** Multiplicador aplicado ao valor base (1 = 100%). */
  readonly coefficient: number;
  /** Duração em segundos (DoT/HoT/buff/debuff). `null` = instantâneo. */
  readonly durationSec: number | null;
  /** Intervalo de tick em segundos (DoT/HoT). `null` = sem ticks. */
  readonly tickIntervalSec: number | null;
  /** Alvos máximos (`'all'` = área total). */
  readonly targetCount: number | 'all';
  /** Se `true`, o alvo é um aliado; senão, é um inimigo. */
  readonly targetsAlly: boolean;
  /** Elemento aplicado pelo efeito. */
  readonly element: Element;
  /** Modificadores de stat aplicados enquanto o efeito está activo. */
  readonly modifiers: readonly StatModifier[];
  /** Teto de dano em % do MaxHP do alvo (chefes: 40% — regra da wiki). */
  readonly maxHpDamageCapPct: number | null;
}

/** Definição de skill do catálogo estático (src/data/skills.ts). */
export interface Skill {
  readonly id: ContentId;
  readonly name: string;
  readonly description: string;
  readonly specialization: Specialization;
  readonly kind: SkillKind;
  readonly function: SkillFunction;
  readonly scaling: SkillScalingBase;
  /** Valor por raridade — rascunho de balanceamento. @tuning */
  readonly rarityValues: RarityValueTable;
  /** Texto do bónus de Lendária/Mítica (ex.: "-1s de cooldown"). */
  readonly mythicBonus: string;
  /** Efeitos mecânicos (permite multi-projécteis, saltos, etc.). */
  readonly effects: readonly SkillEffect[];
  readonly cooldownSec: number;
  readonly mpCost: number;
  readonly castTimeSec: number;
  /** Nível máximo por duplicatas (1–50 no Templo). */
  readonly maxLevel: number;
  /** Incremento de potência por nível acima de 1 (fração, ex.: 0.02 = +2%). */
  readonly perLevelGain: number;
  readonly icon: string;
  readonly rarity: Rarity;
}

/**
 * Instância de skill possuída pelo jogador (progressão por duplicatas).
 * Separado de `Skill` porque `level`/`duplicates` são estado do jogador.
 */
export interface OwnedSkill {
  readonly skillId: ContentId;
  readonly level: number;
  readonly duplicates: number;
  readonly unlockedAt: IsoTimestamp;
  /** Equipada num dos espaços de skill activa (1–8). */
  readonly equippedSlot: SkillSlotIndex | null;
}

/** Skill pronta a combater: definicao + nivel possuido pelo jogador. */
export interface EquippedSkill {
  readonly skillId: ContentId;
  readonly level: number;
}

/** Espaços de skill activa: 2 (nv 1–9), 3 (nv 20), 4 (nv 40), 5–8 (marcos). */
export type SkillSlotIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Estado do Templo (sorteio com pity). */
export interface GachaState {
  /** Pergaminhos desde a última Lendária/Mítica (pity 80). */
  readonly legendaryPityCounter: number;
  /** Pergaminhos desde a última Mítica (pity 300). */
  readonly mythicPityCounter: number;
  /** Total de pergaminhos abertos (telemetria/auditoria). */
  readonly totalRolls: number;
}

/* ==========================================================================
 * 7. ITENS, EQUIPAMENTO E CARDS
 * ========================================================================== */

/** Slots fixos de equipamento. Ordem = ordem de renderização do Paperdoll. */
export type EquipmentSlot =
  | 'helmet'
  | 'armor'
  | 'weapon'
  | 'offhand'
  | 'cloak'
  | 'boots'
  | 'accessory'
  | 'aura'
  | 'wings';

/** Slots que recebem cartas (0–4 sockets — peitoral e arma). */
export const CARD_SOCKET_SLOTS: readonly EquipmentSlot[] = ['armor', 'weapon'] as const;

export type ItemCategory = 'equipment' | 'consumable' | 'material' | 'card' | 'cosmetic' | 'pet';

export type WeaponType = 'sword' | 'axe' | 'dagger' | 'spear' | 'bow' | 'staff' | 'wand' | 'mace';

/** Regras de vínculo — decide se o item pode ir ao mercado. */
export type BindRule = 'unbound' | 'binds_on_equip' | 'binds_on_refine' | 'soulbound';

/** Atributo aleatório rolado no drop (até N por item). */
export interface RandomAffix {
  readonly stat: DerivedStatKey;
  readonly kind: 'flat' | 'percent';
  readonly value: number;
  /** Tier do roll (1 = baixo … 5 = perfeito) — para UI e preço. */
  readonly tier: number;
}

/** Carta inserida num socket. */
export interface SocketedCard {
  /** UUID da carta como item — preservado para auditoria e RMT. */
  readonly itemId: Uuid;
  readonly cardId: ContentId;
  readonly name: string;
  readonly effect: SkillEffect;
}

/**
 * Definição de item (catálogo estático — src/data/items.ts).
 * Instâncias vivem em `InventoryItem`.
 */
export interface Item {
  readonly id: ContentId;
  readonly name: string;
  readonly description: string;
  readonly category: ItemCategory;
  readonly slot: EquipmentSlot | null;
  readonly weaponType: WeaponType | null;
  readonly rarity: Rarity;
  readonly levelRequirement: number;
  /** Restrição de classe; `null` = universal. Raça nunca restringe. */
  readonly classRestriction: readonly BaseClass[] | null;
  /** Stats base (antes de refino, cartas e afixos). */
  readonly baseModifiers: readonly StatModifier[];
  /** Número máximo de sockets de carta (0–4). */
  readonly socketCount: number;
  /** Afixos aleatórios possíveis neste item. */
  readonly affixPool: readonly DerivedStatKey[];
  readonly bindRule: BindRule;
  /** Valor base de venda a NPC em Gold. */
  readonly npcSellValue: number;
  /** Peso no sorteio de drop (0 = não dropa). */
  readonly dropWeight: number;
  readonly icon: string;
  /** Peça do Paperdoll; `null` para consumíveis/cartas. */
  readonly paperdoll: PaperdollPiece | null;
  readonly tradable: boolean;
}

/** Peça visual de um item no Paperdoll. */
export interface PaperdollPiece {
  readonly layer: PaperdollLayerKey;
  readonly asset: AssetRef;
  /** Override de âncora; `null` = usa a âncora da raça. */
  readonly anchorOverride: PaperdollAnchor | null;
  /** Cor de glow por raridade (null = sem glow). */
  readonly glow: string | null;
}

/**
 * Instância de item na moeda/inventário do jogador.
 * O UUID preserva raridade e sockets (requisito explícito da wiki).
 */
export interface InventoryItem {
  readonly id: Uuid;
  readonly itemId: ContentId;
  readonly ownerId: Uuid;
  readonly rarity: Rarity;
  /** Refino +0 a +15. Falha consome pedra, não quebra o item. */
  readonly refineLevel: number;
  readonly affixes: readonly RandomAffix[];
  readonly sockets: readonly (SocketedCard | null)[];
  /** Slot onde está equipado; `null` = no inventário. */
  readonly equippedSlot: EquipmentSlot | null;
  /** Personagem do squad que usa o item. */
  readonly equippedBy: Uuid | null;
  readonly bound: boolean;
  /** Se `true`, o item está preso em anúncio/escrow e não pode ser movido. */
  readonly locked: boolean;
  readonly obtainedAt: IsoTimestamp;
  /** Andar onde caiu — histórico para o mercado e bestiário. */
  readonly droppedAtFloor: number | null;
}

/** Equipamento activo de um personagem: slot → instância. */
export type EquipmentLoadout = Readonly<Record<EquipmentSlot, InventoryItem | null>>;

/* ==========================================================================
 * 8. PERSONAGENS E SQUAD
 * ========================================================================== */

/** Buff/debuff activo em combate. */
export interface ActiveEffect {
  readonly id: Uuid;
  readonly skillId: ContentId;
  readonly sourceActorId: Uuid;
  readonly targetActorId: Uuid;
  readonly kind: SkillFunction;
  readonly element: Element;
  /** Dano/cura por tick (já calculado). */
  readonly tickValue: number;
  readonly tickIntervalSec: number;
  readonly expiresAtMs: EpochMs;
  /** Stacks para DoTs acumuláveis (veneno 2×). */
  readonly stacks: number;
  readonly modifiers: readonly StatModifier[];
  /** Próximo tick acumulado em segundos — o loop só o reinicia ao disparar. */
  readonly nextTickSec: number;
  /** Se true, o efeito não pode ser removido antes de expirar. */
  readonly undispellable: boolean;
}

/**
 * Personagem jogável — o "herói" que ocupa um lugar no squad.
 * NÃO confundir com `Player` (a conta/agregado).
 */
export interface Character {
  readonly id: Uuid;
  readonly ownerId: Uuid;
  readonly name: string;
  readonly raceId: ContentId;
  readonly baseClass: BaseClass;
  /** `null` até ao nível 40. */
  readonly specialization: Specialization | null;
  readonly level: number;
  readonly exp: number;
  /** Pontos de atributo ainda não distribuídos (5 por nível). */
  readonly unspentPoints: number;
  /** Atributos distribuídos pelo jogador (não inclui raça/equipamento). */
  readonly attributes: AttributeBlock;
  /** Pontos de talento disponíveis (3 por nível). */
  readonly talentPoints: number;
  readonly talents: readonly ContentId[];
  /**
   * Modo de distribuição de pontos. `auto` = o jogo segue o preset da classe
   * e deixa os talentos pendentes; `manual` = o jogador aloca os 5 pontos de
   * atributo E escolhe cada talento. Ver `lib/game/progression.ts`.
   */
  readonly allocationMode: AllocationMode;
  /** Skills possuídas — no máximo 8 equipadas. */
  readonly skills: readonly OwnedSkill[];
  readonly equipment: EquipmentLoadout;
  readonly position: FormationPosition;
  readonly role: SquadRole;
  /** Aparência cosmética (pode sobrepor-se ao equipamento). */
  readonly appearance: Appearance;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/**
 * Aparência renderizada. `null` em qualquer slot = nada desenhado nessa
 * camada. É daqui que o `PaperdollAvatar` lê, nunca do item directamente —
 * permite cosméticos que substituem equipamento.
 */
export interface Appearance {
  readonly raceId: ContentId;
  readonly bodyVariant: number;
  readonly skinTone: string;
  readonly hairStyle: ContentId;
  readonly hairColor: string;
  /** Overrides cosméticos por camada. */
  readonly cosmetic: Readonly<Record<PaperdollLayerKey, CosmeticRef | null>>;
  /** Glow de raridade do avatar inteiro (cosmético de mercado). */
  readonly auraColor: string | null;
}

export interface CosmeticRef {
  readonly itemId: Uuid;
  readonly layer: PaperdollLayerKey;
  readonly asset: AssetRef;
}

/**
 * Squad de quatro: 1 tanque, 1 healer, 2 DPS.
 * `members` tem exactamente 4 posições; `null` = vaga livre.
 */
export interface Squad {
  readonly id: Uuid;
  readonly ownerId: Uuid;
  readonly name: string;
  readonly members: readonly [Character, Character, Character, Character];
  /** Formação activa; a UI da Arena espelha-a em Front/Mid/Back. */
  readonly formation: Formation;
  /** Bónus de composição equilibrada (ver wiki: "bônus de composição"). */
  readonly compositionBonus: CompositionBonus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/** Formação por posição — o índice é o lugar na grelha. */
export interface Formation {
  readonly front: readonly Uuid[];
  readonly mid: readonly Uuid[];
  readonly back: readonly Uuid[];
}

export interface CompositionBonus {
  /** `true` quando o squad tem tanque + healer + 2 DPS. */
  readonly balanced: boolean;
  readonly modifiers: readonly StatModifier[];
}

/* ==========================================================================
 * 9. JOGADOR E PROGRESSO
 * ========================================================================== */

/** Conta de jogador — agregado de tudo o que é persistente por utilizador. */
export interface Player {
  readonly id: Uuid;
  /** Auth user id do Supabase (`auth.users.id`). */
  readonly userId: Uuid;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly createdAt: IsoTimestamp;
  readonly lastSeenAt: IsoTimestamp;
  readonly wallet: Wallet;
  readonly tower: TowerProgress;
  readonly squadId: Uuid;
  readonly inventoryId: Uuid;
  readonly gacha: GachaState;
  readonly prestige: PrestigeState;
  readonly settings: PlayerSettings;
  /** Trilho de auditoria exigido para RMT. */
  readonly flags: PlayerFlags;
}

export interface Wallet {
  readonly gold: number;
  readonly crystals: number;
  /** Saldo RMT em centavos inteiros — nunca float. */
  readonly cashCents: number;
}

export interface TowerProgress {
  /** Andar em que o squad está a combater agora. */
  readonly currentFloor: number;
  /** Maior andar concluído — base do checkpoint. */
  readonly highestFloor: number;
  /** Checkpoint de renascimento após wipe. */
  readonly checkpointFloor: number;
  /** Wave dentro do andar (1–9 farm, 10 = boss). */
  readonly currentWave: number;
  readonly wavesPerFloor: number;
  /** `true` quando o andar actual é de chefão. */
  readonly isBossFloor: boolean;
  /** Melhor tempo por andar (telemetria/leaderboard futuro). */
  readonly bestFloorTimeSec: number | null;
}

export interface PrestigeState {
  /** Número de reinícios efectuados. */
  readonly level: number;
  /** Resets de atributos efectuados (telemetria de experimentação). */
  readonly respecCount: number;
  readonly lastRespecAt: IsoTimestamp | null;
  /** Bónus permanentes acumulados. */
  readonly modifiers: readonly StatModifier[];
  readonly lastPrestigeAt: IsoTimestamp | null;
}

export interface PlayerSettings {
  readonly soundVolume: number;
  readonly musicVolume: number;
  readonly batterySaver: boolean;
  readonly reducedMotion: boolean;
  readonly damageNumbers: boolean;
  readonly chatFilter: boolean;
}

export interface PlayerFlags {
  readonly banned: boolean;
  readonly tradeLocked: boolean;
  /** Contas novas podem ter restrição de RMT durante N dias. */
  readonly rmtEnabledAt: IsoTimestamp | null;
}

/* ==========================================================================
 * 9b. DISTRIBUIÇÃO DE PONTOS (sistema híbrido aprovado)
 * ========================================================================== */

/**
 * `auto`: o jogo aplica o preset da classe aos 5 pontos de atributo por nível
 *         e ACUMULA os 3 pontos de talento para o jogador decidir depois.
 * `manual`: o jogador aloca os 5 pontos de atributo e escolhe cada talento.
 */
export type AllocationMode = 'auto' | 'manual';

/** Pontos concedidos por nível. */
export interface LevelUpPoints {
  readonly attributePoints: number;
  readonly talentPoints: number;
}

/** Peso de cada atributo no preset automático de uma classe. */
export type AttributePreset = Readonly<Partial<Record<PrimaryAttribute, number>>>;

/**
 * Requisição de alocação de atributos enviada pelo cliente.
 * O servidor valida soma ≤ pontos disponíveis e ≥ 0.
 */
export interface AllocateAttributesRequest {
  readonly characterId: Uuid;
  readonly points: Readonly<Partial<AttributeBlock>>;
}

/**
 * Requisição de alocação de talentos. `talentId` → número de pontos
 * investidos (1 a `maxRank`). Enviada só em `allocationMode === 'manual'`.
 */
export interface AllocateTalentsRequest {
  readonly characterId: Uuid;
  readonly points: Readonly<Record<ContentId, number>>;
}

/** Custo do reset de atributos — barato, para incentivar experimentação. */
export interface RespecCost {
  readonly currency: Currency;
  readonly amount: number;
  /** Multiplicador por nível do personagem (custo cresce devagar). */
  readonly perLevelMultiplier: number;
}

/** Entrada da árvore de talentos. */
export interface TalentNode {
  readonly id: ContentId;
  readonly name: string;
  readonly description: string;
  readonly specialization: Specialization;
  /** Burst / Utility / Sustain — as três árvores da wiki. */
  readonly tree: TalentTree;
  readonly maxRank: number;
  /** Nível de personagem mínimo para investir. */
  readonly levelRequirement: number;
  /** Talentos pré-requisitos (deve ter rank ≥ 1). */
  readonly requires: readonly ContentId[];
  readonly modifiersPerRank: readonly StatModifier[];
}

export type TalentTree = 'burst' | 'utility' | 'sustain';

/** Progresso offline — limite de 8 horas (regra da wiki). @tuning */
export interface OfflineProgressReport {
  readonly from: IsoTimestamp;
  readonly to: IsoTimestamp;
  /** Segundos efectivamente creditados (após o cap). */
  readonly creditedSeconds: number;
  /** `true` quando o cap de 8h cortou o intervalo. */
  readonly capped: boolean;
  readonly expGained: number;
  readonly goldGained: number;
  readonly floorsAdvanced: number;
  readonly itemsDropped: readonly Uuid[];
}

/** Curva de XP: `base × 1.15 ^ nível`. @tuning */
export interface LevelingCurve {
  readonly baseExp: number;
  readonly growthFactor: number;
  readonly maxLevel: number;
}

/* ==========================================================================
 * 10. INIMIGOS E ANDARES DA TORRE
 * ========================================================================== */

/** Inimigo instanciado em combate. */
export interface Enemy {
  readonly id: Uuid;
  readonly monsterId: ContentId;
  readonly name: string;
  readonly level: number;
  readonly tier: MonsterTier;
  readonly size: MonsterSize;
  readonly race: MonsterRace;
  readonly element: Element;
  readonly stats: DerivedStats;
  readonly position: FormationPosition;
  readonly rewards: EnemyRewards;
  readonly paperdoll: PaperdollPiece | null;
}

export interface EnemyRewards {
  readonly exp: number;
  readonly gold: number;
  readonly dropTableId: ContentId;
  /** Garantia de carta rara em andares específicos. */
  readonly guaranteedCardId: ContentId | null;
}

/** Definição estática de monstro (bestiário). */
export interface Monster {
  readonly id: ContentId;
  readonly name: string;
  readonly description: string;
  readonly size: MonsterSize;
  readonly race: MonsterRace;
  readonly element: Element;
  readonly baseStats: DerivedStats;
  /** Escala exponencial por andar. @tuning */
  readonly scaling: MonsterScaling;
  readonly skills: readonly ContentId[];
  readonly sprite: AssetRef;
  readonly dropTableId: ContentId;
}

export interface MonsterScaling {
  readonly hpPerFloor: number;
  readonly atkPerFloor: number;
  readonly defPerFloor: number;
  /** Multiplicador extra para chefes (curva exponencial da wiki). */
  readonly bossMultiplier: number;
}

/** Definição de andar da torre. */
export interface FloorDefinition {
  readonly floor: number;
  readonly name: string;
  readonly biome: ContentId;
  readonly backgroundAsset: AssetRef;
  readonly wavesPerFloor: number;
  /** `true` nos andares múltiplos de `bossFloorInterval`. */
  readonly isBossFloor: boolean;
  readonly bossMonsterId: ContentId | null;
  readonly mobPool: readonly ContentId[];
  /** Bónus de recompensa do andar (multiplicador). */
  readonly rewardMultiplier: number;
}

/* ==========================================================================
 * 11. COMBATE
 * ========================================================================== */

/** Participante de combate — unifica heróis e inimigos para o motor. */
export type Combatant = PlayerCombatant | EnemyCombatant;

export interface CombatantBase {
  readonly id: Uuid;
  readonly name: string;
  readonly level: number;
  readonly team: 'squad' | 'enemy';
  readonly position: FormationPosition;
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
  /** Shield absorve dano antes do HP. */
  readonly shield: number;
  readonly stats: DerivedStats;
  readonly effects: readonly ActiveEffect[];
  /** Segundos até ao próximo auto-ataque (acumulador do loop). */
  readonly attackCooldownSec: number;
  /** Cooldowns por skill, em segundos restantes. */
  readonly skillCooldowns: Readonly<Record<ContentId, number>>;
  readonly isAlive: boolean;
}

export interface PlayerCombatant extends CombatantBase {
  readonly team: 'squad';
  readonly characterId: Uuid;
  readonly baseClass: BaseClass;
  readonly appearance: Appearance;
  /** Skills que o motor lança automaticamente por cooldown. */
  readonly skills: readonly EquippedSkill[];
}

export interface EnemyCombatant extends CombatantBase {
  readonly team: 'enemy';
  readonly monsterId: ContentId;
  readonly tier: MonsterTier;
  readonly element: Element;
  readonly paperdoll: PaperdollPiece | null;
  /** Chefes usam skills; mobs normais têm lista vazia. */
  readonly skills: readonly EquippedSkill[];
}

/** Fase do ciclo de combate. */
export type CombatPhase =
  | 'idle'
  | 'wave_intro'
  | 'fighting'
  | 'wave_clear'
  | 'boss_telegraph'
  | 'boss_fight'
  | 'victory'
  | 'wipe'
  | 'floor_clear';

/** Evento de combate — o loop empurra eventos; a UI consome-os. */
export type CombatEvent =
  | DamageEvent
  | HealEvent
  | ShieldEvent
  | SkillCastEvent
  | DeathEvent
  | WaveEvent
  | FloorEvent;

export interface CombatEventBase {
  readonly id: Uuid;
  readonly at: EpochMs;
}

export interface DamageEvent extends CombatEventBase {
  readonly type: 'damage';
  readonly sourceId: Uuid;
  readonly targetId: Uuid;
  readonly amount: number;
  readonly isCrit: boolean;
  readonly isMiss: boolean;
  readonly element: Element;
  readonly skillId: ContentId | null;
}

export interface HealEvent extends CombatEventBase {
  readonly type: 'heal';
  readonly sourceId: Uuid;
  readonly targetId: Uuid;
  readonly amount: number;
  readonly skillId: ContentId | null;
  readonly isCrit: boolean;
}

export interface SkillCastEvent extends CombatEventBase {
  readonly type: 'skill_cast';
  readonly sourceId: Uuid;
  readonly skillId: ContentId;
  readonly targetIds: readonly Uuid[];
  readonly castTimeSec: number;
}

export interface ShieldEvent extends CombatEventBase {
  readonly type: 'shield';
  readonly sourceId: Uuid;
  readonly targetId: Uuid;
  readonly amount: number;
  readonly skillId: ContentId | null;
}

export interface DeathEvent extends CombatEventBase {
  readonly type: 'death';
  readonly actorId: Uuid;
  readonly team: 'squad' | 'enemy';
}

export interface WaveEvent extends CombatEventBase {
  readonly type: 'wave';
  readonly phase: 'start' | 'clear';
  readonly floor: number;
  readonly wave: number;
  /** Recompensas da wave limpa (nulo no start). */
  readonly reward: WaveReward | null;
}

/** Recompensa calculada quando uma wave e limpa. */
export interface WaveReward {
  readonly gold: number;
  readonly exp: number;
  readonly items: readonly InventoryItem[];
  readonly firstClearDrop: boolean;
}

export interface FloorEvent extends CombatEventBase {
  readonly type: 'floor';
  readonly phase: 'enter' | 'clear' | 'boss_start' | 'boss_clear' | 'wipe';
  readonly floor: number;
}

/** Estado completo do combate — o que `useCombat` mantém e `useGameLoop` avança. */
/** Estado de controlo de um combatente (stun, silêncio, medo). */
export interface ControlState {
  readonly stunUntilMs: EpochMs;
  readonly silenceUntilMs: EpochMs;
  readonly rootUntilMs: EpochMs;
}

export interface CombatState {
  readonly phase: CombatPhase;
  readonly floor: number;
  readonly wave: number;
  readonly wavesPerFloor: number;
  readonly isBossFloor: boolean;
  /** Actores vivos, squad primeiro. */
  readonly combatants: readonly Combatant[];
  /** Fila de eventos desde o último render (drenada pela UI). */
  readonly events: readonly CombatEvent[];
  /** Tempo acumulado da batalha actual, em segundos. */
  readonly elapsedSec: number;
  /** Tempo do wave actual (para o timer do Damage Meter). */
  readonly waveElapsedSec: number;
  /** Telemetria agregada da luta — alimenta o Damage Meter da Arena. */
  readonly metrics: CombatMetrics;
  /** Seed do PRNG — determinismo para testes e replay anti-cheat. */
  readonly seed: number;
  readonly rngCursor: number;
  /** `true` quando o loop está a avançar (pause/resume). */
  readonly running: boolean;
  /** Controlo activo por combatente (stun/silence/root). */
  readonly control: Readonly<Record<Uuid, ControlState>>;
  /** Habilidades equipadas por combatente — o motor lanca-as sozinho. */
  readonly skills: Readonly<Record<Uuid, readonly EquippedSkill[]>>;
  /** Verdadeiro quando a wave actual ja tem inimigos instanciados. */
  readonly waveActive: boolean;
  /** Dano total absorvido por escudos nesta wave (telemetria). */
  readonly absorbed: number;
  /** Segundos até o próximo tick, útil para debug e throttling. */
  readonly tickIntervalSec: number;
}

/** Agregados por combatente — equivalente ao Damage Meter da referência. */
export interface CombatMetrics {
  readonly totalDamage: number;
  readonly totalHealing: number;
  readonly totalDamageTaken: number;
  readonly elapsedSec: number;
  readonly perActor: Readonly<Record<Uuid, ActorMetrics>>;
}

export interface ActorMetrics {
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly healingDone: number;
  readonly critCount: number;
  readonly hitCount: number;
  readonly missCount: number;
  readonly deaths: number;
  readonly dps: number;
  readonly dpsSharePct: number;
  readonly critRatePct: number;
}

/* ==========================================================================
 * 12. DROPS, INVENTÁRIO E MERCADO (RMT)
 * ========================================================================== */

/** Tabela de drop de um andar/monstro. */
export interface DropTable {
  readonly id: ContentId;
  readonly entries: readonly DropEntry[];
  /** Chance base de Gold por inimigo (fração). @tuning */
  readonly goldChance: number;
  readonly goldRange: readonly [number, number];
}

export interface DropEntry {
  readonly itemId: ContentId;
  /** Peso relativo no sorteio. */
  readonly weight: number;
  readonly minFloor: number;
  readonly maxFloor: number | null;
  /** Garante o item no primeiro clear do andar. */
  readonly firstClearOnly: boolean;
}

/** Inventário persistido por jogador. */
export interface Inventory {
  readonly id: Uuid;
  readonly ownerId: Uuid;
  readonly items: readonly InventoryItem[];
  readonly capacity: number;
}

/** Anúncio no mercado. */
export interface MarketListing {
  readonly id: Uuid;
  readonly sellerId: Uuid;
  /** UUID do item anunciado — nunca uma cópia. */
  readonly itemId: Uuid;
  /** Snapshot denormalizado para listagem rápida (ícone + glow). */
  readonly snapshot: MarketItemSnapshot;
  readonly price: MarketPrice;
  readonly status: MarketListingStatus;
  readonly createdAt: IsoTimestamp;
  readonly expiresAt: IsoTimestamp;
  readonly soldAt: IsoTimestamp | null;
  readonly buyerId: Uuid | null;
  /** Taxa aplicada (ex.: 8% — provisório). @tuning */
  readonly feePct: number;
}

export type MarketListingStatus = 'active' | 'sold' | 'cancelled' | 'expired' | 'disputed';

export interface MarketPrice {
  readonly amount: number;
  readonly currency: Currency;
}

export interface MarketItemSnapshot {
  readonly itemId: ContentId;
  readonly name: string;
  readonly rarity: Rarity;
  readonly refineLevel: number;
  readonly icon: string;
  readonly glow: string | null;
  readonly paperdoll: PaperdollPiece | null;
  readonly socketCount: number;
}

/** Filtros do leilão (slot, raridade, refino mínimo, carta, classe). */
export interface MarketFilters {
  readonly slot: EquipmentSlot | null;
  readonly rarityMin: Rarity | null;
  readonly refineMin: number | null;
  readonly cardId: ContentId | null;
  readonly baseClass: BaseClass | null;
  readonly currency: Currency | null;
  readonly query: string;
}

/** Transacção registada — trilho de auditoria obrigatório para RMT. */
export interface MarketTransaction {
  readonly id: Uuid;
  readonly listingId: Uuid;
  readonly sellerId: Uuid;
  readonly buyerId: Uuid;
  readonly itemId: Uuid;
  readonly gross: MarketPrice;
  readonly fee: MarketPrice;
  readonly net: MarketPrice;
  readonly status: 'pending' | 'settled' | 'refunded' | 'failed';
  readonly createdAt: IsoTimestamp;
  readonly settledAt: IsoTimestamp | null;
}

/* ==========================================================================
 * 13. PROJECÇÕES DERIVADAS (view models para a UI)
 * ========================================================================== */

/** Estado que o `PaperdollAvatar` recebe — nada mais, nada menos. */
export interface PaperdollState {
  readonly raceId: ContentId;
  readonly canvas: PaperdollCanvas;
  /** Camadas já resolvidas e ordenadas por PAPERDOLL_LAYER_ORDER. */
  readonly layers: readonly ResolvedLayer[];
  readonly animation: PaperdollAnimation;
  /** Cor de glow de raridade do conjunto (null = sem glow). */
  readonly glow: string | null;
}

export interface ResolvedLayer {
  readonly key: PaperdollLayerKey;
  readonly asset: AssetRef;
  readonly anchor: PaperdollAnchor;
  readonly opacity: number;
  readonly tint: string | null;
  /** Raridade da peça que originou a camada (null = corpo ou cosmético). */
  readonly rarity: Rarity | null;
  /** Índice em PAPERDOLL_LAYER_ORDER (ordenação primária). */
  readonly order: number;
  /** Deslocamento dentro da camada (capa/botas atrás da peça principal). */
  readonly zOffset: number;
  /** Slot de equipamento que originou a camada (null = corpo/cosmético). */
  readonly slot: EquipmentSlot | null;
}

/** Slot já resolvido — consumido pelo inventário e pelo preview de mercado. */
export interface ResolvedPaperdollSlot {
  readonly slot: EquipmentSlot;
  readonly itemId: ContentId;
  readonly name: string;
  readonly rarity: Rarity;
  readonly layer: PaperdollLayerKey;
  readonly glow: string | null;
  readonly tint: string | null;
  readonly refineLevel: number;
}

/** Cabeçalho de HUD do squad (Arena): nome, nível, CP, HP, MP. */
export interface SquadMemberHud {
  readonly characterId: Uuid;
  readonly name: string;
  readonly level: number;
  /** Combat Power calculado (ver lib/game/stats.ts). */
  readonly combatPower: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly position: FormationPosition;
  readonly role: SquadRole;
  readonly paperdoll: PaperdollState;
}

/** Snapshot completo enviado do servidor para hidratar o cliente. */
export interface GameSnapshot {
  readonly player: Player;
  readonly squad: Squad;
  readonly inventory: Inventory;
  readonly tower: TowerProgress;
  readonly offline: OfflineProgressReport | null;
  /** Versão do snapshot para invalidar cache do cliente. */
  readonly version: number;
  readonly serverTime: IsoTimestamp;
}

/* ==========================================================================
 * 14. RESULTADOS E ERROS (sem excepções no caminho crítico)
 * ========================================================================== */

export type Result<T, E = GameError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type GameErrorCode =
  | 'not_found'
  | 'insufficient_funds'
  | 'inventory_full'
  | 'invalid_state'
  | 'not_owner'
  | 'level_too_low'
  | 'wrong_class'
  | 'market_locked'
  | 'rate_limited'
  | 'server_error';

export interface GameError {
  readonly code: GameErrorCode;
  readonly message: string;
  /** Contexto para log — nunca dados sensíveis. */
  readonly meta: Readonly<Record<string, string | number | boolean>>;
}

/* ==========================================================================
 * 15. TABELAS DO SUPABASE (fronteira de persistência, snake_case)
 * ========================================================================== */

/**
 * Linhas do Postgres. Mantidas aqui para o cliente tipado
 * (`createClient<Database>()`) reutilizar sem duplicar schemas.
 */
export interface Tables {
  readonly players: PlayerRow;
  readonly characters: CharacterRow;
  readonly squads: SquadRow;
  readonly inventory_items: InventoryItemRow;
  readonly market_listings: MarketListingRow;
  readonly market_transactions: MarketTransactionRow;
  readonly gacha_state: GachaStateRow;
}

export interface PlayerRow {
  readonly id: Uuid;
  readonly user_id: Uuid;
  readonly display_name: string;
  readonly avatar_url: string | null;
  readonly gold: number;
  readonly crystals: number;
  readonly cash_cents: number;
  readonly tower_current_floor: number;
  readonly tower_highest_floor: number;
  readonly tower_checkpoint_floor: number;
  readonly prestige_level: number;
  readonly created_at: IsoTimestamp;
  readonly last_seen_at: IsoTimestamp;
}

export interface CharacterRow {
  readonly id: Uuid;
  readonly owner_id: Uuid;
  readonly squad_id: Uuid | null;
  readonly name: string;
  readonly race_id: ContentId;
  readonly base_class: BaseClass;
  readonly specialization: Specialization | null;
  readonly level: number;
  readonly exp: number;
  readonly attributes: AttributeBlock;
  readonly unspent_points: number;
  readonly talent_points: number;
  readonly allocation_mode: AllocationMode;
  readonly talents: readonly ContentId[];
  readonly appearance: Appearance;
  readonly position: FormationPosition;
  readonly role: SquadRole;
  readonly created_at: IsoTimestamp;
  readonly updated_at: IsoTimestamp;
}

export interface SquadRow {
  readonly id: Uuid;
  readonly owner_id: Uuid;
  readonly name: string;
  readonly member_ids: readonly [Uuid, Uuid, Uuid, Uuid];
  readonly formation: Formation;
  readonly created_at: IsoTimestamp;
  readonly updated_at: IsoTimestamp;
}

export interface InventoryItemRow {
  readonly id: Uuid;
  readonly owner_id: Uuid;
  readonly item_id: ContentId;
  readonly rarity: Rarity;
  readonly refine_level: number;
  readonly affixes: readonly RandomAffix[];
  readonly sockets: readonly (SocketedCard | null)[];
  readonly equipped_slot: EquipmentSlot | null;
  readonly equipped_by: Uuid | null;
  readonly bound: boolean;
  readonly locked: boolean;
  readonly dropped_at_floor: number | null;
  readonly obtained_at: IsoTimestamp;
}

export interface MarketListingRow {
  readonly id: Uuid;
  readonly seller_id: Uuid;
  readonly item_id: Uuid;
  readonly snapshot: MarketItemSnapshot;
  readonly price_amount: number;
  readonly price_currency: Currency;
  readonly status: MarketListingStatus;
  readonly fee_pct: number;
  readonly created_at: IsoTimestamp;
  readonly expires_at: IsoTimestamp;
  readonly sold_at: IsoTimestamp | null;
  readonly buyer_id: Uuid | null;
}

export interface MarketTransactionRow {
  readonly id: Uuid;
  readonly listing_id: Uuid;
  readonly seller_id: Uuid;
  readonly buyer_id: Uuid;
  readonly item_id: Uuid;
  readonly gross_amount: number;
  readonly gross_currency: Currency;
  readonly fee_amount: number;
  readonly net_amount: number;
  readonly status: MarketTransaction['status'];
  readonly created_at: IsoTimestamp;
  readonly settled_at: IsoTimestamp | null;
}

export interface GachaStateRow {
  readonly player_id: Uuid;
  readonly legendary_pity_counter: number;
  readonly mythic_pity_counter: number;
  readonly total_rolls: number;
}
