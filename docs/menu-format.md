# Menu format

The one contract every ticket shares. The scraper (#3) **produces** it; the agent (#2, #5, #6) and the diner page **read** it. The source of truth is the types in `src/lib/menu.ts`; change them only after telling the whole team.

A restaurant is stored as one row in Supabase `restaurants`, with the menu in the `menu` JSON column:

```json
{
  "id": "kopi-satay-house",
  "name": "Kopi & Satay House",
  "source_url": "https://example.com",
  "menu": {
    "currency": "SGD",
    "items": [
      {
        "id": "chicken-satay",
        "name": "Chicken Satay (10 sticks)",
        "price": 9.0,
        "category": "Grill",
        "description": "Charcoal-grilled chicken skewers with peanut sauce.",
        "image": "https://example.com/satay.jpg",
        "dietary_tags": ["halal"],
        "allergens": ["peanuts", "soy"]
      }
    ]
  }
}
```

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Slug, unique within the menu. The agent's cart tools refer to items by `id`, never by name. |
| `name` | string | As printed on the menu. |
| `price` | number | In `currency` units: `6.5` means $6.50. |
| `category` | string | Free text, e.g. "Mains". Items are grouped by it on the diner page. |
| `description` | string | Empty string if the menu has none. The allergen guess relies on it. |
| `image` | string, optional | Absolute URL. Omit if there's no photo. |
| `dietary_tags` | array | Only from: `vegetarian`, `vegan`, `halal`, `gluten-free`, `spicy`. |
| `allergens` | array | Only from: `peanuts`, `tree-nuts`, `milk`, `egg`, `gluten`, `soy`, `fish`, `shellfish`, `sesame`. Guessed by the LLM, so always shown to diners as "may contain". Leave it empty only when the item is clearly free of all of them. |

## Rules for the scraper

- Use only the tag and allergen values listed above. The memory feature (#5) matches diner allergies against these exact strings.
- When unsure whether an item contains an allergen, include it. A false "may contain" is harmless; a missing one is not.
- Use the same `currency` for every item in a menu.

## QR links

`/r/<restaurant id>?mode=table&t=<table number>`. `mode` can also be `pickup` or `delivery` (no `t`). Missing or unknown `mode` means `table`. Parsed by `parseDinerContext` in `src/lib/menu.ts`.
