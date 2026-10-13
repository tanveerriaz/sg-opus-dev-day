"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { Mode } from "@/lib/menu";
import type { ScrapeEvent } from "@/lib/scrape/events";

type Props = Extract<ScrapeEvent, { type: "done" }>;

export function QrCard({ restaurant, fromSavedCopy }: Props) {
  const [mode, setMode] = useState<Mode>("table");
  const [table, setTable] = useState("1");
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ mode, ...(mode === "table" ? { t: table } : {}) });
    const next = `${window.location.origin}/r/${restaurant.id}?${params}`;
    setLink(next);
    let cancelled = false;
    setQr("");
    setError("");
    QRCode.toDataURL(next, { width: 640, margin: 4 }).then((image) => {
      if (!cancelled) setQr(image);
    }).catch(() => { if (!cancelled) setError("Could not generate the QR code. Use the diner link below."); });
    return () => { cancelled = true; };
  }, [restaurant.id, mode, table]);

  return (
    <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold">{restaurant.name}</h2>
      <p className="text-sm text-stone-500">
        {restaurant.itemCount} menu items
        {/* Tell owners when the saved menu was used. */}
        {fromSavedCopy && " · saved copy"}
      </p>

      <div className="mt-4 flex gap-2 text-sm">
        <select
          aria-label="Order mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="rounded-lg border border-stone-300 px-2 py-1.5"
        >
          <option value="table">Dine-in</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
        </select>
        {mode === "table" && (
          <label className="flex items-center gap-2">
            Table
            <input
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="w-16 rounded-lg border border-stone-300 px-2 py-1.5"
            />
          </label>
        )}
      </div>

      {error && <p role="alert">{error}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt={`QR code for ${link}`} className="mx-auto mt-4 w-64" />}

      <div className="mt-4 flex justify-between text-sm">
        <a href={link} target="_blank" rel="noreferrer" className="underline">
          Open diner page
        </a>
        {qr && (
          <a href={qr} download={`${restaurant.id}-qr.png`} className="underline">
            Download PNG
          </a>
        )}
      </div>
    </section>
  );
}
