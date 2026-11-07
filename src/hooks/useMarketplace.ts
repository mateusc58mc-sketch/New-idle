'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import { ITEM_BY_ID } from '@/data/items';
import { getSupabaseBrowserClient, type Database, type Json } from '@/lib/supabase/client';
import type { Item, ItemCategory, Rarity } from '@/types/game';

type ListingDetailsRow = Database['public']['Views']['marketplace_listing_details']['Row'];
type InventoryRow = Database['public']['Tables']['inventory']['Row'];

export interface MarketplaceFilters {
  readonly rarity?: Rarity | 'all';
  readonly category?: ItemCategory | 'all';
}

export interface MarketplaceOffer extends ListingDetailsRow {
  readonly item: Item | null;
}

export interface UseMarketplaceResult {
  readonly listings: readonly MarketplaceOffer[];
  readonly myListings: readonly MarketplaceOffer[];
  readonly loading: boolean;
  readonly busyListingId: string | null;
  readonly error: string | null;
  fetchListings(filters?: MarketplaceFilters): Promise<readonly MarketplaceOffer[]>;
  listItem(itemId: string, priceGold: number): Promise<void>;
  buyItem(listingId: string): Promise<number>;
  cancelListing(listingId: string): Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a ação no mercado.';
}

function isAttributeRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isMarketplaceInventoryTradable(row: InventoryRow): boolean {
  const item = ITEM_BY_ID.get(row.item_id);
  if (!item?.tradable || !isAttributeRecord(row.attributes)) return false;
  const attributes = row.attributes;
  return attributes.bound !== true
    && attributes.locked !== true
    && attributes.equipped_slot == null
    && attributes.equipped_by == null;
}

export function useMarketplace(
  userId: string | null,
  inventory: readonly InventoryRow[],
): UseMarketplaceResult {
  const client = getSupabaseBrowserClient();
  const [listings, setListings] = useState<readonly MarketplaceOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef<MarketplaceFilters>({});
  const fetchSequence = useRef(0);

  const myListings = useMemo(
    () => listings.filter((listing) => listing.seller_id === userId),
    [listings, userId],
  );

  const fetchListings = useCallback(async (filters: MarketplaceFilters = {}): Promise<readonly MarketplaceOffer[]> => {
    const sequence = ++fetchSequence.current;
    filtersRef.current = filters;
    setLoading(true);
    setError(null);

    if (!client) {
      setListings([]);
      setError('O cliente do Supabase não está configurado neste ambiente.');
      setLoading(false);
      return [];
    }

    try {
      let query = client
        .from('marketplace_listing_details')
        .select('*')
        .eq('status', 'listed')
        .order('created_at', { ascending: false });
      if (filters.rarity && filters.rarity !== 'all') query = query.eq('rarity', filters.rarity);

      const result = await query;
      if (result.error) throw result.error;

      const enriched: MarketplaceOffer[] = result.data
        .map((row) => ({ ...row, item: ITEM_BY_ID.get(row.catalog_item_id) ?? null }))
        .filter((offer) => filters.category === undefined || filters.category === 'all' || offer.item?.category === filters.category);
      if (sequence === fetchSequence.current) setListings(enriched);
      return enriched;
    } catch (fetchError: unknown) {
      if (sequence === fetchSequence.current) {
        setListings([]);
        setError(errorMessage(fetchError));
      }
      throw fetchError;
    } finally {
      if (sequence === fetchSequence.current) setLoading(false);
    }
  }, [client]);

  const requireAuthenticatedUser = useCallback(async (): Promise<string> => {
    if (!client) throw new Error('O cliente do Supabase não está configurado.');
    const result = await client.auth.getUser();
    if (result.error) throw result.error;
    const authenticatedUserId = result.data.user?.id;
    if (!authenticatedUserId || (userId && authenticatedUserId !== userId)) {
      throw new Error('Entre na sua conta para usar o mercado.');
    }
    return authenticatedUserId;
  }, [client, userId]);

  const listItem = useCallback(async (itemId: string, priceGold: number): Promise<void> => {
    if (!Number.isSafeInteger(priceGold) || priceGold <= 0) {
      throw new Error('Informe um preço em ouro maior que zero.');
    }
    const sellerId = await requireAuthenticatedUser();
    const row = inventory.find((entry) => entry.id === itemId && entry.profile_id === sellerId);
    if (!row || !isMarketplaceInventoryTradable(row)) {
      throw new Error('Este item não está disponível para anúncio.');
    }
    if (myListings.some((listing) => listing.item_id === itemId)) {
      throw new Error('Este item já está anunciado.');
    }
    if (!client) throw new Error('O cliente do Supabase não está configurado.');

    setBusyListingId(itemId);
    setError(null);
    try {
      const result = await client.from('marketplace_listings').insert({
        seller_id: sellerId,
        item_id: itemId,
        price_gold: priceGold,
        status: 'listed',
      });
      if (result.error) throw result.error;
      await fetchListings(filtersRef.current).catch(() => undefined);
    } catch (actionError: unknown) {
      setError(errorMessage(actionError));
      throw actionError;
    } finally {
      setBusyListingId(null);
    }
  }, [client, fetchListings, inventory, myListings, requireAuthenticatedUser]);

  const buyItem = useCallback(async (listingId: string): Promise<number> => {
    const buyerId = await requireAuthenticatedUser();
    const offer = listings.find((listing) => listing.id === listingId);
    if (!offer) throw new Error('Esta oferta não está mais disponível. Atualize a lista.');
    if (offer.seller_id === buyerId) throw new Error('Você não pode comprar seu próprio anúncio.');
    if (!client) throw new Error('O cliente do Supabase não está configurado.');

    setBusyListingId(listingId);
    setError(null);
    try {
      const result = await client.rpc('buy_marketplace_item', {
        listing_id: listingId,
        buyer_id: buyerId,
      });
      if (result.error) throw result.error;
      if (result.data !== true) throw new Error('A compra não foi confirmada pelo servidor.');
      const profileResult = await client.from('profiles').select('gold').eq('id', buyerId).single();
      if (profileResult.error) throw profileResult.error;
      await fetchListings(filtersRef.current).catch(() => undefined);
      return profileResult.data.gold;
    } catch (actionError: unknown) {
      setError(errorMessage(actionError));
      throw actionError;
    } finally {
      setBusyListingId(null);
    }
  }, [client, fetchListings, listings, requireAuthenticatedUser]);

  const cancelListing = useCallback(async (listingId: string): Promise<void> => {
    const sellerId = await requireAuthenticatedUser();
    const offer = myListings.find((listing) => listing.id === listingId && listing.seller_id === sellerId);
    if (!offer) throw new Error('Este anúncio não pertence à sua conta ou já foi encerrado.');
    if (!client) throw new Error('O cliente do Supabase não está configurado.');

    setBusyListingId(listingId);
    setError(null);
    try {
      const result = await client
        .from('marketplace_listings')
        .update({ status: 'cancelled' }, { count: 'exact' })
        .eq('id', listingId)
        .eq('seller_id', sellerId)
        .eq('status', 'listed');
      if (result.error) throw result.error;
      if (result.count !== 1) throw new Error('Este anúncio foi comprado ou encerrado antes do cancelamento.');
      await fetchListings(filtersRef.current).catch(() => undefined);
    } catch (actionError: unknown) {
      setError(errorMessage(actionError));
      throw actionError;
    } finally {
      setBusyListingId(null);
    }
  }, [client, fetchListings, myListings, requireAuthenticatedUser]);

  return { listings, myListings, loading, busyListingId, error, fetchListings, listItem, buyItem, cancelListing };
}
