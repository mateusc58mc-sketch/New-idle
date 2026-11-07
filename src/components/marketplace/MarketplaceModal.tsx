'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { ITEM_BY_ID } from '@/data/items';
import { isMarketplaceInventoryTradable, useMarketplace, type MarketplaceFilters } from '@/hooks/useMarketplace';
import type { Database } from '@/lib/supabase/client';
import type { ItemCategory, Rarity } from '@/types/game';

type InventoryRow = Database['public']['Tables']['inventory']['Row'];
type MarketplaceTab = 'market' | 'mine';

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const CATEGORIES: readonly ItemCategory[] = ['equipment', 'consumable', 'material', 'card', 'cosmetic', 'pet'];

const RARITY_LABELS: Readonly<Record<Rarity, string>> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
  mythic: 'Mítico',
};

const CATEGORY_LABELS: Readonly<Record<ItemCategory, string>> = {
  equipment: 'Equipamento',
  consumable: 'Consumível',
  material: 'Material',
  card: 'Carta',
  cosmetic: 'Cosmético',
  pet: 'Mascote',
};

const RARITY_COLORS: Readonly<Record<Rarity, string>> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#38bdf8',
  epic: '#a78bfa',
  legendary: '#fbbf24',
  mythic: '#f472b6',
};

interface MarketplaceModalProps {
  readonly userId: string | null;
  readonly gold: number;
  readonly inventory: readonly InventoryRow[];
  readonly onClose: () => void;
  /** Receives the balance returned by the database after a completed purchase. */
  readonly onPurchased: (gold: number) => Promise<void>;
}

