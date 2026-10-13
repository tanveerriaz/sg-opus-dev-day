"use client";
// The voice agent in the browser: the phone connects to OpenAI Realtime over WebRTC with a
// short-lived key from /api/voice/session. Tool calls run here with the shared runTool, the
// same as the text agent's, so the cart and the order summary behave identically.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Cart } from "@/lib/cart";
import { screenNote } from "@/lib/agent/instructions";
import type { VoiceSessionResponse } from "@/lib/agent/protocol";
import { runTool, type ToolOutcome } from "@/lib/agent/tools";
import type { DinerContext, Menu } from "@/lib/menu";
import type { TranscriptEntry } from "./useTextAgent";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type VoiceState = "off" | "connecting" | "live";

type Options = {
  onPreference: (p:{kind:string;value:string})=>Promise<string>;
  restaurantId: string;
  context: DinerContext;
  menu: Menu;
  cartRef: RefObject<Cart>;
  setCart: (cart: Cart) => void;
  onReview: (review: NonNullable<ToolOutcome["review"]>) => void;
  /** The chat transcript's writers, so spoken turns appear in the same conversation. */
  show: (kind: TranscriptEntry["kind"], text: string) => number;
  revise: (id: number, text: string) => void;
  /** Called when a live conversation ends, however it ends. */
  onEnded: () => void;
};

type Session = {
  pc?: RTCPeerConnection;
  channel?: RTCDataChannel;
  mic?: MediaStream;
  speaker?: HTMLAudioElement;
  live: boolean;
};

/** A failure with a message that's fine to show the diner. */
class VoiceError extends Error {}

// The few Realtime server events this hook uses.
type RealtimeEvent = {
  type: string;
  item_id?: string;
  transcript?: string;
  error?: { message?: string };
  response?: { output?: { type: string; status?: string; name?: string; call_id?: string; arguments?: string }[] };
};

