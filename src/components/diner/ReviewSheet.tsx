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
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <h2 id="review-title" className="text-lg font-bold">
          Confirm your order
        </h2>
        <p className="text-sm text-muted">
          {context.mode === "pickup" ? "Pickup at the counter" : context.table ? `Table ${context.table}` : "Dine-in"}
        </p>

        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={`${item.item_id}-${item.notes ?? ""}`} className="flex justify-between gap-3">
              <span>
                {item.quantity}× {item.name}
                {item.notes && <span className="block text-sm text-muted">{item.notes}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatPrice(item.price * item.quantity, menu.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-semibold">
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
          className="mt-1 w-full rounded-xl border border-control px-3 py-2 outline-none focus:border-stone-500"
        />

        <p className="mt-3 rounded-xl bg-warning px-3 py-2 text-sm text-warning-ink">No payment now: pay at the counter.</p>
        {error && <p className="mt-3 text-sm text-danger-ink">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-xl border border-control py-3 font-medium"
          >
            Make changes
          </button>
          <button
            type="button"
            onClick={() => onConfirm(notes.trim() || null)}
            disabled={submitting || items.length === 0}
            className="flex-1 rounded-xl bg-action py-3 font-medium text-on-action disabled:opacity-50"
          >
            {submitting ? "Placing…" : "Confirm order"}
          </button>
        </div>
      </div>
    </div>
  );
}
