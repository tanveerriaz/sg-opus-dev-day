// Places an order after the diner taps Confirm. Names and prices come from the menu on
// the server, never from the browser.
import { orderTotal, priceCart } from "@/lib/cart";
import type { OrderResponse } from "@/lib/agent/protocol";
import { saveOrder } from "@/lib/orders";
import { BadRequest, readBody, readCart, readMode, readNotes, readString, readTable } from "@/lib/requests";
import { getRestaurant } from "@/lib/restaurants";

export async function POST(request: Request): Promise<Response> {
  let body;
  try {
    const raw = await readBody(request);
    body = {
      restaurantId: readString(raw.restaurantId, "restaurant", 100),
      mode: readMode(raw.mode),
      table: readTable(raw.table),
      cart: readCart(raw.cart),
      notes: readNotes(raw.notes),
    };
  } catch (err) {
    if (err instanceof BadRequest) return reply({ error: err.message }, 400);
    throw err;
  }
  if (body.mode === "delivery") return reply({ error: "Delivery is coming soon." }, 400);

  const restaurant = await getRestaurant(body.restaurantId);
  if (!restaurant) return reply({ error: "Restaurant not found." }, 404);

  const items = priceCart(body.cart, restaurant.menu);
  if (items.length !== body.cart.length) return reply({ error: "Some items are no longer on the menu." }, 400);
  if (items.length === 0) return reply({ error: "The cart is empty." }, 400);

  const table = body.mode === "table" ? body.table : null;
  const notes = body.notes?.trim() || null;
  try {
    const id = await saveOrder({ restaurant_id: restaurant.id, mode: body.mode, table_number: table, items, notes });
    return reply({ order: { id, items, total: orderTotal(items), notes, table, mode: body.mode } });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return reply({ error: "The order couldn't be saved. Try again." }, 500);
  }
}

function reply(body: OrderResponse, status = 200): Response {
  return Response.json(body, { status });
}
