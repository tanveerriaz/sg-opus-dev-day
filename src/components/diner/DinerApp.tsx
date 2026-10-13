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
import { useMemory, MemoryPanel } from "./useMemory";
import { useVoiceAgent } from "./useVoiceAgent";

type Tab = "menu" | "chat" | "cart" | "memory";

type Props = { restaurant: Restaurant; context: DinerContext };

export function DinerApp({ restaurant, context }: Props) {
  const { menu } = restaurant;
  const memory = useMemory();
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
    onPreference: memory.save,
  });

  const { notify: notifyText } = agent;
  const voice = useVoiceAgent({
    restaurantId: restaurant.id,
    context,
    menu,
    cartRef,
    setCart,
    onReview: openReview,
    onPreference: memory.save,
    show: agent.show,
    revise: agent.revise,
    // The text agent didn't hear the voice conversation, so point it at the cart.
    onEnded: useCallback(
      () => notifyText("The diner talked to you in voice mode since their last typed message, so the cart may have changed."),
      [notifyText],
    ),
  });

  /** Tells whichever agent the diner is using about something that happened on screen. */
  const notifyAgent = (event: string) => {
    agent.notify(event);
    voice.notify(event);
  };

  if (context.mode === "delivery") {
    return (
      <Shell restaurant={restaurant} subtitle="Delivery order">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-4 mt-4 rounded-xl bg-warning px-4 py-3 text-warning-ink">
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
      void memory.update();
      setPlaced(data.order);
      setReview(null);
      setCart([]);
      notifyAgent(
        `The diner confirmed on screen and order #${shortRef(data.order.id)} was placed. The cart is now empty. If they want more, start a new order.`,
      );
    } catch {
      setPlaceError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPlacing(false);
    }
  };

  const cancelReview = () => {
    notifyAgent("The diner closed the order summary without confirming. Ask what they'd like to change.");
    setReview(null);
    setTab("chat");
  };

  const count = cartCount(cart);
  const cartSummary = count > 0 ? `${count} ${count === 1 ? "item" : "items"} · ${formatPrice(orderTotal(priceCart(cart, menu)), menu.currency)}` : null;
  const subtitle = context.mode === "pickup" ? "Pickup order" : context.table ? `Dine-in · Table ${context.table}` : "Dine-in";

  // The chat tab has its own "Listening" bar, so the banner covers every other screen.
  const voiceBanner = voice.state === "live" && <VoiceBanner onEnd={voice.stop} />;

  if (placed) {
    return (
      <Shell restaurant={restaurant} subtitle={subtitle}>
        {voiceBanner}
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
      {tab !== "chat" && voiceBanner}
      {memory.data.preferences.length>0 && <div className="bg-sage px-4 py-2 text-sm text-sage-ink">Welcome back. Remembered: {memory.data.preferences.map(p=>p.value).join(", ")}. <button onClick={()=>setTab("memory")} className="underline">Manage</button></div>}
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
          voice={{ state: voice.state, onStart: voice.start, onStop: voice.stop }}
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

      <div className="min-h-0 flex-1 overflow-y-auto" hidden={tab!=="memory"}><MemoryPanel memory={memory}/></div>
      {memory.pending && <div className="border-t bg-warning p-4" role="alert"><p>Remember {memory.pending.kind}: <strong>{memory.pending.value}</strong>?</p><button className="mr-4 font-semibold" onClick={async()=>{if(await memory.update({action:"save",...memory.pending,confirmed:true})){notifyAgent(`Preference confirmed and saved: ${memory.pending?.value}`);memory.setPending(null);}}}>Confirm preference</button><button onClick={()=>memory.setPending(null)}>Cancel</button></div>}
      <nav aria-label="Sections" className="flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <TabButton active={tab === "menu"} onClick={() => setTab("menu")} label="Menu" />
        <TabButton active={tab === "chat"} onClick={() => setTab("chat")} label="Chat" />
        <TabButton active={tab === "memory"} onClick={() => setTab("memory")} label="Memory" />
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
    <main className="mx-auto flex h-[calc(100dvh-76px)] max-w-md flex-col">
      <header className="border-b border-line bg-canvas px-4 py-3">
        <h1 className="text-xl font-bold">{restaurant.name}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </header>
      {children}
    </main>
  );
}

function VoiceBanner({ onEnd }: { onEnd: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-action px-4 py-2 text-sm text-on-action" role="status">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
      <span className="flex-1">Voice is on. The agent is listening.</span>
      <button type="button" onClick={onEnd} className="font-medium underline">
        End
      </button>
    </div>
  );
}

function TabButton({ active, onClick, label, badge = 0 }: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex-1 py-3 text-sm font-medium ${active ? "text-ink" : "text-muted"}`}
    >
      {label}
      {badge > 0 && (
        <span className="ml-1.5 rounded-full bg-action px-1.5 py-0.5 text-xs tabular-nums text-on-action">{badge}</span>
      )}
      {active && <span className="absolute inset-x-6 top-0 h-0.5 bg-action" aria-hidden />}
    </button>
  );
}
