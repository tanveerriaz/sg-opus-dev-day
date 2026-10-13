"use client";
import { useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "./useTextAgent";

const SUGGESTIONS = ["What do you recommend?", "Anything vegetarian?", "Which dishes have peanuts?"];

type Props = {
  transcript: TranscriptEntry[];
  busy: boolean;
  onSend: (text: string) => void;
  /** e.g. "3 items · $21.00", shown above the input while the cart isn't empty. */
  cartSummary: string | null;
  onOpenCart: () => void;
};

export function ChatPanel({ transcript, busy, onSend, cartSummary, onOpenCart }: Props) {
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
        {transcript.length === 1 && !busy && (
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
      </form>
    </div>
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
