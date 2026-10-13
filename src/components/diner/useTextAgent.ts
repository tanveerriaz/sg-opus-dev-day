"use client";
// The text agent's loop in the browser: send the conversation to /api/chat, run any tool
// calls with the shared runTool, send the results back, repeat until the agent answers.
import { useCallback, useRef, useState, type RefObject } from "react";
import type { Cart } from "@/lib/cart";
import { screenNote } from "@/lib/agent/instructions";
import type { ChatMessage, ChatResponse, ToolResultBlock } from "@/lib/agent/protocol";
import { runTool, type ToolOutcome } from "@/lib/agent/tools";
import type { DinerContext, Menu } from "@/lib/menu";

/** Tool round-trips allowed per diner message, so a confused model can't loop forever. */
const MAX_ROUNDS = 6;

export type TranscriptEntry = { id: number; kind: "user" | "agent" | "event" | "error"; text: string };

type Options = {
  onPreference: (p:{kind:string;value:string})=>Promise<string>;
  restaurantId: string;
  restaurantName: string;
  context: DinerContext;
  menu: Menu;
  /** Always the latest cart, also when the diner edits it by hand between turns. */
  cartRef: RefObject<Cart>;
  setCart: (cart: Cart) => void;
  onReview: (review: NonNullable<ToolOutcome["review"]>) => void;
};

export function useTextAgent({ restaurantId, restaurantName, context, menu, cartRef, setCart, onReview, onPreference }: Options) {
  // The greeting is shown only; the instructions tell the agent it already greeted.
  const greeting = `Hi! Welcome to ${restaurantName}. Ask me about the menu, or tell me what you'd like to order.`;
  // Append-only: earlier messages are never edited, which the API requires for thinking blocks.
  const history = useRef<ChatMessage[]>([]);
  // On-screen events (order confirmed, summary closed) to tell the agent with the next message.
  const pendingEvents = useRef<string[]>([]);
  const nextId = useRef(1);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([{ id: 0, kind: "agent", text: greeting }]);
  const [busy, setBusy] = useState(false);

  const show = useCallback((kind: TranscriptEntry["kind"], text: string) => {
    const id = nextId.current++;
    setTranscript((t) => [...t, { id, kind, text }]);
    return id;
  }, []);

  /** Replaces an entry's text, e.g. once the diner's speech has been transcribed. */
  const revise = useCallback((id: number, text: string) => {
    setTranscript((t) => t.map((entry) => (entry.id === id ? { ...entry, text } : entry)));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setBusy(true);
      show("user", message);
      history.current.push({
        role: "user",
        content: [
          { type: "text", text: screenNote(cartRef.current, menu, pendingEvents.current) },
          { type: "text", text: message },
        ],
      });
      pendingEvents.current = [];

      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId, ...context, history: history.current }),
          });
          const data = (await res.json().catch(() => ({ error: "The agent couldn't answer just now." }))) as ChatResponse;
          if ("error" in data) {
            show("error", data.error);
            return;
          }
          if (data.content.length === 0) return;

          // Run every tool call in the reply, then send all results back in one message.
          const results: ToolResultBlock[] = [];
          for (const block of data.content) {
            if (block.type === "text") {
              show("agent", block.text);
            } else if (block.type === "tool_use") {
              const outcome = runTool(block.name, block.input, { cart: cartRef.current, menu });
              if(outcome.preference) outcome.output = await onPreference(outcome.preference);
              cartRef.current = outcome.cart;
              setCart(outcome.cart);
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: outcome.output,
                ...(outcome.isError ? { is_error: true } : {}),
              });
              if (outcome.event) show("event", outcome.event);
              if (outcome.review) onReview(outcome.review);
            }
          }
          // The reply and its tool results are added together, so the history never has a
          // tool call without its result (the API rejects that).
          history.current.push({ role: "assistant", content: data.content });
          if (results.length === 0) return;
          history.current.push({ role: "user", content: results });
        }
      } catch {
        show("error", "Couldn't reach the agent. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [onPreference, busy, cartRef, context, menu, onReview, restaurantId, setCart, show],
  );

  /** Tells the agent about something that happened on screen, with the diner's next message. */
  const notify = useCallback((event: string) => {
    pendingEvents.current.push(event);
  }, []);

  return { transcript, busy, send, notify, show, revise };
}
