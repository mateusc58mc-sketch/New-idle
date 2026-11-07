/**
 * Parâmetros de balanceamento centralizados.
 *
 * REGRA: nenhum número mágico no motor de combate. Tudo o que a wiki marca
 * como "proposta" ou "rascunho" vive aqui e é consumido por `lib/game/*`.
 * Ajustar balanceamento = editar este ficheiro, nunca as fórmulas.
 *
 * Fonte: wiki do Notion — Sistemas, Atributos e Progressão · Combate e
 * Atributos · Classes, Skills e Templo · Progressão da Torre · XP e Leveling.
 */
import type { Element, MonsterSize, MonsterRace, MonsterTier } from '@/types/game';

export const BALANCE = {
  /* ---------------------------------------------------------------- combate */
  combat: {
    /** Intervalo fixo do acumulador do loop (segundos). 60 ticks/s. */
    tickIntervalSec: 1 / 60,
    /** Teto de passos por frame — evita espiral da morte após um tab inactivo. */
    maxCatchUpSteps: 240,
    /** Duração do telegraph do chefe antes da habilidade (segundos). */
    bossTelegraphSec: 2.5,
    /** Pausa entre waves (segundos). */
    waveGapSec: 1.2,
    /** Teto de dano AoE em % do MaxHP do alvo (regra da wiki: 40%). */
    aoeDamageCapPct: 0.4,
    /** Número máximo de efeitos activos por combatente (protecção de memória). */
    maxActiveEffects: 32,
    /** Limite de eventos retidos por tick (a UI drena a cada frame). */
    maxEventsPerTick: 64,
  },

  /* ------------------------------------------------------- stats derivados */
  stats: {
    /** ATK = arma × (1 + refino×5%) + STR + floor(STR/10)² + floor(DEX/5) + floor(LUK/5) */
    atk: {
      strFlat: 1,
      strQuadraticDivisor: 10,
      dexDivisor: 5,
      lukDivisor: 5,
      refineBonusPct: 0.05,
    },
    /** MATK = INT + floor(INT/7)² + MATK da arma × (1 + refino×5%) */
    matk: {
      intFlat: 1,
      intQuadraticDivisor: 7,
      refineBonusPct: 0.05,
      /** Variação por golpe (±10%) para manter os números vivos. */
      variancePct: 0.1,
    },
    /** HIT = nível + DEX + equipamento; FLEE = nível + AGI + equipamento */
    hit: { levelWeight: 1, dexWeight: 1 },
    flee: { levelWeight: 1, agiWeight: 1, maxPct: 0.95, /** penalização por aggro extra */ penaltyPerExtraAttacker: 0.1 },
    /** Chance de acerto = 80% + HIT - FLEE, limitada entre 5% e 100%. */
    hitChance: { basePct: 0.8, minPct: 0.05, maxPct: 1 },
    /** CRIT = 1 + LUK × 0.3 + bónus; ignora FLEE e DEF macia, causa 140%. */
    crit: { base: 1, lukMultiplier: 0.3, maxPct: 1, damageMultiplier: 1.4 },
    /** ASPD = base da classe × (1 + AGI×1% + DEX×0.2%), teto 2.5 ataques/s. */
    attackSpeed: {
      agiPct: 0.01,
      dexPct: 0.002,
      maxAttacksPerSec: 2.5,
    },
    /** MaxHP = HP base da classe por nível × (1 + VIT × 1%). */
    maxHp: { vitPct: 0.01 },
    /** Tempo de conjuração = base × (1 - DEX/150), mínimo 0. */
    castTime: { dexDivisor: 150 },
    /** Cura recebida +1% a cada 5 pontos de VIT. */
    healReceived: { vitDivisor: 5 },
    /** Resistência a atordoar/veneno: +1% por VIT. */
    resist: { vitPct: 0.01 },
    /** Sorte: +0.5% relativo de drop de cartas por ponto de LUK. */
    drop: { lukPct: 0.005 },
    /** DEF macia: redução = def / (def + k). Curva assimptótica, nunca 100%. */
    softDef: { k: 100 },
  },

  /* ------------------------------------------------------------ progressão */
  progression: {
    /** Pontos por nível (sistema híbrido aprovado). */
    attributePointsPerLevel: 5,
    talentPointsPerLevel: 3,
    /** Níveis de atributo: 1 até `firstLevelUp`. */
    startLevel: 1,
    maxLevel: 200,
    /** Curva de XP: base × 1.15 ^ nível. */
    expBase: 100,
    expGrowthFactor: 1.15,
    /** Reset de atributos — barato de propósito (experimentação no idle). */
    respec: {
      baseCost: 500,
      currency: 'gold' as const,
      perLevelMultiplier: 1.05,
    },
    /** Marcos de desbloqueio. */
    milestones: {
      firstClassChoice: 10,
      thirdSkillSlot: 20,
      specialization: 40,
      fourthSkillSlot: 40,
    },
  },

  /* ---------------------------------------------------------------- torre */
  tower: {
    wavesPerFloor: 9,
    /** Andar 10 = wave 10 = boss-portão. */
    bossWaveIndex: 10,
    /** Intervalo entre andares de chefão. @tuning */
    bossFloorInterval: 10,
    /** Escala de HP/ATK/DEF por andar. @tuning */
    enemyScaling: {
      hpPerFloor: 0.18,
      atkPerFloor: 0.12,
      defPerFloor: 0.08,
      /** Chefe: curva exponencial sobre o mob do andar. */
      bossMultiplier: 8,
      bossAtkMultiplier: 2.2,
    },
    /** Progresso offline: limite de 8 horas (regra da wiki). */
    offline: {
      maxHours: 8,
      /** Eficiência do farm offline vs. activo. @tuning */
      efficiency: 0.6,
      /** Andares que o farm offline pode avançar sem supervisão. */
      maxFloorsOffline: 3,
    },
  },

  /* -------------------------------------------------------------- economia */
  economy: {
    /** Taxa do mercado. 8% é exemplo da wiki, não valor final. */
    marketFeePct: 0.08,
    /** Duração padrão de um anúncio (horas). */
    listingDurationHours: 72,
    /** Limite de anúncios activos por jogador. */
    maxActiveListings: 20,
    /** Primeira-clear Mítica só fica negociável após 24h. */
    mythicTradeDelayHours: 24,
    /** Refino: +1 a +15, falha consome pedra e não quebra o item. */
    refine: {
      maxLevel: 15,
      /** Bónus de stat por nível de refino. */
      bonusPerLevelPct: 0.05,
      /** Chance de sucesso por nível (índice 1..15). */
      successChanceByLevel: [
        1, 1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3,
      ] as const,
    },
    /** Sorteio do Templo: pity. */
    gacha: {
      legendaryPity: 80,
      mythicPity: 300,
      packSize: 10,
      /** 10º pergaminho do pacote garante Rara ou melhor. */
      guaranteedRareOnLast: true,
    },
  },

  /* ----------------------------------------------------- multiplicadores */
  /** Tabela de afinidade: atacante → defensor → multiplicador. */
  elementAffinity: {
    fire: { earth: 1.5, water: 0.5, wind: 1.25, plant: 1.5 },
    water: { fire: 1.5, earth: 1.25, wind: 0.5 },
    earth: { wind: 1.5, fire: 0.5, water: 1.25 },
    wind: { water: 1.5, earth: 0.5, fire: 1.25 },
    holy: { dark: 1.5, undead: 1.5 },
    dark: { holy: 1.5 },
    poison: { plant: 1.5, humanoid: 1.25 },
    neutral: {},
  } satisfies Partial<Record<Element, Partial<Record<Element | MonsterRace, number>>>>,

  /** % de dano por tipo de arma vs. tamanho do monstro (adaga/lança, etc.). */
  weaponSizeModifier: {
    dagger: { small: 1, medium: 0.75, large: 0.5 },
    sword: { small: 0.75, medium: 1, large: 0.75 },
    spear: { small: 0.75, medium: 0.75, large: 1 },
    bow: { small: 1, medium: 1, large: 0.75 },
    staff: { small: 0.5, medium: 0.75, large: 1 },
  } satisfies Partial<Record<string, Record<MonsterSize, number>>>,

  /** Multiplicadores por tier de inimigo. */
  tierModifier: {
    normal: 1,
    elite: 1.15,
    boss: 1.25,
  } satisfies Record<MonsterTier, number>,
} as const;

export type Balance = typeof BALANCE;
