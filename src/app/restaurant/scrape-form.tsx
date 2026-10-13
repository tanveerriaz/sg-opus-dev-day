"use client";

import { useState } from "react";
import type { ScrapeEvent } from "@/lib/scrape/events";
import { QrCard } from "./qr-card";

type Done = Extract<ScrapeEvent, { type: "done" }>;
type State =
  | { status: "idle" }
  | { status: "running"; steps: string[] }
  | { status: "done"; steps: string[]; result: Done }
  | { status: "error"; steps: string[]; message: string };

export function ScrapeForm() {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<"website" | "photos">("website");
  const [photos, setPhotos] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function scrape(event: React.FormEvent) {
    event.preventDefault();
    const steps: string[] = [];
    setState({ status: "running", steps });

    try {
      let body: FormData | string;
      if (source === "photos") {
        if (!photos.length || photos.length > 8) throw new Error("Choose 1–8 menu photos.");
        if (photos.reduce((sum, file) => sum + file.size, 0) > 3 * 1024 * 1024) throw new Error("Photos must total 3 MB or less. Try smaller photos or fewer pages.");
        body = new FormData();
        body.set("name", name);
        photos.forEach((photo) => (body as FormData).append("photos", photo));
      } else body = JSON.stringify({ url });
      const res = await fetch("/api/scrape", {
        method: "POST",
        ...(source === "website" ? { headers: { "Content-Type": "application/json" } } : {}),
        body,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status}).`);
      }

      // The route streams one JSON event per line.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let terminal = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as ScrapeEvent;
          if (event.type === "step") {
            steps.push(event.message);
            setState({ status: "running", steps: [...steps] });
          } else if (event.type === "done") {
            terminal = true;
            setState({ status: "done", steps: [...steps, "QR ready"], result: event });
          } else {
            terminal = true;
            setState({ status: "error", steps: [...steps], message: event.message });
          }
        }
      }
      if (!terminal) throw new Error("The connection ended before the menu was ready. Please retry.");
    } catch (err) {
      setState({ status: "error", steps, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const running = state.status === "running";

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-2" aria-label="Menu source">
        <button type="button" aria-pressed={source === "website"} disabled={running} onClick={() => { setSource("website"); setState({ status: "idle" }); }} className={`rounded-xl px-3 py-2 text-sm ${source === "website" ? "bg-action text-on-action" : "bg-soft"}`}>Website URL</button>
        <button type="button" aria-pressed={source === "photos"} disabled={running} onClick={() => { setSource("photos"); setState({ status: "idle" }); }} className={`rounded-xl px-3 py-2 text-sm ${source === "photos" ? "bg-action text-on-action" : "bg-soft"}`}>Upload menu photos</button>
      </div>
      <form onSubmit={scrape} className="flex flex-col gap-3">
        {source === "website" ? (
        <input
          aria-label="Restaurant website URL"
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="www.your-restaurant.com"
          required
          disabled={running}
          className="min-w-0 flex-1 rounded-xl border border-control bg-surface px-3 py-2"
        />
        ) : (
          <>
            <label className="text-sm">Restaurant name (optional)
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={running} className="mt-1 w-full rounded-xl border border-control px-3 py-2" />
            </label>
            <label className="text-sm">Menu photos
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple required disabled={running} onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} className="mt-1 block w-full rounded-xl border border-dashed border-control p-3" />
            </label>
            <p className="text-xs text-muted">JPG, PNG or WebP · Up to 8 photos, 3 MB total. Include readable item names and prices. Photos are sent to OpenAI to read the menu; the app saves the extracted menu, not the photos.</p>
            {photos.length > 0 && <p className="text-sm">{photos.length} photo{photos.length === 1 ? "" : "s"} selected</p>}
          </>
        )}
        <button
          type="submit"
          disabled={running}
          className="rounded-xl bg-action px-4 py-2 text-on-action disabled:opacity-50"
        >
          {running ? "Reading…" : "Get QR"}
        </button>
      </form>

      {state.status !== "idle" && (
        <ol aria-live="polite" className="mt-6 space-y-1.5 text-sm">
          {state.steps.map((step, i) => {
            const current = running && i === state.steps.length - 1;
            return (
              <li key={i} className={current ? "text-ink" : "text-muted"}>
                <span className="mr-2 inline-block w-4">{current ? "…" : "✓"}</span>
                {step}
              </li>
            );
          })}
        </ol>
      )}

      {state.status === "error" && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.message}</p>
      )}

      {state.status === "done" && <QrCard {...state.result} />}
    </div>
  );
}
