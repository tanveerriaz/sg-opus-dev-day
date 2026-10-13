import type { PlacedOrder } from "@/lib/agent/protocol";
import { formatPrice } from "@/lib/menu";

type Props = { order: PlacedOrder; currency: string; onOrderMore: () => void };

export function OrderConfirmed({ order, currency, onOrderMore }: Props) {
  return (
    <div className="px-4 py-8">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700" aria-hidden>
        ✓
      </div>
      <h2 className="mt-4 text-center text-2xl font-bold">Order placed</h2>
      <p className="mt-1 text-center text-stone-600">
        {order.mode === "pickup"
          ? "We'll call you when it's ready at the counter."
          : `It's on its way to ${order.table ? `table ${order.table}` : "your table"}.`}
      </p>
      <p className="mt-1 text-center text-sm text-stone-500">Order #{shortRef(order.id)}</p>

      <ul className="mt-6 space-y-2 rounded-lg bg-white p-4 shadow-sm">
        {order.items.map((item) => (
          <li key={`${item.item_id}-${item.notes ?? ""}`} className="flex justify-between gap-3">
            <span>
              {item.quantity}× {item.name}
              {item.notes && <span className="block text-sm text-stone-600">{item.notes}</span>}
            </span>
            <span className="shrink-0 tabular-nums">{formatPrice(item.price * item.quantity, currency)}</span>
          </li>
        ))}
        {order.notes && <li className="border-t border-stone-200 pt-2 text-sm text-stone-600">Notes: {order.notes}</li>}
        <li className="flex justify-between border-t border-stone-200 pt-2 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(order.total, currency)}</span>
        </li>
      </ul>

      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center font-medium text-amber-900">Please pay at the counter.</p>

      <button type="button" onClick={onOrderMore} className="mt-6 w-full rounded-lg border border-stone-300 py-3 font-medium">
        Order something else
      </button>
    </div>
  );
}

export function shortRef(id: string): string {
  return id.slice(0, 6).toUpperCase();
}
