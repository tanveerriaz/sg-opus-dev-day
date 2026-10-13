"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KitchenOrder, KitchenOrders } from "@/lib/orders";

const POLL_MS = 2000;
const HIGHLIGHT_MS = 10_000;

type Props = {
  restaurantId: string;
  restaurantName: string;
  initialOrders: KitchenOrder[];
  initialCanMarkServed: boolean;
};

export function OrderBoard({ restaurantId, restaurantName, initialOrders, initialCanMarkServed }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [canMarkServed, setCanMarkServed] = useState(initialCanMarkServed);
  const [live, setLive] = useState(true);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  // Set after mount only, so the server and the first client render agree.
  const [now, setNow] = useState<number | null>(null);
  const seenIds = useRef(new Set(initialOrders.map((order) => order.id)));

  const base = `/r/${encodeURIComponent(restaurantId)}/dashboard/orders`;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(base, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const latest: KitchenOrders = await response.json();

      const arrived = latest.orders.filter((order) => !seenIds.current.has(order.id)).map((order) => order.id);
      if (arrived.length > 0) {
        arrived.forEach((id) => seenIds.current.add(id));
        setFreshIds((ids) => new Set([...ids, ...arrived]));
        setTimeout(() => {
          setFreshIds((ids) => new Set([...ids].filter((id) => !arrived.includes(id))));
        }, HIGHLIGHT_MS);
      }

      setOrders(latest.orders);
      setCanMarkServed(latest.canMarkServed);
      setLive(true);
    } catch {
      setLive(false);
    }
    setNow(Date.now());
  }, [base]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    // Each poll is scheduled after the last one finishes, so slow responses never pile up.
    const tick = async () => {
      await refresh();
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  async function markServed(orderId: string) {
    const servedAt = new Date().toISOString();
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, served_at: servedAt } : order)),
    );
    try {
      const response = await fetch(`${base}/${orderId}/served`, { method: "POST" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      setLive(false);
    }
    // The next poll brings the saved state back, undoing the change if the request failed.
  }

  const waiting = orders.filter((order) => !order.served_at).length;

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{restaurantName}</h1>
          <p className="text-sm text-muted">
            Kitchen · {waiting === 0 ? "nothing waiting" : `${waiting} waiting`}
          </p>
        </div>
        <span
          role="status"
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            live ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-red-500"}`} />
          {live ? "Live" : "Reconnecting…"}
        </span>
      </header>

      {orders.length === 0 ? (
        <p className="px-4 pt-16 text-center text-muted">No orders yet. New ones appear here on their own.</p>
      ) : (
        <ol className="space-y-3 px-4 pt-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              fresh={freshIds.has(order.id)}
              onServed={canMarkServed ? () => markServed(order.id) : undefined}
            />
          ))}
        </ol>
      )}
    </>
  );
}

function OrderCard({
  order,
  now,
  fresh,
  onServed,
}: {
  order: KitchenOrder;
  now: number | null;
  fresh: boolean;
  onServed?: () => void;
}) {
  const served = order.served_at !== null;

  return (
    <li
      className={`rounded-xl border bg-surface p-4 shadow-sm transition ${
        fresh ? "border-amber-400 ring-2 ring-amber-300" : "border-line"
      } ${served ? "opacity-50" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{describeWhere(order)}</h2>
        <span className="shrink-0 text-sm tabular-nums text-muted">
          {fresh && <span className="mr-2 font-semibold text-amber-700">New</span>}
          {now !== null && describeAge(order.created_at, now)}
        </span>
      </div>

      <ul className="mt-2 space-y-1">
        {order.items.map((item, index) => (
          <li key={`${item.item_id}-${index}`} className="flex gap-2">
            <span className="w-8 shrink-0 font-semibold tabular-nums">{item.quantity}×</span>
            <span>
              {item.name}
              {item.notes && <span className="font-medium text-amber-800"> ({item.notes})</span>}
            </span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm text-warning-ink">Note: {order.notes}</p>
      )}

      {served ? (
        <p className="mt-3 text-sm font-medium text-muted">Served</p>
      ) : (
        onServed && (
          <button
            type="button"
            onClick={onServed}
            className="mt-3 w-full rounded-xl bg-action px-4 py-2 font-medium text-on-action active:bg-stone-700"
          >
            Mark served
          </button>
        )
      )}
    </li>
  );
}

function describeWhere({ mode, table_number }: KitchenOrder): string {
  if (mode === "pickup") return "Pickup";
  if (mode === "delivery") return "Delivery";
  return table_number ? `Table ${table_number}` : "Dine-in";
}

function describeAge(createdAt: string, now: number): string {
  const minutes = Math.floor((now - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
