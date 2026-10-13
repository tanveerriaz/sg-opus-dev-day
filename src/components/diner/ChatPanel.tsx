"use client";
import { useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "./useTextAgent";
import type { VoiceState } from "./useVoiceAgent";

const SUGGESTIONS = ["What do you recommend?", "Anything vegetarian?", "Which dishes have peanuts?"];

type Props = {
  transcript: TranscriptEntry[];
  busy: boolean;
  onSend: (text: string) => void;
  /** e.g. "3 items · $21.00", shown above the input while the cart isn't empty. */
  cartSummary: string | null;
  onOpenCart: () => void;
  voice: { state: VoiceState; onStart: () => void; onStop: () => void };
};

export function ChatPanel({ transcript, busy, onSend, cartSummary, onOpenCart, voice }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [transcript, busy]);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {transcript.map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
        {busy && <p className="text-sm text-stone-500">Thinking…</p>}
        {transcript.length === 1 && !busy && voice.state === "off" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {cartSummary && (
        <button
          type="button"
          onClick={onOpenCart}
          className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-stone-200 px-3 py-2 text-sm"
        >
          <span className="tabular-nums">Cart: {cartSummary}</span>
          <span className="font-medium">View cart</span>
        </button>
      )}

      {voice.state === "live" ? (
        <div className="flex items-center gap-3 border-t border-stone-200 bg-white px-4 py-3">
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden />
          <p className="min-w-0 flex-1 text-stone-700" role="status">
            Listening. Just talk.
          </p>
          <button type="button" onClick={voice.onStop} className="rounded-full border border-stone-300 px-4 py-2 font-medium">
            Type instead
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
          className="flex gap-2 border-t border-stone-200 bg-white px-4 py-3"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask or order, e.g. two laksa please"
            maxLength={1000}
            aria-label="Message the agent"
            className="min-w-0 flex-1 rounded-full border border-stone-300 px-4 py-2 outline-none focus:border-stone-500"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="rounded-full bg-stone-900 px-4 py-2 font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
          <button
            type="button"
            onClick={voice.onStart}
            disabled={busy || voice.state === "connecting"}
            aria-label="Talk to the agent"
            className="rounded-full border border-stone-300 p-2.5 disabled:opacity-40"
          >
            <MicIcon pulsing={voice.state === "connecting"} />
          </button>
        </form>
      )}
    </div>
  );
}

function MicIcon({ pulsing }: { pulsing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${pulsing ? "animate-pulse" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function Entry({ entry }: { entry: TranscriptEntry }) {
  switch (entry.kind) {
    case "user":
      return (
        <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-stone-900 px-3 py-2 text-white">
          {entry.text}
        </p>
      );
    case "agent":
      return (
        <p className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3 py-2 shadow-sm">
          {entry.text}
        </p>
      );
    case "event":
      return (
        <p className="mx-auto w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">{entry.text}</p>
      );
    case "error":
      return <p className="text-sm text-red-700">{entry.text}</p>;
  }
}
