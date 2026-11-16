-- Player marketplace listings.
create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.inventory (id) on delete cascade,
  price_gold bigint not null check (price_gold > 0),
  status text not null default 'listed'
    check (status in ('listed', 'sold', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketplace_listings_seller_id_idx
  on public.marketplace_listings (seller_id);

create index marketplace_listings_listed_created_at_idx
  on public.marketplace_listings (created_at desc)
  where status = 'listed';

alter table public.marketplace_listings enable row level security;

grant select on public.marketplace_listings to anon, authenticated;
grant insert, update on public.marketplace_listings to authenticated;

create policy marketplace_listings_select_listed
  on public.marketplace_listings
  for select
  to anon, authenticated
  using (status = 'listed');

create policy marketplace_listings_insert_own
  on public.marketplace_listings
  for insert
  to authenticated
  with check (
    (select auth.uid()) = seller_id
    and status = 'listed'
    and exists (
      select 1
      from public.inventory as inventory_item
      where inventory_item.id = marketplace_listings.item_id
        and inventory_item.profile_id = (select auth.uid())
    )
  );

create policy marketplace_listings_update_own
  on public.marketplace_listings
  for update
  to authenticated
  using (
    (select auth.uid()) = seller_id
    and status = 'listed'
  )
  with check (
    (select auth.uid()) = seller_id
    and status in ('listed', 'cancelled')
    and exists (
      select 1
      from public.inventory as inventory_item
      where inventory_item.id = marketplace_listings.item_id
        and inventory_item.profile_id = (select auth.uid())
    )
  );

create trigger marketplace_listings_updated_at
  before update on public.marketplace_listings
  for each row
  execute function public.handle_updated_at();
