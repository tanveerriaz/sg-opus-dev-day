import { ScrapeForm } from "./scrape-form";

export const metadata = { title: "Get your QR code" };

export default function RestaurantPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Turn your menu into an ordering agent</h1>
      <p className="mt-2 text-muted">
        Paste your restaurant&apos;s website or upload menu photos. We&apos;ll read the dishes and prices, then give you a QR code for your tables.
      </p>
      <ScrapeForm />
    </main>
  );
}
