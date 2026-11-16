-- ============================================================================
-- Aetheria Online — Stage 6.1: esquema inicial (MVP)
-- profiles / squad_characters / inventory + trigger de updated_at
-- ============================================================================

-- Extensão para gen_random_uuid() (idempotente no Supabase).
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Função reutilizável: atualiza updated_at em qualquer UPDATE.
-- --------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==========================================================================
-- profiles — um registo por utilizador autenticado.
-- ==========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  gold bigint not null default 0 check (gold >= 0),
  current_floor integer not null default 1 check (current_floor >= 1),
  current_wave integer not null default 1 check (current_wave >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 32)
);

-- ==========================================================================
-- squad_characters — heróis do squad (máx. 4 por perfil, regra de negócio
-- validada na camada de aplicação/servidor, não por DDL).
-- ==========================================================================
create table if not exists public.squad_characters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  race_id text not null,
  class_id text not null,
  level integer not null default 1 check (level >= 1),
  exp bigint not null default 0 check (exp >= 0),
  equipped_items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists squad_characters_profile_id_idx
  on public.squad_characters (profile_id);

-- ==========================================================================
-- inventory — instâncias de item por perfil.
-- ==========================================================================
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null,
  rarity text not null,
  enhancement_level integer not null default 0 check (enhancement_level >= 0),
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_profile_id_idx
  on public.inventory (profile_id);

-- ==========================================================================
-- Triggers de updated_at (um por tabela, mesma função reutilizável).
-- ==========================================================================
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_squad_characters_updated_at on public.squad_characters;
create trigger trg_squad_characters_updated_at
  before update on public.squad_characters
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_inventory_updated_at on public.inventory;
create trigger trg_inventory_updated_at
  before update on public.inventory
  for each row execute function public.handle_updated_at();