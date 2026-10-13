// The diner's cart: plain data plus pure functions, so the browser (text and voice
// agents, cart buttons) and the server (placing the order) share the same rules.
import { formatPrice, type Menu } from "./menu";

export type CartLine = {
  item_id: string;
  quantity: number;
  /** Per-item request, e.g. "no peanuts". Same item with different notes = separate lines. */
  notes: string | null;
};

export type Cart = CartLine[];

/** One line of a placed order, as stored in orders.items. */
export type OrderItem = {
  item_id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
};

export const MAX_QUANTITY = 20;
export const MAX_NOTES_LENGTH = 200;

type Result = { cart: Cart; error?: string };

/** Adds `quantity` of an item, merging into an existing line with the same notes. */
export function addToCart(
  cart: Cart,
  menu: Menu,
  { item_id, quantity, notes }: { item_id: string; quantity: number; notes?: string | null },
): Result {
  if (!menu.items.some((item) => item.id === item_id)) {
    return { cart, error: `No menu item has id "${item_id}". Use an id from the menu.` };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { cart, error: "Quantity must be a whole number of at least 1." };
  }
  const cleanNotes = normalizeNotes(notes);
  const index = cart.findIndex((line) => sameLine(line, item_id, cleanNotes));
  const current = index === -1 ? 0 : cart[index].quantity;
  if (current + quantity > MAX_QUANTITY) {
    return { cart, error: `At most ${MAX_QUANTITY} of one item per order.` };
  }
  if (index === -1) return { cart: [...cart, { item_id, quantity, notes: cleanNotes }] };
  return { cart: cart.map((line, i) => (i === index ? { ...line, quantity: current + quantity } : line)) };
}

/**
 * Removes `quantity` of an item (all of it when quantity is missing). When notes are
 * missing and the item is on several lines, removes from the line without notes first.
 */
export function removeFromCart(
  cart: Cart,
  { item_id, quantity, notes }: { item_id: string; quantity?: number | null; notes?: string | null },
): Result {
  const cleanNotes = normalizeNotes(notes);
  let index = cart.findIndex((line) => sameLine(line, item_id, cleanNotes));
  if (index === -1 && cleanNotes === null) index = cart.findIndex((line) => line.item_id === item_id);
  if (index === -1) return { cart, error: `"${item_id}" isn't in the cart.` };
  if (quantity != null && (!Number.isInteger(quantity) || quantity < 1)) {
    return { cart, error: "Quantity must be a whole number of at least 1." };
  }
  const remaining = quantity == null ? 0 : cart[index].quantity - quantity;
  if (remaining <= 0) return { cart: cart.filter((_, i) => i !== index) };
  return { cart: cart.map((line, i) => (i === index ? { ...line, quantity: remaining } : line)) };
}

/** Looks up names and prices from the menu; lines for unknown items are dropped. */
export function priceCart(cart: Cart, menu: Menu): OrderItem[] {
  return cart.flatMap((line) => {
    const item = menu.items.find((i) => i.id === line.item_id);
    if (!item) return [];
    const priced: OrderItem = { item_id: item.id, name: item.name, quantity: line.quantity, price: item.price };
    if (line.notes) priced.notes = line.notes;
    return [priced];
  });
}

export function orderTotal(items: OrderItem[]): number {
  return Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
}

export function cartCount(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

/** Short text version for the agent, e.g. "2× Laksa (no cockles) $16.00; total $16.00". */
export function describeCart(cart: Cart, menu: Menu): string {
  const items = priceCart(cart, menu);
  if (items.length === 0) return "The cart is empty.";
  const lines = items.map(
    (i) => `${i.quantity}× ${i.name} [${i.item_id}]${i.notes ? ` (${i.notes})` : ""} ${formatPrice(i.price * i.quantity, menu.currency)}`,
  );
  return `${lines.join("; ")}. Total ${formatPrice(orderTotal(items), menu.currency)}.`;
}

export function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = (notes ?? "").trim().slice(0, MAX_NOTES_LENGTH);
  return trimmed === "" ? null : trimmed;
}

function sameLine(line: CartLine, item_id: string, notes: string | null): boolean {
  return line.item_id === item_id && (line.notes ?? "").toLowerCase() === (notes ?? "").toLowerCase();
}
