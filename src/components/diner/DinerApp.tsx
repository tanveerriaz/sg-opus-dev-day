"use client";
// The diner page: Menu / Chat / Cart tabs, the confirmation sheet and the "order placed"
// screen. Owns the cart; the agent and the cart buttons both change it.
import { useCallback, useRef, useState } from "react";
import { addToCart, cartCount, orderTotal, priceCart, removeFromCart, type Cart } from "@/lib/cart";
import type { OrderResponse, PlacedOrder } from "@/lib/agent/protocol";
import { formatPrice, type DinerContext, type Restaurant } from "@/lib/menu";
import { CartPanel } from "./CartPanel";
import { ChatPanel } from "./ChatPanel";
import { MenuList } from "./MenuList";
import { OrderConfirmed, shortRef } from "./OrderConfirmed";
import { ReviewSheet } from "./ReviewSheet";
import { useTextAgent } from "./useTextAgent";

type Tab = "menu" | "chat" | "cart";

type Props = { restaurant: Restaurant; context: DinerContext };

export function DinerApp({ restaurant, context }: Props) {
  const { menu } = restaurant;
  const [tab, setTab] = useState<Tab>("chat");
  const [cart, setCartState] = useState<Cart>([]);
  const cartRef = useRef<Cart>([]);
  const [review, setReview] = useState<{ notes: string | null } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  // The ref lets the agent loop read the newest cart between tool calls.
  const setCart = useCallback((next: Cart) => {
    cartRef.current = next;
    setCartState(next);
  }, []);

  const openReview = useCallback((r: { notes: string | null }) => {
    setPlaceError(null);
    setReview(r);
  }, []);

  const agent = useTextAgent({
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    context,
    menu,
    cartRef,
    setCart,
    onReview: openReview,
  });

  if (context.mode === "delivery") {
    return (
      <Shell restaurant={restaurant} subtitle="Delivery">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-4 mt-4 rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
            <p className="font-medium">Delivery is coming soon.</p>
            <p className="text-sm">For now you can browse the menu. Order at the restaurant or for pickup.</p>
          </div>
          <MenuList menu={menu} />
        </div>
      </Shell>
    );
  }

  const confirm = async (notes: string | null) => {
    setPlacing(true);
    setPlaceError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurant.id, ...context, cart: cartRef.current, notes }),
      });
      const data = (await res.json().catch(() => ({ error: "The order couldn't be placed. Try again." }))) as OrderResponse;
      if ("error" in data) {
        setPlaceError(data.error);
        return;
      }
      agent.notify(
        `The diner confirmed on screen and order #${shortRef(data.order.id)} was placed. The cart is now empty. If they want more, start a new order.`,
      );
      setPlaced(data.order);
      setReview(null);
      setCart([]);
    } catch {
      setPlaceError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPlacing(false);
    }
  };

  const cancelReview = () => {
    agent.notify("The diner closed the order summary without confirming. Ask what they'd like to change.");
    setReview(null);
    setTab("chat");
  };

  const count = cartCount(cart);
  const cartSummary = count > 0 ? `${count} ${count === 1 ? "item" : "items"} · ${formatPrice(orderTotal(priceCart(cart, menu)), menu.currency)}` : null;
  const subtitle = context.mode === "pickup" ? "Pickup order" : context.table ? `Dine-in · Table ${context.table}` : "Dine-in";

  if (placed) {
    return (
      <Shell restaurant={restaurant} subtitle={subtitle}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <OrderConfirmed
            order={placed}
            currency={menu.currency}
            onOrderMore={() => {
              setPlaced(null);
              setTab("chat");
            }}
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell restaurant={restaurant} subtitle={subtitle}>
      <div className="min-h-0 flex-1 overflow-y-auto" hidden={tab !== "menu"}>
        <MenuList menu={menu} onAdd={(item) => setCart(addToCart(cartRef.current, menu, { item_id: item.id, quantity: 1 }).cart)} />
      </div>
      <div className="min-h-0 flex-1" hidden={tab !== "chat"}>
        <ChatPanel
          transcript={agent.transcript}
          busy={agent.busy}
          onSend={agent.send}
          cartSummary={cartSummary}
          onOpenCart={() => setTab("cart")}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" hidden={tab !== "cart"}>
        <CartPanel
          cart={cart}
          menu={menu}
          onIncrease={(line) => setCart(addToCart(cartRef.current, menu, { ...line, quantity: 1 }).cart)}
          onDecrease={(line) => setCart(removeFromCart(cartRef.current, { ...line, quantity: 1 }).cart)}
          onCheckout={() => openReview({ notes: null })}
          onBrowse={() => setTab("chat")}
        />
      </div>

      <nav aria-label="Sections" className="flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <TabButton active={tab === "menu"} onClick={() => setTab("menu")} label="Menu" />
        <TabButton active={tab === "chat"} onClick={() => setTab("chat")} label="Chat" />
        <TabButton active={tab === "cart"} onClick={() => setTab("cart")} label="Cart" badge={count} />
      </nav>

      {review && (
        <ReviewSheet
          cart={cart}
          menu={menu}
          context={context}
          initialNotes={review.notes}
          submitting={placing}
          error={placeError}
          onConfirm={confirm}
          onCancel={cancelReview}
        />
      )}
    </Shell>
  );
}

function Shell({ restaurant, subtitle, children }: { restaurant: Restaurant; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <h1 className="text-xl font-bold">{restaurant.name}</h1>
        <p className="text-sm text-stone-600">{subtitle}</p>
      </header>
      {children}
    </main>
  );
}

function TabButton({ active, onClick, label, badge = 0 }: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex-1 py-3 text-sm font-medium ${active ? "text-stone-900" : "text-stone-500"}`}
    >
      {label}
      {badge > 0 && (
        <span className="ml-1.5 rounded-full bg-stone-900 px-1.5 py-0.5 text-xs tabular-nums text-white">{badge}</span>
      )}
      {active && <span className="absolute inset-x-6 top-0 h-0.5 bg-stone-900" aria-hidden />}
    </button>
  );
}
