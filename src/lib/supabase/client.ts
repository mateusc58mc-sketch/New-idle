'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          username: string;
          gold: number;
          current_floor: number;
          current_wave: number;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          username: string;
          gold?: number;
          current_floor?: number;
          current_wave?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          username?: string;
          gold?: number;
          current_floor?: number;
          current_wave?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      squad_characters: Table<
        {
          id: string;
          profile_id: string;
          race_id: string;
          class_id: string;
          level: number;
          exp: number;
          equipped_items: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          profile_id: string;
          race_id: string;
          class_id: string;
          level?: number;
          exp?: number;
          equipped_items?: Json;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          profile_id?: string;
          race_id?: string;
          class_id?: string;
          level?: number;
          exp?: number;
          equipped_items?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      inventory: Table<
        {
          id: string;
          profile_id: string;
          item_id: string;
          rarity: string;
          enhancement_level: number;
          attributes: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          profile_id: string;
          item_id: string;
          rarity: string;
          enhancement_level?: number;
          attributes?: Json;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          profile_id?: string;
          item_id?: string;
          rarity?: string;
          enhancement_level?: number;
          attributes?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      marketplace_listings: Table<
        {
          id: string;
          seller_id: string;
          item_id: string;
          price_gold: number;
          status: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          seller_id: string;
          item_id: string;
          price_gold: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          seller_id?: string;
          item_id?: string;
          price_gold?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
    };
    Views: {
      marketplace_listing_details: View<{
        id: string;
        seller_id: string;
        item_id: string;
        price_gold: number;
        status: string;
        created_at: string;
        catalog_item_id: string;
        rarity: string;
        enhancement_level: number;
      }>;
    };
    Functions: {
      buy_marketplace_item: {
        Args: { listing_id: string; buyer_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

let browserClient: SupabaseClient<Database> | null = null;

/** Returns the singleton browser client, or null until public env vars exist. */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  browserClient ??= createClient<Database>(url, key);
  return browserClient;
}

