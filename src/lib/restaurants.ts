import "server-only";
import seed from "@/data/seed-restaurant.json";
import type { Restaurant } from "./menu";
import { getSupabase } from "./supabase";

const seedRestaurant = seed as Restaurant;

/**
 * Loads a restaurant by its slug. Without Supabase env vars (e.g. local dev
 * before the project is set up) only the seed restaurant is available.
 */
export async function getRestaurant(id: string): Promise<Restaurant | null> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn("Supabase isn't configured; serving the seed restaurant only.");
    return id === seedRestaurant.id ? seedRestaurant : null;
  }

  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, source_url, menu")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Loading restaurant ${id} failed: ${error.message}`);
  return data as Restaurant | null;
}

export const SEED_RESTAURANT_ID = seedRestaurant.id;
