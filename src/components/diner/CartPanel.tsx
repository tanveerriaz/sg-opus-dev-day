"use client";
import { orderTotal, priceCart, type Cart, type CartLine } from "@/lib/cart";
import { formatPrice, type Menu } from "@/lib/menu";

type Props = {
  cart: Cart;
  menu: Menu;
  onIncrease: (line: CartLine) => void;
  onDecrease: (line: CartLine) => void;
  onCheckout: () => void;
  onBrowse: () => void;
};

export function CartPanel({ cart, menu, onIncrease, onDecrease, onCheckout, onBrowse }: Props) {
  const items = priceCart(cart, menu);

  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-stone-600">
        <p>Your cart is empty.</p>
        <button type="button" onClick={onBrowse} className="mt-3 font-medium text-stone-900 underline">
          Ask the agent or browse the menu
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <ul className="divide-y divide-stone-200">
        {items.map((item, i) => (
          <li key={`${item.item_id}-${item.notes ?? ""}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.name}</p>
              {item.notes && <p className="text-sm text-stone-600">{item.notes}</p>}
              <p className="text-sm tabular-nums text-stone-600">{formatPrice(item.price * item.quantity, menu.currency)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onDecrease(cart[i])}
                aria-label={`One less ${item.name}`}
                className="size-8 rounded-full border border-stone-300 text-lg leading-none"
              >
                −
              </button>
              <span className="w-5 text-center tabular-nums">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onIncrease(cart[i])}
                aria-label={`One more ${item.name}`}
                className="size-8 rounded-full border border-stone-300 text-lg leading-none"
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between border-t border-stone-300 pt-4 text-lg font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatPrice(orderTotal(items), menu.currency)}</span>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        className="mt-4 w-full rounded-lg bg-stone-900 py-3 font-medium text-white"
      >
        Review order
      </button>
    </div>
  );
}
