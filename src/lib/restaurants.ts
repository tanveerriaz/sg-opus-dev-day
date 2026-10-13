import "server-only";
import { createHash, randomUUID } from "node:crypto";
import seed from "@/data/seed-restaurant.json";
import { slugify } from "./scrape/extract";
import type { Menu, Restaurant } from "./menu";
import { getSupabase } from "./supabase";

const seedRestaurant = seed as Restaurant;
export const SEED_RESTAURANT_ID = seedRestaurant.id;

// Without Supabase env vars (local dev before the project is set up), restaurants
// live in memory: the seed plus anything scraped since the dev server started.
// Kept on globalThis because Next.js can load this module separately for routes and pages.
const globalStore = globalThis as typeof globalThis & { __restaurants?: Map<string, Restaurant> };
const memory = (globalStore.__restaurants ??= new Map([[seedRestaurant.id, seedRestaurant]]));

const COLUMNS = "id, name, source_url, menu";

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  const supabase = getSupabase();
  if (!supabase) return memory.get(id) ?? null;

  const { data, error } = await supabase.from("restaurants").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Loading restaurant ${id} failed: ${error.message}`);
  return data as Restaurant | null;
}

/** The saved copy of a previous scrape of this URL, used when a live scrape fails or is slow. */
export async function findRestaurantBySourceUrl(sourceUrl: string, signal?: AbortSignal): Promise<Restaurant | null> {
  const supabase = getSupabase();
  if (!supabase) return [...memory.values()].find((r) => r.source_url === sourceUrl) ?? null;

  const query = supabase
    .from("restaurants")
    .select(COLUMNS)
    .eq("source_url", sourceUrl)
    .order("scraped_at", { ascending: false })
    .limit(1);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  if (error) throw new Error(`Looking up ${sourceUrl} failed: ${error.message}`);
  return data as Restaurant | null;
}

/** Saves a fresh scrape. Re-scraping a URL updates its restaurant, so existing QR codes keep working. */
export async function saveScrapedRestaurant(scrape: {
  name: string;
  source_url: string | null;
  menu: Menu;
}, signal?: AbortSignal): Promise<Restaurant> {
  signal?.throwIfAborted();
  const existing = scrape.source_url ? await findRestaurantBySourceUrl(scrape.source_url, signal) : null;
  // URL-derived suffix avoids concurrent name collisions without a schema migration.
  const id = existing?.id ?? `${slugify(scrape.name)}-${createHash("sha256").update(scrape.source_url ?? randomUUID()).digest("hex").slice(0, 16)}`;
  const restaurant: Restaurant = { id, ...scrape };

  const supabase = getSupabase();
  signal?.throwIfAborted();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") throw new Error("Restaurant storage is not configured.");
    memory.set(id, restaurant);
    return restaurant;
  }
  const query = supabase.from("restaurants").upsert({ ...restaurant, scraped_at: new Date().toISOString() });
  const { error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw new Error(`Saving ${scrape.name} failed: ${error.message}`);
  return restaurant;
}
