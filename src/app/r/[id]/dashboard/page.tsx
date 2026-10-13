import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listKitchenOrders } from "@/lib/orders";
import { getRestaurant } from "@/lib/restaurants";
import { OrderBoard } from "./order-board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kitchen dashboard" };

type Props = { params: Promise<{ id: string }> };

export default async function DashboardPage({ params }: Props) {
  const { id } = await params;
  const restaurant = await getRestaurant(id);
  if (!restaurant) notFound();

  const { orders, canMarkServed } = await listKitchenOrders(id);

  return (
    <main className="mx-auto max-w-xl pb-16">
      <OrderBoard
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        initialOrders={orders}
        initialCanMarkServed={canMarkServed}
      />
    </main>
  );
}
