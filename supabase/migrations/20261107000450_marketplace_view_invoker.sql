-- Keep the public listing projection under caller privileges rather than
-- bypassing RLS through the view owner.
create or replace view public.marketplace_listing_details
with (security_invoker = true)
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

-- Anonymous users may read only the inventory columns used by the view.
revoke select on public.inventory from anon;
grant select (id, item_id, rarity, enhancement_level)
  on public.inventory to anon;

create policy inventory_select_marketplace_listed
  on public.inventory
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.marketplace_listings as listing
      where listing.item_id = inventory.id
        and listing.status = 'listed'
    )
  );

grant select on public.marketplace_listing_details to anon, authenticated;
