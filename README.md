# QR Ordering Agent

Paste a restaurant's website, get a QR code. Diners scan it and order by chatting (or talking) to an agent that remembers their preferences across every restaurant.

Tickets: https://github.com/tanveerriaz/sg-opus-dev-day/issues · Menu format: [docs/menu-format.md](docs/menu-format.md)

## Setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a Supabase project, open its **SQL editor**, and run `supabase/migrations/0001_init.sql`.

3. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API).

4. Load the seed restaurant:

   ```bash
   npm run seed
   ```

5. Run it locally and open http://localhost:3000/r/kopi-satay-house?mode=table&t=12:

   ```bash
   npm run dev
   ```

   Without the Supabase env vars, the app still serves the seed restaurant from `src/data/seed-restaurant.json`, so the UI can be worked on before Supabase is set up.

## Deploy

Phones need a public HTTPS URL to scan, so deploy early.

1. Push this folder to the GitHub repo.
2. In Vercel, **Add New → Project**, import the repo, and add the same env vars as `.env.local`.
3. Open `https://<your-app>.vercel.app/r/kopi-satay-house?mode=table&t=12` on a phone.

## Acceptance checks for issue #1

Use Node.js 22 or later. The committed lockfile makes dependency installation reproducible.

```bash
npm run check:menu
npm run build
npm run check:db
```

`check:db` reads `.env.local` if present, or credentials already set in the environment. It checks that all three tables are accessible and the stored restaurant matches the seed. It never writes data. Missing configuration fails the check; the local JSON fallback does **not** satisfy the Supabase acceptance criterion.

Start the production server with `npm start`, then run:

```bash
npm run check:smoke -- http://localhost:3000
```

After deploying, run the same command with the public HTTPS origin. It checks the full seed menu, allergen wording, table/pickup/delivery context, default context, and an unknown restaurant's 404 response. Deployment protection must allow unauthenticated access to the production diner link.

Before marking issue #1 complete, open the production table-12 link on a physical phone and confirm the menu and table number render. A desktop browser at mobile width is a useful layout check, but does not satisfy that final acceptance step.

### Verification on 13 October 2026

- Production build and TypeScript validation: passed.
- Seed contract: passed, 11 items including peanuts.
- Local production HTTP checks: passed for all five URL contexts and unknown restaurant.
- 390px browser viewport: all 11 items present, no horizontal overflow.
- Dependency audit after PostCSS patch: zero reported vulnerabilities.
- Live Supabase connection, public Vercel deployment, and physical-phone check: pending account/project access. No deployed URL has been verified.
