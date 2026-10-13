import "server-only";
import { randomUUID } from "node:crypto";
import type { Mode } from "./menu";
import { SEED_RESTAURANT_ID } from "./restaurants";
import { getSupabase } from "./supabase";

/** One line of an order, as stored in the `orders.items` JSON column. */
export type OrderItem = {
  item_id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
};

/**
 * An order as the kitchen sees it. It has no diner id on purpose: the dashboard
 * is open to anyone with the link, so nothing about the diner may reach it.
 */
export type KitchenOrder = {
  id: string;
  mode: Mode;
  table_number: string | null;
  items: OrderItem[];
  notes: string | null;
  created_at: string;
  served_at: string | null;
};

export type KitchenOrders = {
  orders: KitchenOrder[];
  /** False until migration 0002 (the `served_at` column) has been run. */
  canMarkServed: boolean;
};

const KITCHEN_COLUMNS = "id, mode, table_number, items, notes, created_at";
const MAX_ORDERS = 50;
const UNDEFINED_COLUMN = "42703";

/** A restaurant's latest orders, newest first. */
export async function listKitchenOrders(restaurantId: string): Promise<KitchenOrders> {
  const supabase = getSupabase();
  if (!supabase) {
    return { orders: [...memory.filter(o => o.restaurant_id === restaurantId), ...sampleOrders(restaurantId)], canMarkServed: true };
  }

  const latest = (columns: string) =>
    supabase
      .from("orders")
      .select(columns)
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(MAX_ORDERS)
      .returns<KitchenOrder[]>();

  const withServed = await latest(`${KITCHEN_COLUMNS}, served_at`);
  if (!withServed.error) return { orders: withServed.data, canMarkServed: true };
  if (withServed.error.code !== UNDEFINED_COLUMN) {
    throw new Error(`Loading orders for ${restaurantId} failed: ${withServed.error.message}`);
  }

  // Migration 0002 hasn't been run yet: orders still show, just without "mark served".
  const { data, error } = await latest(KITCHEN_COLUMNS);
  if (error) throw new Error(`Loading orders for ${restaurantId} failed: ${error.message}`);
  return { orders: data.map((order) => ({ ...order, served_at: null })), canMarkServed: false };
}

/** Marks one of the restaurant's orders as served. Returns false if it isn't that restaurant's order. */
export async function markOrderServed(restaurantId: string, orderId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    const order = [...memory.filter(o => o.restaurant_id === restaurantId), ...sampleOrders(restaurantId)].find((o) => o.id === orderId);
    if (!order) return false;
    order.served_at ??= new Date().toISOString();
    return true;
  }

  const { data: existing, error: findError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (findError) throw new Error(`Finding order ${orderId} failed: ${findError.message}`);
  if (!existing) return false;

  // "is null" keeps the first served time if two kitchen screens tap at once.
  const { error } = await supabase
    .from("orders")
    .update({ served_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .is("served_at", null);
  if (error) throw new Error(`Marking order ${orderId} served failed: ${error.message}`);
  return true;
}

// Without Supabase there is nowhere to save orders, so the seed restaurant gets a
// few sample ones in memory and the dashboard can still be worked on.
const globalForSamples = globalThis as { sampleKitchenOrders?: KitchenOrder[] };

function sampleOrders(restaurantId: string): KitchenOrder[] {
  if (restaurantId !== SEED_RESTAURANT_ID) return [];
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  globalForSamples.sampleKitchenOrders ??= [
    {
      id: crypto.randomUUID(),
      mode: "table",
      table_number: "12",
      items: [
        { item_id: "chicken-satay", name: "Chicken Satay (10 sticks)", quantity: 2, price: 9, notes: "sauce on the side" },
        { item_id: "nasi-lemak", name: "Nasi Lemak", quantity: 1, price: 6.5 },
      ],
      notes: "Peanut allergy at the table",
      created_at: minutesAgo(1),
      served_at: null,
    },
    {
      id: crypto.randomUUID(),
      mode: "pickup",
      table_number: null,
      items: [{ item_id: "gado-gado", name: "Gado Gado", quantity: 1, price: 7.5, notes: "no egg" }],
      notes: null,
      created_at: minutesAgo(6),
      served_at: null,
    },
    {
      id: crypto.randomUUID(),
      mode: "table",
      table_number: "4",
      items: [{ item_id: "nasi-lemak", name: "Nasi Lemak", quantity: 3, price: 6.5 }],
      notes: null,
      created_at: minutesAgo(18),
      served_at: minutesAgo(9),
    },
  ];
  return globalForSamples.sampleKitchenOrders;
}

export type NewOrder = {
  diner_id?: string;
  restaurant_id: string;
  mode: Mode;
  table_number: string | null;
  items: OrderItem[];
  notes: string | null;
};

export type StoredOrder = NewOrder & { id: string; created_at: string; served_at: string | null };

// Without Supabase (local dev), orders live in memory until the server restarts.
// Kept on globalThis so Next's hot reload doesn't wipe them.
const memory = ((globalThis as { __orders?: StoredOrder[] }).__orders ??= []);

/** Saves an order and returns its id. */
export async function saveOrder(order: NewOrder): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn("Supabase isn't configured; keeping the order in memory.");
    const id = randomUUID();
    memory.unshift({ ...order, id, created_at: new Date().toISOString(), served_at: null });
    return id;
  }

  const { data, error } = await supabase.from("orders").insert(order).select("id").single();
  if (error) throw new Error(`Saving the order failed: ${error.message}`);
  return data.id as string;
}
