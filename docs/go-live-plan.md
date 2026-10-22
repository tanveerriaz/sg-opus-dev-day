# Grub go-live readiness report

**Date:** 22 October 2026  
**Scope:** Codebase, docs, GitHub issues, automated checks, and live deployment at https://sg-opus-dev-day.vercel.app  
**Author:** Cloud agent investigation (no application code changed in this run)

This report is for Tanveer and anyone planning to turn Grub from a hackathon demo into a product restaurants in Singapore could rely on. It separates what already works, what is demo-only, what blocks real use, and a phased path to a one-restaurant pilot.

---

## Executive summary

Grub is a **coherent MVP** for a controlled demo: paste a menu URL or upload photos → QR code → diner chats or talks to an agent → cart → confirm → order appears on a kitchen board. The codebase is small, well-documented, and covered by useful smoke and scrape regression scripts.

**Production is not healthy today.** As of 22 October 2026, the live app serves the marketing home page and `/restaurant` onboarding UI, but **every diner and kitchen route under `/r/*` returns HTTP 500**, production smoke checks fail, and menu scraping returns **OpenAI 401** (invalid or missing API key on the deployment). The README still describes a working stack on co-partner Vercel (`priyadharshan-kannans-projects`) and Supabase (`opus5.5-build-day`), with **manual deploys only** and no GitHub Actions CI.

