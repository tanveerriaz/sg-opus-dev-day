// The agent's tool list, defined once. The text chat (#2) sends it to Claude and voice (#6)
// will send it to its realtime session; both run the calls with runTool in the browser,
// so the cart behaves the same either way. Memory (#5) adds save_preference here.
// Each tool is a name, description and JSON Schema; toClaudeTools() adapts them for the
// Claude API, and a voice adapter can map the same list to its own format.
import { addToCart, describeCart, normalizeNotes, removeFromCart, type Cart } from "../cart";
import type { Menu } from "../menu";

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "add_to_cart",
    description:
      "Add a menu item to the diner's cart. Call it once per distinct item (and once per distinct request, e.g. one laksa with no cockles and one without).",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "The item's id from the menu, never its name." },
        quantity: { type: "integer", minimum: 1, description: "How many to add." },
        notes: {
          type: "string",
          description: "The diner's request for this item, e.g. 'no peanuts', 'less spicy'. Omit if none.",
        },
      },
      required: ["item_id", "quantity"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_from_cart",
    description: "Remove some or all of an item from the diner's cart.",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "The item's id from the menu." },
        quantity: { type: "integer", minimum: 1, description: "How many to remove. Omit to remove all of them." },
        notes: { type: "string", description: "The notes of the line to change, if the item is on several lines." },
      },
      required: ["item_id"],
      additionalProperties: false,
    },
  },
  {
    name: "place_order",
    description:
      "Show the order summary on the diner's screen so they can confirm it. Only call this after you've read the order back and the diner said yes. The order is placed when they tap Confirm.",
    parameters: {
      type: "object",
      properties: {
        notes: { type: "string", description: "Notes for the whole order, e.g. 'bring the drinks first'. Omit if none." },
      },
      additionalProperties: false,
    },
  },
];

/** The tool list in the Claude Messages API format. */
export function toClaudeTools(): { name: string; description: string; input_schema: { type: "object"; [key: string]: unknown } }[] {
  return AGENT_TOOLS.map(({ name, description, parameters }) => ({
    name,
    description,
    input_schema: { ...parameters, type: "object" },
  }));
}

/** The tool list in the OpenAI Realtime session format, for the voice agent. */
export function toRealtimeTools(): { type: "function"; name: string; description: string; parameters: Record<string, unknown> }[] {
  return AGENT_TOOLS.map((tool) => ({ type: "function", ...tool }));
}

export type ToolState = { cart: Cart; menu: Menu };

export type ToolOutcome = {
  cart: Cart;
  /** Sent back to the model as the tool's result. */
  output: string;
  /** Short text for the chat transcript, e.g. "Added 2× Laksa". */
  event?: string;
  /** True when the call failed; reported to the model as an error result. */
  isError?: boolean;
  /** Set by place_order: the UI shows the confirmation sheet. */
  review?: { notes: string | null };
};

/**
 * Runs one tool call against the current cart. `input` is the parsed arguments object.
 * Never throws: errors go back to the model.
 */
export function runTool(name: string, input: unknown, { cart, menu }: ToolState): ToolOutcome {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { cart, output: fail("The arguments must be an object."), isError: true };
  }
  const args = input as Record<string, unknown>;
  const itemName = (id: unknown) => menu.items.find((i) => i.id === id)?.name ?? String(id);

  switch (name) {
    case "add_to_cart": {
      const quantity = Number(args.quantity);
      const result = addToCart(cart, menu, {
        item_id: String(args.item_id),
        quantity,
        notes: optionalString(args.notes),
      });
      if (result.error) return { cart, output: fail(result.error), isError: true };
      return {
        cart: result.cart,
        output: ok(result.cart, menu),
        event: `Added ${quantity}× ${itemName(args.item_id)}`,
      };
    }
    case "remove_from_cart": {
      const quantity = args.quantity == null ? null : Number(args.quantity);
      const result = removeFromCart(cart, {
        item_id: String(args.item_id),
        quantity,
        notes: optionalString(args.notes),
      });
      if (result.error) return { cart, output: fail(result.error), isError: true };
      return {
        cart: result.cart,
        output: ok(result.cart, menu),
        event: `Removed ${quantity == null ? "" : `${quantity}× `}${itemName(args.item_id)}`,
      };
    }
    case "place_order": {
      if (cart.length === 0) return { cart, output: fail("The cart is empty, so there's nothing to order."), isError: true };
      return {
        cart,
        output: JSON.stringify({
          ok: true,
          status: "The order summary is on the diner's screen. It's placed when they tap Confirm; you'll be told when.",
        }),
        review: { notes: normalizeNotes(optionalString(args.notes)) },
      };
    }
    default:
      return { cart, output: fail(`There is no tool called "${name}".`), isError: true };
  }
}

function ok(cart: Cart, menu: Menu): string {
  return JSON.stringify({ ok: true, cart: describeCart(cart, menu) });
}

function fail(error: string): string {
  return JSON.stringify({ ok: false, error });
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
