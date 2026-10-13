import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const seed = JSON.parse(await readFile(new URL("../src/data/seed-restaurant.json", import.meta.url), "utf8"));
const items = seed.menu.items;
assert.ok(items.length >= 10, "Seed must contain at least 10 items");
assert.equal(new Set(items.map((item) => item.id)).size, items.length, "Item IDs must be unique");
for (const item of items) {
  for (const field of ["id", "name", "category", "description"]) {
    assert.equal(typeof item[field], "string", `${item.id}: ${field} must be a string`);
  }
  assert.ok(Number.isFinite(item.price) && item.price >= 0, `${item.id}: invalid price`);
  assert.ok(Array.isArray(item.dietary_tags), `${item.id}: missing dietary_tags`);
  assert.ok(Array.isArray(item.allergens), `${item.id}: missing allergens`);
  if (item.image !== undefined) assert.ok(new URL(item.image).protocol.startsWith("http"));
}
assert.ok(items.some((item) => item.allergens.includes("peanuts")), "Seed must include peanuts");
console.log(`PASS: ${items.length} seed items, unique IDs, required fields and peanut allergen`);
