## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `tanveerriaz/sg-opus-dev-day` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project

Next.js (App Router) + Supabase + OpenAI, deployed on Vercel. The shared menu format lives in `src/lib/menu.ts` (explained in `docs/menu-format.md`); every feature builds against it, so don't change it without flagging it. Supabase is accessed only from the server with the service role key.
