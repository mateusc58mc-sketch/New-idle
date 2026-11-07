'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import type { InventoryItem } from '@/types/game';
import { getSupabaseBrowserClient, type Database, type Json } from '@/lib/supabase/client';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SquadCharacterRow = Database['public']['Tables']['squad_characters']['Row'];
type InventoryRow = Database['public']['Tables']['inventory']['Row'];

export interface PlayerProgressSnapshot {
  readonly gold: number;
  readonly currentFloor: number;
  readonly currentWave: number;
  readonly inventory: readonly InventoryItem[];
}

export interface UseSupabaseSyncOptions extends PlayerProgressSnapshot {
  /** Debounce do auto-save em milissegundos. */
  readonly debounceMs?: number;
}

export interface SupabasePlayerState {
  readonly profile: ProfileRow | null;
  readonly squadCharacters: readonly SquadCharacterRow[];
  readonly inventory: readonly InventoryRow[];
}

export interface SyncedProgress {
  readonly gold: number;
  readonly currentFloor: number;
  readonly currentWave: number;
}

export interface UseSupabaseSyncResult extends SupabasePlayerState {
  readonly userId: string | null;
  readonly progress: SyncedProgress;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly source: 'remote' | 'local' | 'empty';
  readonly error: string | null;
  reload(): Promise<void>;
}

interface ProgressRow {
  readonly gold: number;
  readonly current_floor: number;
  readonly current_wave: number;
}

interface LocalPlayerState {
  readonly profile: ProfileRow | null;
  readonly squadCharacters: readonly SquadCharacterRow[];
  readonly inventory: readonly InventoryRow[];
  readonly progress: ProgressRow;
}

const ANONYMOUS_STORAGE_KEY = 'aetheria.player.v1';
const STORAGE_KEY_PREFIX = 'aetheria.player.v1:';
const DEFAULT_DEBOUNCE_MS = 1_000;

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

