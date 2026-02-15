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

## Migration Rules

1. **Always use Prisma for schema migrations** — never use Supabase MCP `apply_migration`, raw `psql` DDL, or `prisma db execute` for schema changes. The workflow is: write migration SQL in `prisma/migrations/`, then `prisma migrate deploy`.
2. **Always verify actual column types before writing migration SQL** — check referenced tables with `psql` to confirm data types (e.g., `rlc_members.id` and `rlc_charters.id` are TEXT, not UUID). Never assume UUID for FK columns.
3. **Use `.env` for Prisma commands, not `.env.production.local`** — the `.env.production.local` file (from `vercel env pull`) has quoted values with trailing `\n` that can cause connection issues. Prisma's own `.env` file has clean URLs.
4. **`psql` for data-only operations** — INSERT, UPDATE, DELETE, and SELECT queries are fine via `psql`. Only DDL (CREATE TABLE, ALTER TABLE, etc.) must go through Prisma migrations.

## Dues Sharing Architecture

- `lib/dues-sharing/split-engine.ts` — Core split calculation + charter resolution
- `lib/dues-sharing/transfer-engine.ts` — Stripe Connect transfers
- `lib/dues-sharing/constants.ts` — National fee, charter IDs
- Stripe webhook (`app/api/webhooks/stripe/route.ts`) calls `processDuesSplit()` after creating contributions
- Charter auto-assignment: `resolveCharterByState()` matches `rlc_members.state` → `rlc_charters.state_code`
