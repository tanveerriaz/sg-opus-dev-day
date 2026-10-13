import Link from "next/link";
import { SEED_RESTAURANT_ID } from "@/lib/restaurants";

export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">QR Ordering Agent</h1>
      <p className="mt-2 text-muted">Scan, chat, order. Your taste profile follows you.</p>
      <Link
        href="/restaurant"
        className="mt-6 block rounded-xl bg-action px-4 py-2 text-center text-on-action"
      >
        I&apos;m a restaurant: get a QR code
      </Link>
      <Link
        href={`/r/${SEED_RESTAURANT_ID}?mode=table&t=12`}
        className="mt-3 block rounded-xl border border-control px-4 py-2 text-center"
      >
        Open the seed restaurant at table 12
      </Link>
    </main>
  );
}