const profileRowSchema: z.ZodType<ProfileRow> = z.object({
  id: z.string().uuid(),
  username: z.string(),
  gold: z.number().finite(),
  current_floor: z.number().int(),
  current_wave: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

const squadCharacterRowSchema: z.ZodType<SquadCharacterRow> = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  race_id: z.string(),
  class_id: z.string(),
  level: z.number().int(),
  exp: z.number().finite(),
  equipped_items: jsonSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

const inventoryRowSchema: z.ZodType<InventoryRow> = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  item_id: z.string(),
  rarity: z.string(),
  enhancement_level: z.number().int(),
  attributes: jsonSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

const localPlayerStateSchema: z.ZodType<LocalPlayerState> = z.object({
  profile: profileRowSchema.nullable(),
  squadCharacters: z.array(squadCharacterRowSchema),
  inventory: z.array(inventoryRowSchema),
  progress: z.object({
    gold: z.number().finite(),
    current_floor: z.number().int().positive(),
    current_wave: z.number().int().positive(),
  }),
});

const EMPTY_PLAYER_STATE: SupabasePlayerState = {
  profile: null,
  squadCharacters: [],
  inventory: [],
};

const EMPTY_PROGRESS: SyncedProgress = { gold: 0, currentFloor: 1, currentWave: 1 };

function storageKey(userId: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}${userId}` : ANONYMOUS_STORAGE_KEY;
}

function readLocalPlayerState(userId: string | null): LocalPlayerState | null {
  try {
    const serialized = window.localStorage.getItem(storageKey(userId));
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    const parsed = localPlayerStateSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeLocalPlayerState(userId: string | null, value: LocalPlayerState): boolean {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(value));
    return true;
  } catch {
    // A quota or browser privacy error must not break the combat loop.
    return false;
  }
}

function toJson(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((entry: unknown) => toJson(entry));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const result: { [key: string]: Json | undefined } = {};
    for (const [key, entry] of Object.entries(record)) {
      if (entry !== undefined) result[key] = toJson(entry);
    }
    return result;
  }
  return null;
}

function toInventoryRow(item: InventoryItem, profileId: string): InventoryRow {
  const timestamp = item.obtainedAt || new Date().toISOString();
  return {
    id: item.id,
    profile_id: profileId,
    item_id: item.itemId,
    rarity: item.rarity,
    enhancement_level: item.refineLevel,
    attributes: toJson({
      affixes: item.affixes,
      sockets: item.sockets,
      equipped_slot: item.equippedSlot,
      equipped_by: item.equippedBy,
      bound: item.bound,
      locked: item.locked,
      obtained_at: item.obtainedAt,
      dropped_at_floor: item.droppedAtFloor,
    }),
    created_at: timestamp,
    updated_at: new Date().toISOString(),
  };
}

function rowsForInventory(items: readonly InventoryItem[], userId: string | null): InventoryRow[] {
  return items
    .filter((item: InventoryItem) => !userId || item.ownerId === userId)
    .map((item: InventoryItem) => toInventoryRow(item, userId ?? item.ownerId));
}

function mergeInventory(
  existing: readonly InventoryRow[],
  incoming: readonly InventoryRow[],
): InventoryRow[] {
  const byId = new Map<string, InventoryRow>(existing.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()];
}

function toProgressRow(snapshot: PlayerProgressSnapshot): ProgressRow {
  return {
    gold: Math.max(0, Math.floor(snapshot.gold)),
    current_floor: Math.max(1, Math.floor(snapshot.currentFloor)),
    current_wave: Math.max(1, Math.floor(snapshot.currentWave)),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha ao sincronizar o progresso.';
}

export function useSupabaseSync(options: UseSupabaseSyncOptions): UseSupabaseSyncResult {
  const {
    gold,
    currentFloor,
    currentWave,
    inventory,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;
  const client = getSupabaseBrowserClient();
  const [playerState, setPlayerState] = useState<SupabasePlayerState>(EMPTY_PLAYER_STATE);
  const [progress, setProgress] = useState<SyncedProgress>(EMPTY_PROGRESS);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<UseSupabaseSyncResult['source']>('empty');
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const playerStateRef = useRef(playerState);
  const skipInitialSave = useRef(true);
  playerStateRef.current = playerState;

  const loadForUser = useCallback(
    async (nextUserId: string | null): Promise<void> => {
      const sequence = ++loadSequence.current;
      skipInitialSave.current = true;
      setUserId(nextUserId);
      setLoading(true);
      setError(null);

      if (!client || !nextUserId) {
        const local = readLocalPlayerState(nextUserId);
        if (sequence !== loadSequence.current) return;
        setPlayerState(local ?? EMPTY_PLAYER_STATE);
        setProgress(local
          ? {
              gold: local.progress.gold,
              currentFloor: local.progress.current_floor,
              currentWave: local.progress.current_wave,
            }
          : EMPTY_PROGRESS);
        setSource(local ? 'local' : 'empty');
        setLoading(false);
        return;
      }

      try {
        const [profileResult, squadResult, inventoryResult] = await Promise.all([
          client.from('profiles').select('*').eq('id', nextUserId).maybeSingle(),
          client.from('squad_characters').select('*').eq('profile_id', nextUserId),
          client.from('inventory').select('*').eq('profile_id', nextUserId),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (squadResult.error) throw squadResult.error;
        if (inventoryResult.error) throw inventoryResult.error;
        if (sequence !== loadSequence.current) return;

        const nextState: SupabasePlayerState = {
          profile: profileResult.data,
          squadCharacters: squadResult.data,
          inventory: inventoryResult.data,
        };
        setPlayerState(nextState);
        setProgress({
          gold: profileResult.data?.gold ?? 0,
          currentFloor: profileResult.data?.current_floor ?? 1,
          currentWave: profileResult.data?.current_wave ?? 1,
        });
        setSource('remote');

        const progress = profileResult.data
          ? {
              gold: profileResult.data.gold,
              current_floor: profileResult.data.current_floor,
              current_wave: profileResult.data.current_wave,
            }
          : { gold: 0, current_floor: 1, current_wave: 1 };
        writeLocalPlayerState(nextUserId, { ...nextState, progress });
      } catch (loadError: unknown) {
        if (sequence !== loadSequence.current) return;
        const local = readLocalPlayerState(nextUserId);
        setPlayerState(local ?? EMPTY_PLAYER_STATE);
        setProgress(local
          ? {
              gold: local.progress.gold,
              currentFloor: local.progress.current_floor,
              currentWave: local.progress.current_wave,
            }
          : EMPTY_PROGRESS);
        setSource(local ? 'local' : 'empty');
        setError(errorMessage(loadError));
      } finally {
        if (sequence === loadSequence.current) setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    if (!client) {
      void loadForUser(null);
      return;
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void loadForUser(session?.user.id ?? null);
      }
    });

    void client.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        void loadForUser(null);
        return;
      }
      void loadForUser(sessionData.session?.user.id ?? null);
    });

    return () => {
      loadSequence.current += 1;
      data.subscription.unsubscribe();
    };
  }, [client, loadForUser]);

  useEffect(() => {
    if (loading) return;
    if (skipInitialSave.current) {
      // Let the consumer hydrate combat state from the loaded profile first.
      skipInitialSave.current = false;
      return;
    }

    const snapshot: PlayerProgressSnapshot = { gold, currentFloor, currentWave, inventory };
    const progress = toProgressRow(snapshot);
    setProgress({
      gold: progress.gold,
      currentFloor: progress.current_floor,
      currentWave: progress.current_wave,
    });
    const incomingRows = mergeInventory(
      playerStateRef.current.inventory,
      rowsForInventory(inventory, userId),
    );
    const timestamp = new Date().toISOString();
    const nextProfile: ProfileRow | null = userId
      ? {
          id: userId,
          username: playerStateRef.current.profile?.username ?? `Player_${userId.slice(0, 8)}`,
          ...progress,
          created_at: playerStateRef.current.profile?.created_at ?? timestamp,
          updated_at: timestamp,
        }
      : null;

    const stored = readLocalPlayerState(userId);
    const localSaved = writeLocalPlayerState(userId, {
      profile: nextProfile ?? stored?.profile ?? playerStateRef.current.profile,
      squadCharacters: playerStateRef.current.squadCharacters,
      inventory: mergeInventory(stored?.inventory ?? playerStateRef.current.inventory, incomingRows),
      progress,
    });

    if (!client || !userId) {
      setSource(localSaved ? 'local' : 'empty');
      setError(localSaved ? null : 'O armazenamento local não está disponível neste navegador.');
      return;
    }

    if (!nextProfile) return;

    const timeout = window.setTimeout(() => {
      void (async (): Promise<void> => {
        setSaving(true);
        try {
          const profileWrite = await client
            .from('profiles')
            .upsert(
              {
                id: userId,
                username: nextProfile.username,
                gold: progress.gold,
                current_floor: progress.current_floor,
                current_wave: progress.current_wave,
              },
              { onConflict: 'id' },
            )
            .select('*')
            .single();
          if (profileWrite.error) throw profileWrite.error;

          let savedItems = playerStateRef.current.inventory;
          if (incomingRows.length > 0) {
            const inventoryWrite = await client
              .from('inventory')
              .upsert(incomingRows, { onConflict: 'id' })
              .select('*');
            if (inventoryWrite.error) throw inventoryWrite.error;
            savedItems = mergeInventory(playerStateRef.current.inventory, inventoryWrite.data);
          }

          setPlayerState((current) => ({ ...current, profile: profileWrite.data, inventory: savedItems }));
          setSource('remote');
          setError(null);
        } catch (saveError: unknown) {
          setSource('local');
          setError(errorMessage(saveError));
        } finally {
          setSaving(false);
        }
      })();
    }, Math.max(0, debounceMs));

    return () => window.clearTimeout(timeout);
  }, [
    client,
    loading,
    userId,
    gold,
    currentFloor,
    currentWave,
    inventory,
    debounceMs,
  ]);

  const reload = useCallback(async (): Promise<void> => {
    if (!client) {
      await loadForUser(null);
      return;
    }
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      setError(sessionError.message);
      await loadForUser(null);
      return;
    }
    await loadForUser(data.session?.user.id ?? null);
  }, [client, loadForUser]);

  return {
    ...playerState,
    userId,
    progress,
    loading,
    saving,
    source,
    error,
    reload,
  };
}

