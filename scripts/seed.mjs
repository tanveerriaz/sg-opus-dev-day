// Upserts the seed restaurant into Supabase. Run with: npm run seed
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const seed = JSON.parse(
  await readFile(new URL("../src/data/seed-restaurant.json", import.meta.url), "utf8"),
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { error } = await supabase.from("restaurants").upsert(seed);
if (error) {
  console.error("Seeding failed:", error.message);
  process.exit(1);
}
console.log(`Seeded ${seed.name} (${seed.menu.items.length} items) → /r/${seed.id}?mode=table&t=12`);
