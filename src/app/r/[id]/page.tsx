import { notFound } from "next/navigation";
import { formatPrice, groupByCategory, parseDinerContext, type DinerContext } from "@/lib/menu";
import { getRestaurant } from "@/lib/restaurants";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string | string[]; t?: string | string[] }>;
};

export default async function DinerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const context = parseDinerContext(await searchParams);
  const restaurant = await getRestaurant(id);
  if (!restaurant) notFound();

  const { currency, items } = restaurant.menu;

  return (
    <main className="mx-auto max-w-md pb-16">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">{restaurant.name}</h1>
        <p className="text-sm text-stone-600">{describeContext(context)}</p>
      </header>

      {groupByCategory(items).map(([category, categoryItems]) => (
        <section key={category} className="px-4 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            {category}
          </h2>
          <ul className="mt-2 divide-y divide-stone-200">
            {categoryItems.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                {item.image && (
                  // Scraped images come from any domain, so a plain <img> avoids next/image config.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="shrink-0 tabular-nums">{formatPrice(item.price, currency)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-stone-600">{item.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-xs">
                    {item.dietary_tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                        {tag}
                      </span>
                    ))}
                    {item.allergens.length > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                        may contain: {item.allergens.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function describeContext({ mode, table }: DinerContext): string {
  if (mode === "pickup") return "Pickup order";
  if (mode === "delivery") return "Delivery order";
  return table ? `Dine-in · Table ${table}` : "Dine-in";
}
