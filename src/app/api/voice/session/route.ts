// Starts a voice conversation (#6). The phone talks to OpenAI Realtime directly over WebRTC,
// so this route makes a short-lived key for it; the real API key stays on the server.
// The session gets the same instructions and tool list as the text agent.
import { buildVoiceInstructions } from "@/lib/agent/instructions";
import type { VoiceSessionResponse } from "@/lib/agent/protocol";
import { toRealtimeTools } from "@/lib/agent/tools";
import { BadRequest, readBody, readMode, readString, readTable } from "@/lib/requests";
import { getRestaurant } from "@/lib/restaurants";

const MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
const VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";
/** How long the phone has to connect with the key. The conversation itself can run longer. */
const KEY_LIFETIME_SECONDS = 60;

export async function POST(request: Request): Promise<Response> {
  let body;
  try {
    const raw = await readBody(request);
    body = {
      restaurantId: readString(raw.restaurantId, "restaurant", 100),
      mode: readMode(raw.mode),
      table: readTable(raw.table),
    };
  } catch (err) {
    if (err instanceof BadRequest) return reply({ error: err.message }, 400);
    throw err;
  }
  if (body.mode === "delivery") return reply({ error: "Delivery is coming soon." }, 400);

  const restaurant = await getRestaurant(body.restaurantId);
  if (!restaurant) return reply({ error: "Restaurant not found." }, 404);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Voice was requested but OPENAI_API_KEY is missing on the server.");
    return reply({ error: "Voice isn't set up yet. You can keep typing." }, 503);
  }

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: KEY_LIFETIME_SECONDS },
        session: {
          type: "realtime",
          model: MODEL,
          instructions: buildVoiceInstructions(restaurant, { mode: body.mode, table: body.table }),
          tools: toRealtimeTools(),
          tool_choice: "auto",
          audio: {
            input: {
              // Transcripts of what the diner said, shown in the chat.
              transcription: { model: "gpt-4o-mini-transcribe" },
              turn_detection: { type: "semantic_vad" },
              noise_reduction: { type: "near_field" },
            },
            output: { voice: VOICE },
          },
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || typeof data?.value !== "string") {
      console.error(`OpenAI refused the voice session (${res.status}):`, data?.error?.message ?? data);
      return reply({ error: "Voice couldn't start just now. You can keep typing." }, 502);
    }
    return reply({ clientSecret: data.value });
  } catch (err) {
    console.error("Voice session request failed:", err instanceof Error ? err.message : err);
    return reply({ error: "Voice couldn't start just now. You can keep typing." }, 502);
  }
}

function reply(body: VoiceSessionResponse, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
