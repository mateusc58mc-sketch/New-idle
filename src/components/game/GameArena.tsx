'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ArenaView } from '@/components/combat/ArenaView';
import { MarketplaceModal } from '@/components/marketplace/MarketplaceModal';
import { BASE_CLASSES } from '@/data/classes';
import { RACE_BY_ID } from '@/data/races';
import { useCombat } from '@/hooks/useCombat';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';
import { equipmentFromRow } from '@/lib/game/loadout';
import { floorDefinition, isBossWave, wavesForFloor } from '@/lib/game/tower';
import type {
  BaseClass,
  Character,
  EquipmentLoadout,
  InventoryItem,
  Squad,
  SquadRole,
  Specialization,
  Uuid,
} from '@/types/game';

const LOCAL_PLAYER_ID = '00000000-0000-4000-8000-000000000001';
const STARTED_AT = '2026-01-01T00:00:00.000Z';

interface StarterHero {
  readonly id: string;
  readonly name: string;
  readonly raceId: string;
  readonly baseClass: BaseClass;
  readonly specialization: Specialization;
  readonly role: SquadRole;
  readonly position: Character['position'];
  readonly attributes: Character['attributes'];
  readonly skillIds: readonly [string, string];
}

const STARTER_HEROES: readonly StarterHero[] = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Paladino',
    raceId: 'race.human',
    baseClass: 'warrior',
    specialization: 'paladin',
    role: 'tank',
    position: 'front',
    attributes: { str: 24, agi: 12, vit: 32, int: 10, dex: 12, luk: 10 },
    skillIds: ['skill.paladin.holy_hammer', 'skill.paladin.divine_shield'],
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    name: 'Atirador',
    raceId: 'race.elf',
    baseClass: 'hunter',
    specialization: 'sharpshooter',
    role: 'dps',
    position: 'mid',
    attributes: { str: 12, agi: 28, vit: 18, int: 10, dex: 32, luk: 16 },
    skillIds: ['skill.sharpshooter.deadly_shot', 'skill.sharpshooter.triple_shot'],
  },
  {
    id: '00000000-0000-4000-8000-000000000013',
    name: 'Sacerdote',
    raceId: 'race.human',
    baseClass: 'cleric',
    specialization: 'divine_priest',
    role: 'healer',
    position: 'back',
    attributes: { str: 10, agi: 12, vit: 24, int: 30, dex: 20, luk: 12 },
    skillIds: ['skill.divine_priest.greater_heal', 'skill.divine_priest.group_heal'],
  },
  {
    id: '00000000-0000-4000-8000-000000000014',
    name: 'Arquimago',
    raceId: 'race.human',
    baseClass: 'mage',
    specialization: 'archmage',
    role: 'dps',
    position: 'back',
    attributes: { str: 10, agi: 12, vit: 18, int: 36, dex: 24, luk: 12 },
    skillIds: ['skill.archmage.arcane_blast', 'skill.archmage.meteor'],
  },
];

interface ProgressSnapshot {
  readonly gold: number;
  readonly currentFloor: number;
  readonly currentWave: number;
  readonly inventory: readonly InventoryItem[];
}

const EMPTY_SNAPSHOT: ProgressSnapshot = {
  gold: 0,
  currentFloor: 1,
  currentWave: 1,
  inventory: [],
};

export function GameArena() {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(EMPTY_SNAPSHOT);
  const [hydratedUserId, setHydratedUserId] = useState<string | null | undefined>(undefined);
  const sync = useSupabaseSync(snapshot);

  useEffect(() => {
    if (sync.loading || hydratedUserId === sync.userId) return;
    setSnapshot({
      gold: sync.progress.gold,
      currentFloor: sync.progress.currentFloor,
      currentWave: sync.progress.currentWave,
      inventory: [],
    });
    setHydratedUserId(sync.userId);
  }, [sync.loading, sync.userId, sync.progress.gold, sync.progress.currentFloor, sync.progress.currentWave, hydratedUserId]);

  const squad = useMemo(
    () => createStarterSquad(sync.userId ?? LOCAL_PLAYER_ID, sync.squadCharacters, sync.inventory),
    [sync.userId, sync.squadCharacters, sync.inventory],
  );
  const onProgressChange = useCallback((next: ProgressSnapshot): void => setSnapshot(next), []);
  const onMarketplacePurchase = useCallback(async (gold: number): Promise<void> => {
    setSnapshot((current) => ({ ...current, gold }));
    await sync.reload();
  }, [sync.reload]);

  if (sync.loading || hydratedUserId !== sync.userId) {
    return <p style={noticeStyle}>Carregando o progresso do jogador…</p>;
  }

  return (
    <GameCombatSession
      key={sync.userId ?? 'local-player'}
      squad={squad}
      initialGold={snapshot.gold}
      initialFloor={snapshot.currentFloor}
      initialWave={snapshot.currentWave}
      persistedInventory={sync.inventory}
      source={sync.source}
      saving={sync.saving}
      error={sync.error}
      onProgressChange={onProgressChange}
      onMarketplacePurchase={onMarketplacePurchase}
      userId={sync.userId}
    />
  );
}

