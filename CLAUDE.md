# CLAUDE.md - RLC Website Backend

## Project

Republican Liberty Caucus (RLC) website backend — Next.js 14 + Supabase (PostgreSQL).

## Infrastructure

- **Supabase Project:** `lbwqtrymxjbllaqystwr` (RLC Operations)
  - Org: `plrvhsvhxrhxpeauyitq` (NOT in Matt's personal Supabase MCP org — use `supabase` CLI or `vercel env pull` + `psql` for database access)
  - Region: us-east-2
- **Vercel Project:** `republican-liberty-caucus/rlc-website`
- **Migrations:** Prisma (`prisma/migrations/`) — use `prisma migrate deploy` via CI/CD, or `psql` for data-only DML

## Key IDs

- **National Charter:** `992d53d0-f25a-45da-af27-67a4b82193f0` (Republican Liberty Caucus)
- **National flat fee:** $15.00 (1500 cents) — defined in `lib/dues-sharing/constants.ts`

## Database Access Pattern

```bash
# Link project (one-time)
supabase link --project-ref lbwqtrymxjbllaqystwr

# Pull env for psql access
vercel env pull .env.vercel --environment production
# Parse DATABASE_URL or DIRECT_URL from .env.vercel
# REMEMBER: Delete .env.vercel after use (contains secrets)
```

## Dues Sharing Architecture

- `lib/dues-sharing/split-engine.ts` — Core split calculation + charter resolution
- `lib/dues-sharing/transfer-engine.ts` — Stripe Connect transfers
- `lib/dues-sharing/constants.ts` — National fee, charter IDs
- Stripe webhook (`app/api/webhooks/stripe/route.ts`) calls `processDuesSplit()` after creating contributions
- Charter auto-assignment: `resolveCharterByState()` matches `rlc_members.state` → `rlc_charters.state_code`
