import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const seed = JSON.parse(await readFile(new URL("../src/data/seed-restaurant.json", import.meta.url), "utf8"));
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
for (const [query, expected] of [
  ["?mode=table&t=12", "Dine-in · Table 12"],
  ["?mode=pickup&t=12", "Pickup order"],
  ["?mode=delivery&t=12", "Delivery order"],
  ["?mode=unknown&t=7", "Dine-in · Table 7"],
  ["", "Dine-in"],
]) {
  const response = await fetch(new URL(`/r/${seed.id}${query}`, base), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${query}: page must be public and return 200`);
  const raw = await response.text();
  const html = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  assert.ok(html.includes(expected), `${query}: missing order context`);
  for (const item of seed.menu.items) assert.ok(html.includes(escape(item.name)), `${query}: missing ${item.name}`);
  assert.ok(html.includes("may contain: ") && html.includes("peanuts"), "Missing allergen warning");
  if (query.includes("pickup") || query.includes("delivery")) assert.ok(!html.includes("Table 12"), "Non-table orders must ignore table number");
  console.log(`PASS: ${query || "default context"}, all menu items and allergen wording`);
}
const missing = await fetch(new URL("/r/acceptance-check-missing-restaurant", base), { signal: AbortSignal.timeout(30000) });
assert.equal(missing.status, 404, "Unknown restaurant must return 404");
console.log("PASS: unknown restaurant returns 404");
console.log("Phone rendering and a real Supabase connection require separate checks.");
