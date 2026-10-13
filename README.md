# QR Ordering Agent

Paste a restaurant's website, get a QR code. Diners scan it and order by chatting (or talking) to an agent that remembers their preferences across every restaurant.

Tickets: https://github.com/tanveerriaz/sg-opus-dev-day/issues · Menu format: [docs/menu-format.md](docs/menu-format.md)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project, open its **SQL editor**, and run `supabase/migrations/0001_init.sql`.

3. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API), and `ANTHROPIC_API_KEY` for the ordering agent (Claude Console → API keys).

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
