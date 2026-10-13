import { formatPrice, groupByCategory, type Menu, type MenuItem } from "@/lib/menu";

type Props = {
  menu: Menu;
  /** Shows an Add button on each item when set. */
  onAdd?: (item: MenuItem) => void;
};

export function MenuList({ menu, onAdd }: Props) {
  return (
    <div className="pb-6">
      {groupByCategory(menu.items).map(([category, items]) => (
        <section key={category} className="px-4 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{category}</h2>
          <ul className="mt-2 divide-y divide-stone-200">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                {item.image && (
                  // Scraped images come from any domain, so a plain <img> avoids next/image config.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="shrink-0 tabular-nums">{formatPrice(item.price, menu.currency)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{item.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
                    {item.dietary_tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                        {tag}
                      </span>
                    ))}
                    {item.allergens.length > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-warning-ink">
                        may contain: {item.allergens.join(", ")}
                      </span>
                    )}
                    {onAdd && (
                      <button
                        type="button"
                        onClick={() => onAdd(item)}
                        className="ml-auto rounded-full border border-control px-3 py-1 text-sm font-medium hover:bg-soft"
                        aria-label={`Add ${item.name}`}
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
