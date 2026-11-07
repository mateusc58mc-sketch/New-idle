-- Aetheria Online — Fase 6.2: RLS e políticas por proprietário.

alter table public.profiles enable row level security;
alter table public.squad_characters enable row level security;
alter table public.inventory enable row level security;

-- profiles: a coluna id corresponde ao auth.users.id.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- squad_characters: profile_id vincula o personagem ao usuário proprietário.
create policy "squad_characters_select_own"
  on public.squad_characters for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "squad_characters_insert_own"
  on public.squad_characters for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "squad_characters_update_own"
  on public.squad_characters for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

-- inventory: profile_id vincula o item ao usuário proprietário.
create policy "inventory_select_own"
  on public.inventory for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "inventory_insert_own"
  on public.inventory for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "inventory_update_own"
  on public.inventory for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);