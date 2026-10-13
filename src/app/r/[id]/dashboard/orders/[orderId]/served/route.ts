import { NextResponse } from "next/server";
import { markOrderServed } from "@/lib/orders";

type Context = { params: Promise<{ id: string; orderId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: Context) {
  const { id, orderId } = await params;
  const found = UUID.test(orderId) && (await markOrderServed(id, orderId));
  if (!found) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