export function MarketplaceModal({ userId, gold, inventory, onClose, onPurchased }: MarketplaceModalProps) {
  const [tab, setTab] = useState<MarketplaceTab>('market');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'all'>('all');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [priceGold, setPriceGold] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const filters: MarketplaceFilters = { rarity: rarityFilter, category: categoryFilter };
  const market = useMarketplace(userId, inventory);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    void market.fetchListings({ rarity: rarityFilter, category: categoryFilter }).catch(() => undefined);
  }, [market.fetchListings, rarityFilter, categoryFilter]);

  const listedItemIds = useMemo(() => new Set(market.myListings.map((listing) => listing.item_id)), [market.myListings]);
  const availableInventory = useMemo(
    () => inventory.filter((row) => isMarketplaceInventoryTradable(row) && !listedItemIds.has(row.id)),
    [inventory, listedItemIds],
  );

  const handleBuy = async (listingId: string): Promise<void> => {
    setMessage(null);
    setActionError(null);
    try {
      const updatedGold = await market.buyItem(listingId);
      await onPurchased(updatedGold);
      setMessage('Compra concluída. O ouro e o inventário foram atualizados.');
    } catch (buyError: unknown) {
      setActionError(buyError instanceof Error ? buyError.message : 'Não foi possível comprar este item.');
    }
  };

  const handleListItem = async (): Promise<void> => {
    const price = Number(priceGold);
    setMessage(null);
    setActionError(null);
    try {
      await market.listItem(selectedItemId, price);
      setPriceGold('');
      setSelectedItemId('');
      setMessage('Item anunciado no mercado.');
    } catch (listError: unknown) {
      setActionError(listError instanceof Error ? listError.message : 'Não foi possível anunciar este item.');
    }
  };

  const handleCancel = async (listingId: string): Promise<void> => {
    setMessage(null);
    setActionError(null);
    try {
      await market.cancelListing(listingId);
      setMessage('Anúncio cancelado. O item voltou a ficar disponível no inventário.');
    } catch (cancelError: unknown) {
      setActionError(cancelError instanceof Error ? cancelError.message : 'Não foi possível cancelar este anúncio.');
    }
  };

  return (
    <div
      style={backdropStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section aria-labelledby="marketplace-title" aria-modal="true" ref={dialogRef} role="dialog" style={dialogStyle} tabIndex={-1}>
        <header style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Aetheria Online</p>
            <h2 id="marketplace-title" style={titleStyle}>Mercado entre jogadores</h2>
            <p style={subtitleStyle}>Seu saldo: {gold.toLocaleString('pt-BR')} ouro</p>
          </div>
          <button aria-label="Fechar mercado" onClick={onClose} style={closeButtonStyle} type="button">×</button>
        </header>

        <nav aria-label="Seções do mercado" role="tablist" style={tabsStyle}>
          <button aria-selected={tab === 'market'} onClick={() => setTab('market')} role="tab" style={tabStyle(tab === 'market')} type="button">
            Ofertas
          </button>
          <button aria-selected={tab === 'mine'} onClick={() => setTab('mine')} role="tab" style={tabStyle(tab === 'mine')} type="button">
            Meus Anúncios ({market.myListings.length})
          </button>
        </nav>

        <div style={filtersStyle}>
          <label style={filterLabelStyle}>
            Raridade
            <select onChange={(event) => setRarityFilter(event.target.value as Rarity | 'all')} style={selectStyle} value={rarityFilter}>
              <option value="all">Todas</option>
              {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{RARITY_LABELS[rarity]}</option>)}
            </select>
          </label>
          <label style={filterLabelStyle}>
            Tipo de item
            <select onChange={(event) => setCategoryFilter(event.target.value as ItemCategory | 'all')} style={selectStyle} value={categoryFilter}>
              <option value="all">Todos</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
            </select>
          </label>
          <button onClick={() => void market.fetchListings(filters).catch(() => undefined)} style={refreshButtonStyle} type="button">
            Atualizar ofertas
          </button>
        </div>

        {market.error ? <p role="alert" style={errorStyle}>{market.error}</p> : null}
        {actionError ? <p role="alert" style={errorStyle}>{actionError}</p> : null}
        {message ? <p aria-live="polite" style={messageStyle}>{message}</p> : null}

        {tab === 'market' ? (
          <div aria-label="Itens à venda" role="tabpanel" style={listStyle}>
            {market.loading ? <p style={emptyStyle}>Carregando ofertas…</p> : null}
            {!market.loading && market.listings.length === 0 ? <p style={emptyStyle}>Nenhum item à venda com estes filtros.</p> : null}
            {market.listings.map((listing) => {
              const isOwnListing = listing.seller_id === userId;
              const canAfford = gold >= listing.price_gold;
              return (
                <article key={listing.id} style={offerStyle}>
                  <div style={offerDetailsStyle}>
                    <strong style={itemNameStyle}>{listing.item?.name ?? 'Item desconhecido'}</strong>
                    <span style={{ color: RARITY_COLORS[listing.rarity as Rarity] ?? '#cbd5e1', fontSize: 13 }}>
                      {RARITY_LABELS[listing.rarity as Rarity] ?? listing.rarity}
                      {listing.enhancement_level > 0 ? ` · +${listing.enhancement_level}` : ''}
                    </span>
                    <span style={sellerStyle}>{isOwnListing ? 'Seu anúncio' : `Vendedor ${listing.seller_id.slice(0, 8)}`}</span>
                  </div>
                  <div style={offerActionStyle}>
                    <strong style={priceStyle}>{listing.price_gold.toLocaleString('pt-BR')} ouro</strong>
                    {isOwnListing ? (
                      <button disabled={market.busyListingId !== null} onClick={() => void handleCancel(listing.id)} style={secondaryButtonStyle} type="button">
                        Cancelar
                      </button>
                    ) : (
                      <button
                        disabled={!userId || !canAfford || market.busyListingId !== null}
                        onClick={() => void handleBuy(listing.id)}
                        style={primaryButtonStyle}
                        title={!userId ? 'Entre para comprar' : !canAfford ? 'Ouro insuficiente' : undefined}
                        type="button"
                      >
                        {market.busyListingId === listing.id ? 'Processando…' : 'Comprar'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div aria-label="Meus anúncios" role="tabpanel" style={listStyle}>
            {!userId ? <p style={emptyStyle}>Entre na sua conta para anunciar itens.</p> : null}
            {userId ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleListItem();
                }}
                style={listingFormStyle}
              >
                <label style={filterLabelStyle}>
                  Item do inventário
                  <select
                    onChange={(event) => setSelectedItemId(event.target.value)}
                    required
                    style={selectStyle}
                    value={selectedItemId}
                  >
                    <option value="">Selecione um item negociável</option>
                    {availableInventory.map((row) => {
                      const item = ITEM_BY_ID.get(row.item_id);
                      return <option key={row.id} value={row.id}>{item?.name ?? row.item_id} · {RARITY_LABELS[row.rarity as Rarity] ?? row.rarity}</option>;
                    })}
                  </select>
                </label>
                <label style={filterLabelStyle}>
                  Preço em ouro
                  <input
                    min="1"
                    onChange={(event) => setPriceGold(event.target.value)}
                    required
                    style={inputStyle}
                    type="number"
                    value={priceGold}
                  />
                </label>
                <button disabled={!selectedItemId || !priceGold || market.busyListingId !== null} style={primaryButtonStyle} type="submit">
                  {market.busyListingId === selectedItemId && selectedItemId ? 'Anunciando…' : 'Anunciar item'}
                </button>
              </form>
            ) : null}
            {market.myListings.map((listing) => (
              <article key={listing.id} style={offerStyle}>
                <div style={offerDetailsStyle}>
                  <strong style={itemNameStyle}>{listing.item?.name ?? 'Item desconhecido'}</strong>
                  <span style={{ color: RARITY_COLORS[listing.rarity as Rarity] ?? '#cbd5e1', fontSize: 13 }}>
                    {RARITY_LABELS[listing.rarity as Rarity] ?? listing.rarity}
                    {listing.enhancement_level > 0 ? ` · +${listing.enhancement_level}` : ''}
                  </span>
                </div>
                <div style={offerActionStyle}>
                  <strong style={priceStyle}>{listing.price_gold.toLocaleString('pt-BR')} ouro</strong>
                  <button disabled={market.busyListingId !== null} onClick={() => void handleCancel(listing.id)} style={secondaryButtonStyle} type="button">
                    {market.busyListingId === listing.id ? 'Cancelando…' : 'Cancelar'}
                  </button>
                </div>
              </article>
            ))}
            {userId && availableInventory.length === 0 && market.myListings.length === 0 ? (
              <p style={emptyStyle}>Você não tem itens negociáveis disponíveis para anunciar.</p>
            ) : null}
            {userId && market.myListings.length === 0 ? <p style={emptyStyle}>Você ainda não tem anúncios ativos.</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}

const backdropStyle = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 100,
  display: 'grid',
  placeItems: 'center',
  padding: 12,
  background: 'rgba(2, 6, 23, 0.82)',
  backdropFilter: 'blur(6px)',
};
const dialogStyle = {
  width: 'min(760px, calc(100vw - 24px))',
  maxHeight: 'min(820px, calc(100vh - 24px))',
  overflow: 'auto',
  border: '1px solid #334155',
  borderRadius: 18,
  padding: 22,
  background: '#0b1220',
  color: '#e2e8f0',
  boxShadow: '0 24px 90px rgba(0, 0, 0, 0.6)',
};
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 };
const eyebrowStyle = { margin: 0, color: '#a78bfa', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const };
const titleStyle = { margin: '5px 0 0', fontSize: 23 };
const subtitleStyle = { margin: '6px 0 0', color: '#94a3b8', fontSize: 13 };
const closeButtonStyle = { width: 38, height: 38, border: '1px solid #475569', borderRadius: 10, background: '#111827', color: '#e2e8f0', fontSize: 24, cursor: 'pointer' };
const tabsStyle = { display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid #334155' };
const tabStyle = (active: boolean) => ({ border: 0, borderBottom: active ? '2px solid #a78bfa' : '2px solid transparent', padding: '10px 12px', background: 'transparent', color: active ? '#e9d5ff' : '#94a3b8', cursor: 'pointer', fontWeight: 700 });
const filtersStyle = { display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' as const, margin: '16px 0' };
const filterLabelStyle = { display: 'grid', gap: 6, color: '#94a3b8', fontSize: 12, fontWeight: 600 };
const selectStyle = { minWidth: 170, border: '1px solid #334155', borderRadius: 8, padding: '9px 10px', background: '#111827', color: '#e2e8f0' };
const inputStyle = { width: 150, border: '1px solid #334155', borderRadius: 8, padding: '9px 10px', background: '#111827', color: '#e2e8f0' };
const refreshButtonStyle = { border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', background: '#172033', color: '#cbd5e1', cursor: 'pointer' };
const listStyle = { display: 'grid', gap: 10, maxHeight: 480, overflow: 'auto', paddingRight: 3 };
const offerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const, border: '1px solid #263449', borderRadius: 12, padding: '12px 14px', background: 'rgba(15, 23, 42, 0.82)' };
const offerDetailsStyle = { display: 'grid', gap: 4 };
const itemNameStyle = { fontSize: 15 };
const sellerStyle = { color: '#64748b', fontSize: 11 };
const offerActionStyle = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const };
const priceStyle = { color: '#fbbf24', whiteSpace: 'nowrap' as const };
const primaryButtonStyle = { border: '1px solid #7c3aed', borderRadius: 8, padding: '9px 13px', background: '#6d28d9', color: 'white', cursor: 'pointer', fontWeight: 700 };
const secondaryButtonStyle = { border: '1px solid #475569', borderRadius: 8, padding: '9px 13px', background: '#1e293b', color: '#cbd5e1', cursor: 'pointer' };
const listingFormStyle = { display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' as const, marginBottom: 8, padding: 13, border: '1px solid #334155', borderRadius: 12, background: 'rgba(30, 41, 59, 0.45)' };
const emptyStyle = { margin: 0, padding: 20, color: '#94a3b8', textAlign: 'center' as const };
const errorStyle = { margin: '8px 0', color: '#fca5a5', fontSize: 13 };
const messageStyle = { margin: '8px 0', color: '#86efac', fontSize: 13 };
