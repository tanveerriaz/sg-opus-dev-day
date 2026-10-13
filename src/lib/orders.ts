import "server-only";
import { randomUUID } from "node:crypto";
import type { OrderItem } from "./cart";
import type { Mode } from "./menu";
import { getSupabase } from "./supabase";

export type NewOrder = {
  restaurant_id: string;
  mode: Mode;
  table_number: string | null;
  items: OrderItem[];
  notes: string | null;
};

export type StoredOrder = NewOrder & { id: string; created_at: string };

// Without Supabase (local dev), orders live in memory until the server restarts.
// Kept on globalThis so Next's hot reload doesn't wipe them.
const memory = ((globalThis as { __orders?: StoredOrder[] }).__orders ??= []);

/** Saves an order and returns its id. */
export async function saveOrder(order: NewOrder): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn("Supabase isn't configured; keeping the order in memory.");
    const id = randomUUID();
    memory.unshift({ ...order, id, created_at: new Date().toISOString() });
    return id;
  }

  const { data, error } = await supabase.from("orders").insert(order).select("id").single();
  if (error) throw new Error(`Saving the order failed: ${error.message}`);
  return data.id as string;
}
