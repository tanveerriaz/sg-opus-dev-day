// One turn of the text agent. The browser sends the conversation; this asks Claude for the
// next message and returns its text and/or tool calls. Tools run in the browser (see
// src/lib/agent/tools.ts), which then calls this route again with the results.
import { memoryInstructions } from "@/lib/diner-profile";
import { openAIChat } from "@/lib/agent/openai-chat";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlock, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { buildInstructions } from "@/lib/agent/instructions";
import type { AgentBlock, ChatMessage, ChatResponse } from "@/lib/agent/protocol";
import { toClaudeTools } from "@/lib/agent/tools";
import { BadRequest, readBody, readMode, readString, readTable } from "@/lib/requests";
import { getRestaurant } from "@/lib/restaurants";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const MAX_HISTORY_MESSAGES = 80;
const MAX_USER_MESSAGE = 1500; // the diner's text plus the [Screen] line
const MAX_BLOCK_TEXT = 4000;
const MAX_THINKING = 100_000; // opaque thinking blocks and their signatures
const MAX_BODY_BYTES = 600_000;

let claude: Anthropic | null = null;

export async function POST(request: Request): Promise<Response> {
  let body;
  try {
    const raw = await readBody(request, MAX_BODY_BYTES);
    body = {
      restaurantId: readString(raw.restaurantId, "restaurant", 100),
      mode: readMode(raw.mode),
      table: readTable(raw.table),
      history: readHistory(raw.history),
    };
  } catch (err) {
    if (err instanceof BadRequest) return reply({ error: err.message }, 400);
    throw err;
  }
  if (body.mode === "delivery") return reply({ error: "Delivery is coming soon." }, 400);

  const restaurant = await getRestaurant(body.restaurantId);
  if (!restaurant) return reply({ error: "Restaurant not found." }, 404);

  try {
    const instructions = buildInstructions(restaurant, { mode: body.mode, table: body.table }) + await memoryInstructions();
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return reply({content: await openAIChat(body.history, instructions)});
    // Reads ANTHROPIC_API_KEY (or another credential source the SDK supports).
    claude ??= new Anthropic();
    const response = await claude.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Ordering chat is simple: low effort keeps replies quick and cheap.
      output_config: { effort: "low" },
      // If a safety classifier declines, the API retries on Anthropic's recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Tools and the menu prompt are the same every turn, so cache them.
      cache_control: { type: "ephemeral" },
      system: instructions,
      tools: toClaudeTools(),
      messages: body.history as BetaMessageParam[],
    });

    if (response.stop_reason === "refusal") {
      return reply({ error: "Sorry, the agent can't help with that. Try asking about the menu or your order." }, 200);
    }
    return reply({ content: keepBlocks(response.content) });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Claude rejected the API key.");
      return reply({ error: "The agent isn't set up correctly: the Claude API key was rejected." }, 503);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return reply({ error: "The agent is busy right now. Try again in a moment." }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Claude API error ${err.status}:`, err.message);
    } else if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      // A failure before any API response, with no key set: the SDK found no credentials.
      console.error("Claude client setup failed:", err instanceof Error ? err.message : err);
      return reply({ error: "The agent isn't set up yet: ANTHROPIC_API_KEY is missing on the server." }, 503);
    } else {
      console.error("Claude request failed:", err instanceof Error ? err.message : err);
    }
    return reply({ error: "The agent couldn't answer just now. Try again." }, 502);
  }
}

/**
 * Keeps the blocks the browser stores in the history. After a server-side fallback,
 * only text survives from before the last fallback marker (the API's echo rule).
 */
function keepBlocks(content: BetaContentBlock[]): AgentBlock[] {
  const lastFallback = content.findLastIndex((block) => block.type === "fallback");
  const kept: AgentBlock[] = [];
  content.forEach((block, i) => {
    if (block.type === "text") kept.push({ type: "text", text: block.text });
    if (i < lastFallback) return;
    if (block.type === "tool_use") kept.push({ type: "tool_use", id: block.id, name: block.name, input: block.input });
    if (block.type === "thinking") kept.push({ type: "thinking", thinking: block.thinking, signature: block.signature });
    if (block.type === "redacted_thinking") kept.push({ type: "redacted_thinking", data: block.data });
  });
  return kept;
}

/** Checks every message's shape and size; anything else is rejected. */
function readHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_HISTORY_MESSAGES) {
    throw new BadRequest("Invalid history.");
  }
  if (value[0]?.role !== "user") throw new BadRequest("The conversation must start with the diner.");
  return value.map((message): ChatMessage => {
    if (message?.role === "user") {
      if (typeof message.content === "string") {
        return { role: "user", content: readString(message.content, "message", MAX_USER_MESSAGE) };
      }
      if (!Array.isArray(message.content) || message.content.length === 0) throw new BadRequest("Invalid message.");
      return { role: "user", content: message.content.map(readUserBlock) };
    }
    if (message?.role === "assistant") {
      if (!Array.isArray(message.content) || message.content.length === 0) throw new BadRequest("Invalid message.");
      return { role: "assistant", content: message.content.map(readAgentBlock) };
    }
    throw new BadRequest("Invalid message role.");
  });
}

function readUserBlock(block: Record<string, unknown>) {
  if (block?.type === "text") return { type: "text" as const, text: readString(block.text, "message", MAX_USER_MESSAGE) };
  if (block?.type === "tool_result") {
    return {
      type: "tool_result" as const,
      tool_use_id: readString(block.tool_use_id, "tool id", 200),
      content: readString(block.content, "tool result", MAX_BLOCK_TEXT),
      ...(block.is_error === true ? { is_error: true } : {}),
    };
  }
  throw new BadRequest("Invalid message block.");
}

function readAgentBlock(block: Record<string, unknown>): AgentBlock {
  switch (block?.type) {
    case "text":
      return { type: "text", text: readString(block.text, "reply", MAX_BLOCK_TEXT) };
    case "tool_use":
      if (!block.input || typeof block.input !== "object" || JSON.stringify(block.input).length > MAX_BLOCK_TEXT) {
        throw new BadRequest("Invalid tool call.");
      }
      return {
        type: "tool_use",
        id: readString(block.id, "tool id", 200),
        name: readString(block.name, "tool name", 100),
        input: block.input,
      };
    case "thinking":
      return {
        type: "thinking",
        thinking: readString(block.thinking, "thinking", MAX_THINKING),
        signature: readString(block.signature, "signature", MAX_THINKING),
      };
    case "redacted_thinking":
      return { type: "redacted_thinking", data: readString(block.data, "thinking", MAX_THINKING) };
    default:
      throw new BadRequest("Invalid reply block.");
  }
}

function reply(body: ChatResponse, status = 200): Response {
  return Response.json(body, { status });
}
