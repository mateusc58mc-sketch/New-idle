-- Expose only the item metadata needed to render public marketplace offers.
-- The view runs with its owner privileges so inventory RLS remains private
-- outside the listed-item projection below.
create or replace view public.marketplace_listing_details
with (security_invoker = false)
as
select
  listing.id,
  listing.seller_id,
  listing.item_id,
  listing.price_gold,
  listing.status,
  listing.created_at,
  item.item_id as catalog_item_id,
  item.rarity,
  item.enhancement_level
from public.marketplace_listings as listing
join public.inventory as item on item.id = listing.item_id
where listing.status = 'listed';

grant select on public.marketplace_listing_details to anon, authenticated;

create unique index marketplace_listings_one_active_item_idx
  on public.marketplace_listings (item_id)
  where status = 'listed';
