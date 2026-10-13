// Request/response shapes of /api/chat and /api/orders, shared by the browser and the server.
import type { Cart, OrderItem } from "../cart";
import type { Mode } from "../menu";

/**
 * One block of the agent's reply, in the Claude Messages API format. Thinking blocks are
 * opaque: the browser stores them and sends them back unchanged, as the API requires.
 */
export type AgentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "redacted_thinking"; data: string };

export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

/**
 * One conversation message. The browser keeps the history, only ever appends to it,
 * and sends it every turn, so the server stays stateless.
 */
export type ChatMessage =
  | { role: "user"; content: string | ({ type: "text"; text: string } | ToolResultBlock)[] }
  | { role: "assistant"; content: AgentBlock[] };

export type ChatRequest = {
  restaurantId: string;
  mode: Mode;
  table: string | null;
  history: ChatMessage[];
};

/** The agent's next message: text and/or tool calls for the browser to run. */
export type ChatResponse = { content: AgentBlock[] } | { error: string };

export type OrderRequest = {
  restaurantId: string;
  mode: Mode;
  table: string | null;
  cart: Cart;
  notes: string | null;
};

export type PlacedOrder = {
  id: string;
  items: OrderItem[];
  total: number;
  notes: string | null;
  table: string | null;
  mode: Mode;
};

export type OrderResponse = { order: PlacedOrder } | { error: string };
