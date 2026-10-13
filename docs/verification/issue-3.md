# Issue #3 verification, 13 October 2026

## Scope

Continued Claude's uncommitted implementation from `/Users/priyadharshan/Desktop/test`, on a new branch based on current main. Added photo uploads at the user's request. Shared menu types and database schema are unchanged.

## Verified

- Production build and TypeScript: pass.
- Ten deterministic regressions: live failure fallback; hung provider, save and cache lookup; homepage menu discovery despite priced specials; invalid input; failed vision never silently downgraded to text; vision item normalization; upload type/size validation and image encoding.
- Existing seed-menu contract and diner smoke checks: pass for dine-in, pickup, delivery, unknown mode, default context and unknown restaurant.
- Jina + OpenAI + production Supabase: PastaMania (`https://www.pastamania.com.sg/menu`) extracted 38 priced items from four images; La Nonna (`https://www.lanonna.sg/menu`) extracted 48 items from text/eight images. Both saved diner pages independently return HTTP 200.
- Local browser upload flow: selected menu photo, observed processing, received three-item QR, changed table to 12, and switched pickup/delivery. Link parameters updated correctly and pickup/delivery removed the table parameter.
- Production upload: one photo produced three exact fixture items. Two photos produced four items in 4.0 seconds. Independently loaded diner page contains Peanut Noodles $6.50, Garden Rice $5.00, Lime Soda $3.20, Chocolate Cake $4.80 and peanut allergen wording. `scripts/check-scrape-live.mjs` repeats this check explicitly (paid API call).
- Production website browser flow: PastaMania input → progress → 38 items → QR. 390px viewport: content width 390px, no horizontal overflow. Saved uploaded menu also renders all dishes/prices at this viewport.
- Independent QR decoding of the browser-rendered PNG: exact public PastaMania URL with `mode=table&t=12`.
- Physical phone: user scanned the public PastaMania QR and confirmed it opens correctly with Table 12.

## Release

Tested production deployment: `dpl_7xDmQJ1bVeNd2A8kZGQfyEou8WQG`, promoted to `https://sg-opus-dev-day.vercel.app`. The user explicitly approved configuring the existing OpenAI key as a sensitive production setting. No credentials are committed.

## Limits

- Timeout and provider failures are exercised with deterministic substitutes; live provider/database persistence and successful responses are verified separately. The timeout tests accelerate timers instead of spending 20 seconds each.
- Arbitrary sites are not guaranteed: blocked reader pages, unreadable images and unpriced menus return errors or use the saved URL copy. Two candidate sites returned reader errors and were not selected for the demo.
- The reader considers up to eight candidate photos and one primary menu link (with one additional no-menu retry), not a full multi-page crawl. Uploads accept eight photos totaling 3 MB. Uploads without a previously saved URL have no saved-copy fallback.
- Missing photo extraction fails the whole scrape rather than overwriting a saved menu with text-only output. AI-extracted prices and inferred tags still require owner review before real ordering.
- Local Supabase checks could not run because sensitive production values are not downloadable. Persistence was verified through the deployed server and independent public diner requests.
