// The shared menu format. The scraper (#3) produces it, the agent (#2, #5, #6)
// reads it, and the diner page renders it. Change it only with the whole team.
// Human-readable version: docs/menu-format.md

export const ALLERGENS = [
  "peanuts",
  "tree-nuts",
  "milk",
  "egg",
  "gluten",
  "soy",
  "fish",
  "shellfish",
  "sesame",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const DIETARY_TAGS = [
  "vegetarian",
  "vegan",
  "halal",
  "gluten-free",
  "spicy",
] as const;
export type DietaryTag = (typeof DIETARY_TAGS)[number];

export type MenuItem = {
  /** Stable slug, unique within the menu. The agent's cart tools refer to items by this. */
  id: string;
  name: string;
  /** In the menu's currency, e.g. 6.5 for $6.50. */
  price: number;
  category: string;
  description: string;
  image?: string;
  dietary_tags: DietaryTag[];
  /** Guessed by the LLM from the description, so always shown to diners as "may contain". */
  allergens: Allergen[];
};

export type Menu = {
  /** ISO 4217 code, e.g. "SGD". */
  currency: string;
  items: MenuItem[];
};

export type Restaurant = {
  id: string;
  name: string;
  source_url: string | null;
  menu: Menu;
};

export type Mode = "table" | "pickup" | "delivery";

export type DinerContext = {
  mode: Mode;
  /** Table number, only for mode "table". */
  table: string | null;
};

/** Reads the QR link's query string: ?mode=table&t=12 */
export function parseDinerContext(params: {
  mode?: string | string[];
  t?: string | string[];
}): DinerContext {
  const raw = first(params.mode);
  const mode: Mode = raw === "pickup" || raw === "delivery" ? raw : "table";
  const table = mode === "table" ? first(params.t) ?? null : null;
  return { mode, table };
}

export function groupByCategory(items: MenuItem[]): [string, MenuItem[]][] {
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  }
  return [...groups];
}

export function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency }).format(price);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
