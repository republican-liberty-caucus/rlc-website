# RLC Website Project Status — 2026-02-08 1:30am PST

## Git State
- **Branch:** `main`
- **Latest commit:** `5705013` — Merge PR #56 (Phase 5)
- **Working tree:** Clean
- **Repo:** `republican-liberty-caucus/rlc-website`

## Phases Complete (all merged to main)
- **Phase 0:** Schema & CiviCRM Migration (code done, epic #1 open — blocked by #10 data migration run)
- **Phase 1:** Core Member Portal (all sub-issues #12-#19 closed, epic #11 closed)
- **Phase 2:** Admin & Chapter Management (epic #20 closed)
- **Phase 3:** Events & Content (epic #28 closed)
- **Phase 4:** Advanced Features (epic #35 closed)
- **Phase 5:** Liberty Scorecard & Action Center (PR #56 merged, epic #40 closed, issues #41-#49 closed)

## Open Issues (6 remaining)
- #1 — Epic: Phase 0 (blocked by #10)
- #10 — Run CiviCRM export and full migration to Supabase
- #52 — Sanitize HTML content in blog post rendering (tech-debt)
- #53 — Add atomic capacity check for event registration (tech-debt)
- #54 — Add Stripe webhook idempotency via DB unique constraint (tech-debt)
- #55 — Add expiration to candidate survey access tokens (tech-debt)

## PENDING: Phase 5 Deployment (resume here)

### 1. Schema Push — NOT YET DONE
- `npx prisma db push` needs to run to create 6 new Phase 5 tables + 4 Phase 4 backfill models
- First attempt showed warnings about enum value removal (MembershipStatus: active/suspended; MembershipTier: supporter/member/lifetime/leadership) and new unique constraints
- Need to check if DB has data using those old enum values before using `--accept-data-loss`
- Database: `lbwqtrymxjbllaqystwr.supabase.co`

### 2. Vercel Env Vars — PARTIALLY DONE
- RLC Vercel account is authenticated: `reppublican-liberty-caucus`
- Team: `republican-liberty-caucus`
- Project: `republican-liberty-caucus/rlc-website`
- **50 env vars already configured** (Clerk, Stripe, Supabase, HighLevel, DB URLs — all envs)
- **Missing env vars (need API key signups first):**
  - `LEGISCAN_API_KEY` — https://legiscan.com/user/register then API Keys tab (free, 30K/month)
  - `ANTHROPIC_API_KEY` — https://console.anthropic.com/ (paid, for Claude bill analysis)
  - `GOOGLE_CIVIC_API_KEY` — Google Cloud Console, enable Civic Information API, create key (free)
  - `CRON_SECRET` — needs to be generated (for scorecard-votes cron job auth)

### 3. Missing from local .env
- Local `.env` only has `DATABASE_URL` and `DIRECT_URL`
- Run `vercel env pull .env.local` after Vercel setup to sync all vars locally

## Account Map
| Service | Account | Auth Status |
|---------|---------|-------------|
| GitHub (active) | `matthewdnye` | Authenticated |
| GitHub (org/repo ops) | `republican-liberty-caucus` | Authenticated (switch with `gh auth switch`) |
| Vercel | `reppublican-liberty-caucus` | Authenticated (team: republican-liberty-caucus) |
| Supabase | `lbwqtrymxjbllaqystwr` | Via DB URLs only (not in MCP-connected org) |

## Tech Stack Reminder
- Next.js 14+ App Router, TypeScript, Tailwind, shadcn/ui
- Prisma for schema definition, Supabase client for queries (NOT Prisma Client)
- Clerk auth, Stripe payments, HighLevel CRM sync
- Vercel AI SDK + Claude for bill analysis
- LegiScan API for legislative data
- Google Civic API for representative lookup
- Vercel Cron for daily scorecard vote import

## Schema Doc
- `docs/database-schema.md` — comprehensive docs for all 16 enums, 16 tables
