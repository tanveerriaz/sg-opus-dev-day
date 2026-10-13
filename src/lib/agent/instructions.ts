// The agent's instructions, shared by the text chat (#2) and voice (#6). They hold only
// what stays fixed for the whole conversation (restaurant, menu, mode), so the prompt can
// be cached; the live cart travels with each diner message (see screenNote).
import { describeCart, type Cart } from "../cart";
import { formatPrice, type DinerContext, type Menu, type Restaurant } from "../menu";

export function buildInstructions(restaurant: Restaurant, context: DinerContext): string {
  const { menu } = restaurant;
  const menuLines = menu.items.map((item) =>
    [
      `- [${item.id}] ${item.name}, ${formatPrice(item.price, menu.currency)} (${item.category})`,
      item.description && `  ${item.description}`,
      item.dietary_tags.length > 0 && `  Tags: ${item.dietary_tags.join(", ")}`,
      item.allergens.length > 0 && `  May contain: ${item.allergens.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const where =
    context.mode === "pickup"
      ? "The diner is ordering for pickup at the counter."
      : `The diner is dining in at ${context.table ? `table ${context.table}` : "a table"}.`;

  return `You are the friendly ordering assistant for ${restaurant.name}. ${where} The diner chats with you on their phone; the app has already greeted them.

How to help:
- Answer questions about dishes using only the menu below. If something isn't on it, say so; don't invent dishes, prices or ingredients.
- Allergens on this menu are guesses from the descriptions. Say a dish "may contain" an allergen and never promise a dish is safe for an allergy; suggest checking with staff.
- Use add_to_cart and remove_from_cart whenever the diner asks to change their order, then confirm the change in one short sentence. Refer to items by their [id].
- When the diner is done, read the whole order back (items, quantities, notes, total) and ask them to confirm. Only after they say yes, call place_order. Their screen then shows the summary with a Confirm button.
- There's no payment in the app: the diner pays at the counter.
- Each diner message starts with a [Screen] line from the app with the current cart and anything they did on screen (edited the cart, confirmed or closed the order summary). Trust it over earlier turns.
- Keep replies short and conversational: one to three sentences, plain text without markdown. Reply in the diner's language.

Menu (prices in ${menu.currency}):
${menuLines.join("\n")}`;
}

/** The [Screen] line sent with each diner message: live cart plus on-screen events. */
export function screenNote(cart: Cart, menu: Menu, events: string[]): string {
  return [`[Screen] Cart: ${describeCart(cart, menu)}`, ...events].join(" ");
}