**Bottom line:** The **software path** from menu → QR → order → kitchen is largely built (issues #1–#6 are closed). The **product path** to a real Singapore pilot needs: restored and owned infrastructure, restaurant auth, protected kitchen access, abuse/cost controls on LLM and voice, payment or an explicit “pay at counter” operating model, PDPA-grade diner data handling, and operational monitoring—not a large rewrite, but several focused workstreams.

---

## 1. What works today (verified)

### 1.1 Automated checks (this run, without production secrets)

| Check | Command | Result |
| --- | --- | --- |
| Menu contract | `npm run check:menu` | **Pass** — 11 seed items, peanut allergen present (`scripts/check-menu.mjs`, `src/data/seed-restaurant.json`) |
| Production build | `npm run build` | **Pass** — Next.js 15.5, TypeScript clean |
| Scrape regressions | `npm run check:scrape` | **Pass** — 10/10 deterministic tests (`scripts/check-scrape.cjs`) |
| Diner smoke (local) | `npm run check:smoke -- http://localhost:3000` | **Pass** — all URL contexts, 404 for unknown restaurant (`scripts/check-smoke.mjs`) |
| Database contract | `npm run check:db` | **Blocked** — no `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in this environment |

Local smoke passes because without Supabase env vars the app uses in-memory fallback for the seed restaurant (`src/lib/restaurants.ts` lines 11–15, 19–21). **That fallback is disabled for saving restaurants in production** (`saveScrapedRestaurant` throws if Supabase is missing in production — lines 58–59).

### 1.2 Live deployment (22 October 2026)

| URL | HTTP status | Notes |
| --- | --- | --- |
| https://sg-opus-dev-day.vercel.app/ | 200 | Home links to `/restaurant` and seed diner URL |
| https://sg-opus-dev-day.vercel.app/restaurant | 200 | Onboarding UI loads |
| https://sg-opus-dev-day.vercel.app/r/kopi-satay-house?mode=table&t=12 | **500** | Primary diner entry — broken |
| https://sg-opus-dev-day.vercel.app/r/kopi-satay-house/dashboard | **500** | Kitchen board — broken |
| https://sg-opus-dev-day.vercel.app/r/acceptance-check-missing-restaurant | **500** | Should be 404; indicates **Supabase errors throw** instead of graceful handling (`getRestaurant` in `src/lib/restaurants.ts` line 24) |
| `POST /api/scrape` (example.com) | Stream ends in error | **OpenAI 401** on extraction — keys on deployment likely invalid or revoked |

`npm run check:smoke -- https://sg-opus-dev-day.vercel.app` **failed** on the first assertion (table-12 page not 200).

**Interpretation:** Production still has Supabase env vars configured (scrape reaches OpenAI; diner routes hit the database path), but **database access or credentials are failing**, and **OpenAI is rejecting the configured key**. Until Tanveer owns Vercel + Supabase and re-secrets the project, treat live URL verification from October 13 (`docs/verification/issue-3.md`, README “Verification on 13 October 2026”) as **stale**.

### 1.3 End-to-end flows (when Supabase and API keys are valid)

These were implemented and verified during the build day; they match the closed GitHub issues and merged PRs (#7–#13).

#### Restaurant onboarding (issue #3, PR #12)

- **Route:** `/restaurant` (`src/app/restaurant/page.tsx`, `scrape-form.tsx`, `qr-card.tsx`)
- **API:** `POST /api/scrape` — NDJSON stream, 60s Vercel function budget (`src/app/api/scrape/route.ts`)
- **Website path:** Jina Reader → OpenAI vision/text extraction (`src/lib/scrape/reader.ts`, `extract.ts`)
- **Photo path:** 1–8 images, 3 MB combined (`src/lib/scrape/uploads.ts`); each upload creates a **new** restaurant; URL re-scrape **updates** same id (`src/lib/restaurants.ts` lines 44–54)
- **Menu contract:** Shared JSON shape in `src/lib/menu.ts`, documented in `docs/menu-format.md`
- **QR:** Generated client-side with table/mode query params (`src/app/restaurant/qr-card.tsx`)

#### Diner experience (issues #2, #5, #6; PRs #9, #11, #13)

- **Route:** `/r/[id]` with `mode` and `t` (`src/app/r/[id]/page.tsx`, `src/components/diner/DinerApp.tsx`)
- **Menu tab:** Renders full menu with allergen wording (`MenuList.tsx`)
- **Chat agent:** Browser runs tools; server runs Claude (`src/app/api/chat/route.ts`, `src/lib/agent/tools.ts`, `useTextAgent.ts`)
- **Voice:** OpenAI Realtime via short-lived client secret (`src/app/api/voice/session/route.ts`, `useVoiceAgent.ts`); requires HTTPS
- **Cart & confirm:** Agent `place_order` opens review sheet; **server reprices** on submit (`src/app/api/orders/route.ts` lines 30–31, `src/lib/cart.ts`)
- **Memory:** Cookie-backed diner profile, preferences, last 20 orders (`src/lib/diner-profile.ts`, `src/app/api/profile/route.ts`, `useMemory.tsx`)

#### Kitchen (issue #4, PR #8)

- **Route:** `/r/[id]/dashboard` (`src/app/r/[id]/dashboard/page.tsx`)
- **Polling:** Every 2s (`order-board.tsx`)
- **Mark served:** `POST .../orders/[orderId]/served` when migration `0002_orders_served_at.sql` is applied (`src/lib/orders.ts` lines 56–65)
- **Privacy:** Kitchen orders intentionally omit diner id (`src/lib/orders.ts` lines 16–18)

### 1.4 What is demo-only or stubbed

| Feature | Evidence | Product implication |
| --- | --- | --- |
| **Payments** | Agent says pay at counter (`src/lib/agent/instructions.ts` line 32); UI banner (`ReviewSheet.tsx` line 61) | No Stripe, PayNow, GrabPay, or receipts |
| **Delivery** | UI may show mode; API returns 400 “coming soon” (`chat/route.ts` line 37, `orders/route.ts` line 25) | Not offered |
| **Phone linking** | Unverified merge by phone number (`profile/route.ts` lines 13–17); explicit demo warning (`useMemory.tsx` line 13) | Not safe for real diners |
| **Kitchen dashboard auth** | No middleware; public URL (`dashboard/page.tsx`) | Anyone with `/r/{slug}/dashboard` sees and can mark orders |
| **Restaurant ownership** | Public `/restaurant` + `/api/scrape`; no owner record | Anyone can overwrite a menu for a known `source_url` |
| **Local-only fallbacks** | In-memory restaurants, orders, profiles when Supabase unset | Fine for dev; production **requires** Supabase for scrape persistence |
| **Sample kitchen orders** | Shown only without Supabase for seed id (`orders.ts` lines 98–137) | Demo filler, not real orders |
| **Design system** | `docs/design-system/README.md` is **spec only**; not all tokens implemented everywhere | Polish gap, not a functional blocker |
| **Glossary / ADRs** | Referenced in `CLAUDE.md` but **not present** in repo | Process doc drift only |

---

## 2. Blockers to real use

### 2.1 Payments (Singapore)

**Today:** No payment integration anywhere in the repo.

**For Singapore restaurants, realistic options:**

| Option | Fit for Grub | Notes |
| --- | --- | --- |
| **Pay at counter / cashier** | Matches current product | Zero integration; trust and reconciliation stay in the POS/cashier. Good for **pilot** if the venue accepts “order ticket only”. |
| **Stripe (+ PayNow)** | Strong for self-serve SaaS | Stripe supports PayNow in Singapore for many business types; card + Apple Pay common. Requires business entity, webhooks, idempotent order→payment linking, refunds. |
| **GrabPay** | High local recognition | Often via Stripe Payment Methods or Grab’s merchant APIs; may matter if venues already use Grab ecosystem. |
| **POS integration** | Enterprise path | Toast, Qashier, etc.—export order JSON or print-style ticket; long lead time. |

**Minimum product decision:** Either commit to **“order is a kitchen ticket; payment offline”** for the pilot (document clearly in UI and agent instructions), or add **Stripe Checkout / Payment Element** after order confirm with amount from server-side `priceCart` (never client totals).

**Effort (rough):** Counter-only = **documentation + UI copy** (S). Stripe PayNow/card = **M–L** (payment intent flow, webhooks, failed-payment handling, reconciliation in dashboard).

### 2.2 Order flow to the kitchen

**What exists:** Orders persist to `orders` table (`supabase/migrations/0001_init.sql`); kitchen UI lists them and supports `served_at` (`0002_orders_served_at.sql`).

**Gaps for real kitchens:**

- **No notifications** — no SMS, WhatsApp, printer, KDS beep, or email when an order arrives; staff must keep the dashboard open (`order-board.tsx` polling only).
- **No order lifecycle** beyond served/not served — no “accepted”, “preparing”, “cancelled”, or SLA timers.
- **No throttling** — spam orders possible via public `POST /api/orders` (`orders/route.ts`).
- **Table number is a query param** — diners can typo or spoof table numbers; no QR-bound table secret.
- **Allergen notes** rely on diner/agent; kitchen sees `notes` on the order but no structured allergen alert workflow.

**Effort:** Browser dashboard + sound = **S** for pilot; printer/WhatsApp = **M**; full KDS = **L**.

### 2.3 Restaurant accounts and auth

**Today:** No Supabase Auth, Clerk, or magic links. `/restaurant` and `/api/scrape` are world-writable.

**Risks:**

- Competitor or vandal re-scrapes a URL and **replaces the menu** (`saveScrapedRestaurant` upsert by derived id — `restaurants.ts` lines 51–65).
- No way to **rotate QR**, **disable** a venue, or **audit** who changed the menu.

**Recommended pilot shape:**

- Supabase Auth (email magic link or Google) for owners.
- `restaurants.owner_user_id` (new column) + server checks on scrape/update.
- Optional: invite code for pilot venues.

**Effort:** **M** (schema migration, auth UI, protect scrape + future menu edit APIs).

### 2.4 Kitchen dashboard protection

**Today:** `/r/[id]/dashboard` and its JSON routes are **unauthenticated** by design comment in `orders.ts` (lines 16–18).

**Pilot mitigations (pick one):**

1. **Secret token in URL** — e.g. `/r/{id}/dashboard?token={random}` stored hashed on restaurant row; rotate from owner settings (**S–M**).
2. **Staff login** shared per venue (**M**).
3. **Vercel Deployment Protection** — **wrong tool** for diners; would break public QR links (README line 87 warns against blocking diner routes).

**Effort:** Tokenized dashboard = **S–M**; proper RBAC = **M**.

### 2.5 Multi-tenant data isolation and RLS

**Pattern today:**

- All DB access uses **service role** from Next.js only (`src/lib/supabase.ts`, `.env.example`).
- RLS is **enabled with zero policies** — anon key cannot read/write (`0001_init.sql` lines 38–40); isolation is **application-level** `.eq("restaurant_id", …)` filters.

**This is acceptable** if every query goes through reviewed server code and the service role never leaks to the client. **It is fragile** as the team grows: one missing filter exposes all tenants.

**Orders and profiles:**

- Orders scoped by `restaurant_id` on kitchen paths (`orders.ts` lines 47–51, 78–93).
- Diner profiles are **global** across restaurants by design (issue #5) — preferences follow the diner, not the venue.

**Gaps:**

- No `restaurant_id` on `diner_profiles` — cross-restaurant memory is intentional but needs **privacy policy** and consent.
- No Postgres policies if you later expose Supabase Realtime to browsers.

**Effort:** Keep service-role-only + audit routes = **S** ongoing; add RLS + Supabase Auth for owner/diner = **L**.

### 2.6 Security

#### Secrets and exposure

- **Good:** No `NEXT_PUBLIC_` Supabase keys; service role documented server-only (`.env.example`, `CLAUDE.md`).
- **Risk:** All LLM keys live in Vercel env; co-partner account access = full data and spend.
- **Voice:** `/api/voice/session` mints OpenAI client secrets (`voice/session/route.ts` lines 41–69) — anyone can request keys if they know a valid `restaurantId`.

#### Open endpoints (no auth, no rate limits)

Documented in `src/lib/requests.ts` lines 2–4. Public routes:

- `/api/chat` — expensive Claude Opus 5.5 default (`chat/route.ts` line 14), up to 80 history messages, 600 KB body.
- `/api/voice/session` — new Realtime session per POST.
- `/api/scrape` — Jina + OpenAI, up to ~60s.
- `/api/orders`, `/api/profile`.

**No app-level rate limiting** (no middleware, no Upstash). Only provider 429 handling for Claude (`chat/route.ts` lines 71–72).

#### Prompt injection via scraped menus

- **Extraction:** Strong instruction to treat site content as data (`extract.ts` line 14).
- **Ordering:** Full menu text embedded in system prompt (`instructions.ts` lines 9–17, 36–37); hostile descriptions can influence the agent.
- **`[Screen]` trust:** Model told to trust client-supplied screen state (`instructions.ts` line 33); `/api/chat` accepts client-built `history` (validated shape/size only).

**Mitigations that matter for go-live:**

- Owner **menu review/approve** step before QR goes live.
- Strip or truncate descriptions in prompts; delimit menu block as untrusted data.
- Server-signed cart snapshot instead of trusting `[Screen]` from raw API callers.

**Financial safety:** Server reprices orders (`orders/route.ts` + `priceCart`) — injection cannot set arbitrary prices on submit.

#### Abuse and cost controls

| Vector | Impact | Priority |
| --- | --- | --- |
| Scrape spam | OpenAI + Jina spend | P0 |
| Chat/voice spam | Anthropic + OpenAI spend | P0 |
| Fake orders | Kitchen noise, DB growth | P1 |
| Profile spam | DB writes | P2 |

**Controls to add:** Vercel Firewall or edge rate limits, per-IP quotas on scrape/chat/voice, optional CAPTCHA on `/restaurant`, spend alerts on API dashboards, cheaper default chat model for production (e.g. Sonnet vs Opus — today `CLAUDE_MODEL` defaults to `claude-opus-5-5`).

**Effort:** Basic rate limits + alerts = **M**; full abuse pipeline = **L**.

### 2.7 Reliability

- **Single-region Vercel serverless** — cold starts possible; scrape uses `maxDuration = 60` (`scrape/route.ts` line 10).
- **No health check endpoint** — smoke script doubles as synthetic monitoring (`check-smoke.mjs`).
- **No CI** — no `.github/workflows`; regressions depend on someone running scripts locally.
- **Manual deploys** — README lines 55–61; drift between GitHub `main` and production is likely (production already broken).
- **Scrape fallback:** Saved menu on timeout/failure for **known URLs only** (`scrape/route.ts` lines 12–15, 63–65); uploads have no fallback.

**Effort:** Git push deploy + CI running `check:menu`, `check:scrape`, `build` = **S**; scheduled production smoke = **S**.

### 2.8 Privacy / PDPA (diner memory)

**Personal data held:**

- Anonymous cookie `grub_diner` (1 year, httpOnly — `diner-profile.ts` lines 9–10).
- Optional phone number (unverified).
- Preferences (allergy/diet/like) and order history (last 20 — `profile/route.ts` line 6).
- Orders may store `diner_id` (`orders/route.ts` line 38); kitchen view strips diner identity.

**PDPA gaps for Singapore:**

- No privacy policy, consent banner, or purpose limitation text in app.
- No data export; erasure is partial (forget preference, unlink order from diner via `diner_id: null` — not full row delete).
- Demo phone linking allows **account takeover** by guessing phone (`profile/route.ts` lines 14–16).
- Cross-restaurant memory requires clear **opt-in** and retention limits.
- No DPA with subprocessors (Anthropic, OpenAI, Jina, Vercel, Supabase) documented for restaurants.

**Effort:** Policy + consent + disable production phone link until OTP = **M**; full erasure/export APIs = **M**; OTP linking = **M**.

---

## 3. Ownership and infrastructure

### 3.1 Current state (from README and verification docs)

| Asset | Current owner | Issue |
| --- | --- | --- |
| Vercel project `sg-opus-dev-day` | `priyadharshan-kannans-projects` | Tanveer cannot deploy or rotate secrets independently |
| Supabase `opus5.5-build-day` | Co-partner project | Credentials not in Tanveer’s control; production DB errors suggest pause, key rotation, or missing seed |
| GitHub `tanveerriaz/sg-opus-dev-day` | Tanveer | Source of truth; **not wired to auto-deploy** |
| API keys (Anthropic, OpenAI, Jina) | Stored on co-partner Vercel | OpenAI **401** on live scrape suggests invalid key |

### 3.2 Target state

1. **Vercel** under Tanveer’s team — import GitHub repo, Production + Preview environments.
2. **Supabase** new project in Tanveer’s org — run `supabase/migrations/0001_init.sql` and `0002_orders_served_at.sql`, then `npm run seed`.
3. **Environment variables** (from `.env.example`):

   - Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
   - Onboarding: `OPENAI_API_KEY` (extraction + voice fallback chat)
   - Optional: `JINA_API_KEY`, `CLAUDE_MODEL`, `OPENAI_*` model overrides

4. **Git-based deploys** — push to `main` → production; PR previews for QA.
5. **Monitoring:**
   - Uptime: synthetic `check:smoke` against production URL (cron/GitHub Action).
   - Logs: Vercel log drains; Supabase dashboard for DB errors.
   - Cost: Anthropic/OpenAI usage dashboards + billing alerts.

6. **Domains:** Custom domain (e.g. `grub.sg` or subdomain) with HTTPS for voice and QR.

**Effort:** Migration weekend = **M** (mostly ops, not code).

### 3.3 Running-cost estimate (one restaurant, order of magnitude)

Assumptions: ~30 covers/day, 50% use chat, 10% use voice, 1 menu scrape/month, small Supabase row counts.

| Service | Pilot usage | Approx. monthly (USD) |
| --- | --- | --- |
| Vercel (Pro) | 1 project, moderate bandwidth | $20 + usage |
| Supabase (Pro) | Low storage, API via server only | $25 |
| Anthropic (chat) | ~500 turns/mo, Sonnet-class with caching | $15–80 (Opus much higher) |
| OpenAI (voice + scrape) | ~50 voice sessions + 1 scrape | $20–100 |
| Jina Reader | Occasional scrapes | $0–20 |
| **Total** | | **~$80–250/mo per active venue** plus fixed Vercel/Supabase base |

**Cost levers:** Default to **cheaper Claude model** in production; disable voice for pilot; cache menus aggressively; rate-limit scrape to owners only.

At **10 restaurants** sharing one deployment, infra base is shared; **LLM cost scales with diner usage**, not tenant count.

---

## 4. GitHub issues and documentation

### 4.1 Issues (all closed)

| # | Title | Status |
| --- | --- | --- |
| 1 | Deployed skeleton with seed restaurant | Closed |
| 2 | Text agent takes an order | Closed |
| 3 | Live scrape → menu → QR | Closed |
| 4 | Kitchen dashboard | Closed |
| 5 | Memory across restaurants | Closed |
| 6 | Realtime voice | Closed |

**No open issues** as of 22 October 2026 — follow-up work is not tracked in GitHub yet.

### 4.2 Useful docs

- `README.md` — setup, deploy caveats, acceptance checks
- `docs/menu-format.md` — shared menu contract
- `docs/verification/issue-3.md` — scrape/QR verification (13 Oct; predates current production outage)
- `docs/design-system/README.md` — UX/spec guidance for future polish
- `docs/agents/*` — agent workflow for issues/triage

---

## 5. Prioritised phased plan

Effort key: **S** ≈ 1–2 focused dev days, **M** ≈ 3–7 days, **L** ≈ 1–3 weeks (single experienced developer, excluding legal review).

### Phase 0 — Restore trust in production (prerequisite)

| # | Work | Effort |
| --- | --- | --- |
| 0.1 | Move Vercel + Supabase to Tanveer; configure env vars; `npm run seed` | M (ops) |
| 0.2 | Connect GitHub → auto deploy; add CI: `check:menu`, `check:scrape`, `build` | S |
| 0.3 | Fix production until `check:smoke` passes on public URL | S |
| 0.4 | Rotate all API keys; document who has access | S |

### Phase 1 — Minimum to pilot (one real restaurant, pay at counter)

**Goal:** One venue runs lunch service with QR on tables, kitchen tablet on dashboard, no payments in-app.

| # | Work | Effort |
| --- | --- | --- |
| 1.1 | Restaurant owner sign-in; bind scraped restaurant to owner | M |
| 1.2 | Dashboard secret token (or staff PIN) | S–M |
| 1.3 | Rate limits on `/api/chat`, `/api/voice/session`, `/api/scrape`, `/api/orders` | M |
| 1.4 | Disable unverified phone linking in production; cookie-only memory | S |
| 1.5 | Privacy notice + consent for memory; “pay at counter” copy locked | S |
| 1.6 | Menu review checklist for owner before QR download | S |
| 1.7 | Cheaper production `CLAUDE_MODEL`; spend alerts | S |
| 1.8 | Optional: audible new-order on dashboard | S |
| 1.9 | Runbook: re-scrape menu, rotate dashboard link, support contact | S |

**Phase 1 exit criteria:**

- Owner can onboard without others overwriting their menu.
- Diners complete order end-to-end on real phones (HTTPS).
- Kitchen sees orders within polling interval; can mark served.
- Production smoke + weekly cron green.
- Written agreement with pilot venue: counter payment, allergen disclaimer, AI menu accuracy.

### Phase 2 — Pilot hardening (4–8 weeks of real use)

| # | Work | Effort |
| --- | --- | --- |
| 2.1 | OTP phone linking; PDPA erasure/export | M |
| 2.2 | Table-specific QR (signed `t` param) | M |
| 2.3 | Prompt hardening (menu delimiters, signed cart state) | M |
| 2.4 | Order notifications (email/WhatsApp/web push) | M |
| 2.5 | Owner menu editor (not only re-scrape) | M |
| 2.6 | Analytics: orders/day, agent failures, scrape errors | M |

### Phase 3 — Scale to many Singapore venues

| # | Work | Effort |
| --- | --- | --- |
| 3.1 | Stripe + PayNow (or explicit POS export) | L |
| 3.2 | Multi-location / chains | L |
| 3.3 | RLS + Supabase Auth for diners/owners | L |
| 3.4 | Delivery mode or integration | L |
| 3.5 | SLA, support tier, billing per restaurant | L |

---

## 6. Minimum to pilot (checklist)

Use this as the gate before inviting a real restaurant:

- [ ] Production on **Tanveer’s** Vercel + Supabase; secrets rotated
- [ ] `npm run check:smoke -- https://<prod>` passes
- [ ] Seed or pilot restaurant row exists; `npm run check:db` passes against prod credentials
- [ ] Owner auth protects `/api/scrape` for existing restaurants
- [ ] Kitchen dashboard requires secret token
- [ ] Rate limits on chat, voice, scrape, orders
- [ ] Phone linking disabled or OTP-verified
- [ ] Privacy policy linked from diner and memory UI
- [ ] Venue signs off on AI menu accuracy and allergen disclaimers (`docs/design-system/README.md` line 73)
- [ ] Pay-at-counter (or payment) clearly stated in UI and agent
- [ ] On-call/runbook for “menu wrong / kitchen down / agent 503”
- [ ] Cost alerts on Anthropic and OpenAI

---

## 7. Key file index

| Area | Files |
| --- | --- |
| Onboarding & QR | `src/app/restaurant/*`, `src/app/api/scrape/route.ts`, `src/lib/scrape/*` |
| Diner UI | `src/components/diner/*`, `src/app/r/[id]/page.tsx` |
| Agent | `src/lib/agent/instructions.ts`, `tools.ts`, `src/app/api/chat/route.ts`, `src/app/api/voice/session/route.ts` |
| Orders & kitchen | `src/app/api/orders/route.ts`, `src/lib/orders.ts`, `src/app/r/[id]/dashboard/*` |
| Memory / PDPA | `src/lib/diner-profile.ts`, `src/app/api/profile/route.ts`, `useMemory.tsx` |
| Data model | `supabase/migrations/*.sql`, `src/lib/menu.ts` |
| Verification | `scripts/check-smoke.mjs`, `scripts/check-scrape.cjs`, `scripts/check-menu.mjs`, `scripts/check-db.mjs` |
| Ops | `README.md`, `.env.example` |

---

## 8. Recommended immediate next steps for Tanveer

1. **Fork infrastructure, not code** — new Vercel + Supabase under your accounts; import this repo with auto-deploy.
2. **File GitHub issues** for Phase 0 and Phase 1 items so work is trackable again.
3. **Run smoke on production** after cutover; do not announce the old co-partner URL until green.
4. **Pick pilot payment model** — recommend **pay at counter** for first venue to avoid PCI scope.
5. **Recruit one forgiving restaurant** (friends & family) with a simple menu and patient staff for a two-week trial.

This document should be updated after infrastructure migration and after the first pilot week with real order volumes and incident notes.
