"use client";
// The order summary the diner confirms before it's placed. Opened by the agent's
// place_order tool or the cart's "Review order" button.
import { useState } from "react";
import { MAX_NOTES_LENGTH, orderTotal, priceCart, type Cart } from "@/lib/cart";
import { formatPrice, type DinerContext, type Menu } from "@/lib/menu";

type Props = {
  cart: Cart;
  menu: Menu;
  context: DinerContext;
  initialNotes: string | null;
  submitting: boolean;
  error: string | null;
  onConfirm: (notes: string | null) => void;
  onCancel: () => void;
};

export function ReviewSheet({ cart, menu, context, initialNotes, submitting, error, onConfirm, onCancel }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const items = priceCart(cart, menu);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <h2 id="review-title" className="text-lg font-bold">
          Confirm your order
        </h2>
        <p className="text-sm text-stone-600">
          {context.mode === "pickup" ? "Pickup at the counter" : context.table ? `Table ${context.table}` : "Dine-in"}
        </p>

        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={`${item.item_id}-${item.notes ?? ""}`} className="flex justify-between gap-3">
              <span>
                {item.quantity}× {item.name}
                {item.notes && <span className="block text-sm text-stone-600">{item.notes}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatPrice(item.price * item.quantity, menu.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-stone-200 pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(orderTotal(items), menu.currency)}</span>
        </div>

        <label className="mt-4 block text-sm font-medium" htmlFor="order-notes">
          Notes for the kitchen (optional)
        </label>
        <textarea
          id="order-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={MAX_NOTES_LENGTH}
          rows={2}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
        />

        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">No payment now: pay at the counter.</p>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-lg border border-stone-300 py-3 font-medium"
          >
            Make changes
          </button>
          <button
            type="button"
            onClick={() => onConfirm(notes.trim() || null)}
            disabled={submitting || items.length === 0}
            className="flex-1 rounded-lg bg-stone-900 py-3 font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Placing…" : "Confirm order"}
          </button>
        </div>
      </div>
    </div>
  );
}
