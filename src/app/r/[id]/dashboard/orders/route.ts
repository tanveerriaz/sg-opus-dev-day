import { NextResponse } from "next/server";
import { listKitchenOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Polled by the kitchen dashboard every 2 seconds. */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(await listKitchenOrders(id), {
    headers: { "Cache-Control": "no-store" },
  });
}
