import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("BLOCKED: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Local seed fallback is not a connected database.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const table of ["restaurants", "orders", "diner_profiles"]) {
  const { error } = await db.from(table).select("id", { count: "exact", head: true });
  if (error) {
    console.error(`FAIL: ${table} is not accessible (${error.code ?? "connection error"})`);
    process.exit(1);
  }
  console.log(`PASS: ${table} is accessible`);
}
const seed = JSON.parse(await readFile(new URL("../src/data/seed-restaurant.json", import.meta.url), "utf8"));
const { data, error } = await db.from("restaurants").select("id,name,source_url,menu").eq("id", seed.id).single();
assert.ok(!error, "Seed restaurant must exist in Supabase");
assert.deepEqual(data, seed, "Stored restaurant must match the hand-written seed");
console.log(`PASS: Supabase seed matches all ${seed.menu.items.length} menu items`);