export function useVoiceAgent({ restaurantId, context, menu, cartRef, setCart, onReview, onPreference, show, revise, onEnded }: Options) {
  const [state, setState] = useState<VoiceState>("off");
  const session = useRef<Session | null>(null);
  // The cart as the agent last saw it, to tell it about changes the diner makes by hand.
  const knownCart = useRef("");
  // Chat entries waiting for their transcript, by Realtime item id.
  const spoken = useRef(new Map<string, number>());

  const send = useCallback((event: Record<string, unknown>) => {
    const channel = session.current?.channel;
    if (channel?.readyState === "open") channel.send(JSON.stringify(event));
  }, []);

  /** Sends the agent a [Screen] line, the voice counterpart of the text agent's. */
  const sendScreenNote = useCallback(
    (events: string[], speak: boolean) => {
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: screenNote(cartRef.current, menu, events) }],
        },
      });
      knownCart.current = JSON.stringify(cartRef.current);
      if (speak) send({ type: "response.create" });
    },
    [cartRef, menu, send],
  );

  const end = useCallback(
    (error?: string) => {
      const ended = session.current;
      if (!ended) return;
      session.current = null;
      release(ended);
      spoken.current.clear();
      setState("off");
      if (error) show("error", error);
      if (ended.live) onEnded();
    },
    [onEnded, show],
  );

  const handle = useCallback(
    async (event: RealtimeEvent) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          // Lands in the conversation just before what the diner is about to say.
          if (JSON.stringify(cartRef.current) !== knownCart.current) sendScreenNote([], false);
          break;
        case "input_audio_buffer.committed":
          // Holds the diner's place in the chat until the transcript arrives.
          if (event.item_id) spoken.current.set(event.item_id, show("user", "…"));
          break;
        case "conversation.item.input_audio_transcription.completed":
        case "conversation.item.input_audio_transcription.failed": {
          const text = event.transcript?.trim() || "(couldn't make that out)";
          const entry = event.item_id === undefined ? undefined : spoken.current.get(event.item_id);
          if (entry === undefined) show("user", text);
          else revise(entry, text);
          if (event.item_id) spoken.current.delete(event.item_id);
          break;
        }
        case "response.output_audio_transcript.done":
          if (event.transcript?.trim()) show("agent", event.transcript.trim());
          break;
        case "response.done": {
          // Run every finished tool call in the reply, then let the agent carry on.
          const calls = (event.response?.output ?? []).filter(
            (item) => item.type === "function_call" && item.status !== "incomplete" && item.call_id,
          );
          for (const call of calls) {
            let input: unknown = null;
            try {
              input = JSON.parse(call.arguments || "{}");
            } catch {}
            const outcome = runTool(call.name ?? "", input, { cart: cartRef.current, menu });
            if(outcome.preference) outcome.output = await onPreference(outcome.preference);
            cartRef.current = outcome.cart;
            setCart(outcome.cart);
            send({
              type: "conversation.item.create",
              item: { type: "function_call_output", call_id: call.call_id, output: outcome.output },
            });
            if (outcome.event) show("event", outcome.event);
            if (outcome.review) onReview(outcome.review);
          }
          if (calls.length > 0) {
            knownCart.current = JSON.stringify(cartRef.current);
            send({ type: "response.create" });
          }
          break;
        }
        case "error":
          console.warn("Realtime voice error:", event.error?.message ?? event);
          break;
      }
    },
    [onPreference, cartRef, menu, onReview, revise, send, sendScreenNote, setCart, show],
  );

  /** Starts a voice conversation. Call it from a tap, so the browser allows the microphone and sound. */
  const start = useCallback(async () => {
    if (session.current) return;
    const mine: Session = { live: false };
    session.current = mine;
    setState("connecting");
    const stillMine = () => session.current === mine;

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        throw new VoiceError("This browser can't do voice. You can keep typing.");
      }
      mine.mic = await navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .catch(() => {
          throw new VoiceError("The microphone is blocked. Allow it in your browser settings, or keep typing.");
        });
      if (!stillMine()) return release(mine);

      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, ...context }),
      });
      const data = (await res.json().catch(() => ({ error: "Voice couldn't start just now. You can keep typing." }))) as VoiceSessionResponse;
      if ("error" in data) throw new VoiceError(data.error);
      if (!stillMine()) return release(mine);

      const pc = (mine.pc = new RTCPeerConnection());
      const speaker = (mine.speaker = new Audio());
      speaker.autoplay = true;
      pc.ontrack = (e) => {
        speaker.srcObject = e.streams[0];
        speaker.play().catch(() => {});
      };
      for (const track of mine.mic.getTracks()) pc.addTrack(track, mine.mic);

      const channel = (mine.channel = pc.createDataChannel("oai-events"));
      channel.onmessage = (e) => {
        if (stillMine()) handle(JSON.parse(e.data));
      };
      channel.onopen = () => {
        if (!stillMine()) return;
        mine.live = true;
        setState("live");
        sendScreenNote(["The diner switched from typing to talking."], false);
      };
      channel.onclose = () => {
        if (stillMine()) end("Voice disconnected. You can keep ordering by typing.");
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" && stillMine()) end("Voice disconnected. You can keep ordering by typing.");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const answer = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${data.clientSecret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!answer.ok) throw new Error(`Realtime call failed with ${answer.status}`);
      const sdp = await answer.text();
      if (!stillMine()) return;
      await pc.setRemoteDescription({ type: "answer", sdp });
    } catch (err) {
      if (!(err instanceof VoiceError)) console.error("Starting voice failed:", err);
      if (stillMine()) end(err instanceof VoiceError ? err.message : "Voice couldn't start just now. You can keep typing.");
    }
  }, [context, end, handle, restaurantId, sendScreenNote]);

  const stop = useCallback(() => end(), [end]);

  /** Tells the agent about something that happened on screen; it answers out loud. */
  const notify = useCallback(
    (event: string) => {
      if (session.current?.live) sendScreenNote([event], true);
    },
    [sendScreenNote],
  );

  // Hang up if the diner leaves the page.
  useEffect(
    () => () => {
      if (session.current) release(session.current);
      session.current = null;
    },
    [],
  );

  return { state, start, stop, notify };
}

function release({ pc, channel, mic, speaker }: Session) {
  if (channel) channel.onclose = null;
  channel?.close();
  pc?.close();
  mic?.getTracks().forEach((track) => track.stop());
  if (speaker) {
    speaker.pause();
    speaker.srcObject = null;
  }
}