interface GameCombatSessionProps {
  readonly squad: Squad;
  readonly initialGold: number;
  readonly initialFloor: number;
  readonly initialWave: number;
  readonly persistedInventory: ReturnType<typeof useSupabaseSync>['inventory'];
  readonly source: ReturnType<typeof useSupabaseSync>['source'];
  readonly saving: boolean;
  readonly error: string | null;
  readonly onProgressChange: (snapshot: ProgressSnapshot) => void;
  readonly onMarketplacePurchase: (gold: number) => Promise<void>;
  readonly userId: string | null;
}

function GameCombatSession({
  squad,
  initialGold,
  initialFloor,
  initialWave,
  persistedInventory,
  source,
  saving,
  error,
  onProgressChange,
  onMarketplacePurchase,
  userId,
}: GameCombatSessionProps) {
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const closeMarketplace = useCallback((): void => setMarketplaceOpen(false), []);
  const combat = useCombat({ squad, initialFloor, initialWave, checkpointFloor: initialFloor });
  const floor = floorDefinition(combat.tower.floor);
  const bossWave = isBossWave(combat.tower);

  /** Loadout por herói — o Paperdoll resolve raça + classe + itens equipados. */
  const equipmentByCharacterId = useMemo(() => {
    const map: Record<Uuid, EquipmentLoadout> = {};
    for (const member of squad.members) map[member.id] = member.equipment;
    return map;
  }, [squad]);

  useEffect(() => {
    onProgressChange({
      gold: initialGold + combat.rewards.gold,
      currentFloor: combat.tower.floor,
      currentWave: combat.tower.wave,
      inventory: combat.loot,
    });
  }, [initialGold, combat.rewards.gold, combat.tower.floor, combat.tower.wave, combat.loot, onProgressChange]);

  const inventoryCount = useMemo(() => {
    const ids = new Set<string>(persistedInventory.map((item) => item.id));
    for (const item of combat.loot) ids.add(item.id);
    return ids.size;
  }, [persistedInventory, combat.loot]);

  return (
    <section style={panelStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Aetheria · Arena</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Ouro {Math.max(0, initialGold + combat.rewards.gold).toLocaleString('pt-BR')} · Andar {combat.tower.floor} · Wave {combat.tower.wave}
            {' · '}Inventário {inventoryCount}
          </p>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right' }} aria-live="polite">
          {saving ? 'Salvando…' : source === 'remote' ? 'Supabase sincronizado' : 'Salvando neste dispositivo'}
          {error ? <p style={{ color: '#fca5a5', maxWidth: 290, margin: '5px 0 0' }}>{error}</p> : null}
        </div>
      </header>

      <div style={controlsStyle}>
        <button style={marketButtonStyle} onClick={() => setMarketplaceOpen(true)} type="button">
          Mercado
        </button>
        <button style={buttonStyle} type="button" onClick={combat.toggle}>
          {combat.running ? 'Pausar combate' : 'Retomar combate'}
        </button>
        <button style={buttonStyle} type="button" onClick={() => combat.setMode('advance')}>
          Avançar torre
        </button>
        <button style={buttonStyle} type="button" onClick={() => combat.setMode('farm')}>
          Modo farm
        </button>
        {bossWave ? (
          <button style={buttonStyle} type="button" onClick={combat.challengeBoss}>
            Desafiar chefe
          </button>
        ) : null}
      </div>

      <ArenaView
        state={combat.state}
        floorName={floor.name}
        biome={floor.biome}
        wave={combat.tower.wave}
        totalWaves={wavesForFloor(combat.tower.floor)}
        isBossFloor={combat.tower.isBossFloor}
        onDrainEvents={combat.drainEvents}
        equipmentByCharacterId={equipmentByCharacterId}
      />
      {marketplaceOpen ? (
        <MarketplaceModal
          gold={Math.max(0, initialGold + combat.rewards.gold)}
          inventory={persistedInventory}
          onClose={closeMarketplace}
          onPurchased={onMarketplacePurchase}
          userId={userId}
        />
      ) : null}
    </section>
  );
}

function createStarterSquad(
  ownerId: string,
  savedCharacters: ReturnType<typeof useSupabaseSync>['squadCharacters'],
  savedInventory: ReturnType<typeof useSupabaseSync>['inventory'] = [],
): Squad {
  const rows = [...savedCharacters].sort((left, right) => left.created_at.localeCompare(right.created_at));
  const buildCharacter = (starter: StarterHero, index: number): Character => {
    const saved = rows[index];
    const baseClass = isBaseClass(saved?.class_id) ? saved.class_id : starter.baseClass;
    const classTemplate = STARTER_HEROES.find((candidate) => candidate.baseClass === baseClass) ?? starter;
    const raceId = saved && RACE_BY_ID.has(saved.race_id) ? saved.race_id : classTemplate.raceId;
    const ownedSkills: Character['skills'] = classTemplate.skillIds.map((skillId, slot) => ({
      skillId,
      level: 1,
      duplicates: 0,
      unlockedAt: STARTED_AT,
      equippedSlot: (slot + 1) as 1 | 2,
    }));

    return {
      id: saved?.id ?? starter.id,
      ownerId,
      name: classTemplate.name,
      raceId,
      baseClass,
      specialization: classTemplate.specialization,
      level: saved?.level ?? 20,
      exp: saved?.exp ?? 0,
      unspentPoints: 0,
      attributes: classTemplate.attributes,
      talentPoints: 0,
      talents: [],
      allocationMode: 'auto' as const,
      skills: ownedSkills,
      equipment: equipmentFromRow(saved?.equipped_items, savedInventory, ownerId),
      position: classTemplate.position,
      role: classTemplate.role,
      appearance: {
        raceId,
        bodyVariant: 0,
        skinTone: '#e8c39e',
        hairStyle: 'short',
        hairColor: '#4a3728',
        cosmetic: { aura: null, wings: null, body: null, armor: null, helmet: null, weapon: null, vfx: null },
        auraColor: null,
      },
      createdAt: saved?.created_at ?? STARTED_AT,
      updatedAt: saved?.updated_at ?? STARTED_AT,
    } satisfies Character;
  };

  const [first, second, third, fourth] = STARTER_HEROES;
  if (!first || !second || !third || !fourth) throw new Error('O esquadrão inicial precisa de quatro heróis.');
  const members: [Character, Character, Character, Character] = [
    buildCharacter(first, 0),
    buildCharacter(second, 1),
    buildCharacter(third, 2),
    buildCharacter(fourth, 3),
  ];

  return {
    id: ownerId,
    ownerId,
    name: 'Esquadrão Aetheria',
    members,
    formation: {
      front: members.filter((member) => member.position === 'front').map((member) => member.id),
      mid: members.filter((member) => member.position === 'mid').map((member) => member.id),
      back: members.filter((member) => member.position === 'back').map((member) => member.id),
    },
    compositionBonus: { balanced: true, modifiers: [] },
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
  };
}

function isBaseClass(value: string | undefined): value is BaseClass {
  return value !== undefined && BASE_CLASSES.some((baseClass) => baseClass.id === value);
}

const panelStyle = {
  maxWidth: 1040,
  margin: '28px auto',
  padding: 20,
  border: '1px solid #334155',
  borderRadius: 16,
  background: 'rgba(15, 23, 42, 0.86)',
  color: '#e2e8f0',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 18,
  flexWrap: 'wrap' as const,
  marginBottom: 16,
};

const controlsStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12 };
const buttonStyle = { border: '1px solid #475569', borderRadius: 8, background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', cursor: 'pointer' };
const marketButtonStyle = { ...buttonStyle, borderColor: '#7c3aed', background: '#4c1d95', color: '#f3e8ff' };
const noticeStyle = { maxWidth: 1040, margin: '32px auto', color: '#cbd5e1', textAlign: 'center' as const };
