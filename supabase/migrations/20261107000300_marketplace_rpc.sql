-- Pin the trigger helper's name resolution to a trusted schema.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- Complete a marketplace purchase as one transaction. The listing row serializes
-- competing buyers; profile locks are acquired in UUID order to avoid deadlocks.
create or replace function public.buy_marketplace_item(
  listing_id uuid,
  buyer_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_seller_id uuid;
  v_item_id uuid;
  v_price_gold bigint;
  v_status text;
  v_item_owner_id uuid;
  v_buyer_gold bigint;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> buyer_id then
    raise exception using
      errcode = '42501',
      message = 'MARKETPLACE_UNAUTHORIZED: buyer_id must match the authenticated user';
  end if;

  select listing.seller_id, listing.item_id, listing.price_gold, listing.status
    into v_seller_id, v_item_id, v_price_gold, v_status
  from public.marketplace_listings as listing
  where listing.id = buy_marketplace_item.listing_id
  for update;

  if not found or v_status <> 'listed' then
    raise exception using
      errcode = 'P0001',
      message = 'MARKETPLACE_LISTING_UNAVAILABLE: listing does not exist or is no longer listed';
  end if;

  if buyer_id = v_seller_id then
    raise exception using
      errcode = 'P0001',
      message = 'MARKETPLACE_SELF_PURCHASE: buyers cannot purchase their own listing';
  end if;

  perform profile.id
  from public.profiles as profile
  where profile.id in (buyer_id, v_seller_id)
  order by profile.id
  for update;

  select profile.gold
    into v_buyer_gold
  from public.profiles as profile
  where profile.id = buyer_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MARKETPLACE_BUYER_NOT_FOUND: buyer profile does not exist';
  end if;

  if not exists (
    select 1 from public.profiles as profile where profile.id = v_seller_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'MARKETPLACE_SELLER_NOT_FOUND: seller profile does not exist';
  end if;

  if v_buyer_gold < v_price_gold then
    raise exception using
      errcode = 'P0001',
      message = 'MARKETPLACE_INSUFFICIENT_GOLD: buyer does not have enough gold';
  end if;

  select item.profile_id
    into v_item_owner_id
  from public.inventory as item
  where item.id = v_item_id
  for update;

  if not found or v_item_owner_id <> v_seller_id then
    raise exception using
      errcode = 'P0001',
      message = 'MARKETPLACE_ITEM_UNAVAILABLE: listed item is not owned by the seller';
  end if;

  update public.profiles as profile
  set gold = profile.gold - v_price_gold
  where profile.id = buyer_id;

  update public.profiles as profile
  set gold = profile.gold + v_price_gold
  where profile.id = v_seller_id;

  update public.inventory as item
  set profile_id = buyer_id
  where item.id = v_item_id and item.profile_id = v_seller_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MARKETPLACE_ITEM_TRANSFER_FAILED: item ownership changed during purchase';
  end if;

  update public.marketplace_listings as listing
  set status = 'sold'
  where listing.id = buy_marketplace_item.listing_id
    and listing.status = 'listed';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MARKETPLACE_LISTING_UPDATE_FAILED: listing status changed during purchase';
  end if;

  return true;
end;
$function$;

revoke all on function public.buy_marketplace_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.buy_marketplace_item(uuid, uuid) to authenticated;
