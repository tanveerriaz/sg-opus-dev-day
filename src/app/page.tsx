import Link from "next/link";
import { SEED_RESTAURANT_ID } from "@/lib/restaurants";

export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">QR Ordering Agent</h1>
      <p className="mt-2 text-stone-600">
        The restaurant page (paste a URL, get a QR code) arrives in ticket #3.
      </p>
      <Link
        href={`/r/${SEED_RESTAURANT_ID}?mode=table&t=12`}
        className="mt-6 inline-block rounded-lg bg-stone-900 px-4 py-2 text-white"
      >
        Open the seed restaurant at table 12
      </Link>
    </main>
  );
}
