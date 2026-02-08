# CiviCRM Data Export & Import

## Context

Phase 1 (profile save fix) is **done** — `app/api/v1/me/route.ts` now auto-creates member records via `getOrCreateMember()`. This plan covers Phase 2: exporting data from the legacy CiviCRM database and importing it into Supabase.

**Database**: `repl00_newrlc_civicrm_rebuilt_1` on `rlc.org` cPanel (MariaDB 10.5.26)
**Scope**: Members only — contacts with at least one membership or contribution record (~13K memberships, ~11K contributions, NOT all 192K contacts)
**Credentials**: user `repl00_admin`, password from `wp-config.php`, accessed via cPanel API

## Step 1: Modify Export PHP Script — Members-Only Contacts Query

A temporary PHP export script (`civicrm_export.php`) is already uploaded to `rlc.org/public_html`. It works and returns stats. The contacts query needs to be modified to only return contacts that have membership or contribution records:

```sql
-- Replace the contacts query with:
WHERE c.is_deleted = 0
  AND c.contact_type = 'Individual'
  AND (
    c.id IN (SELECT DISTINCT contact_id FROM civicrm_membership WHERE is_test = 0)
    OR c.id IN (SELECT DISTINCT contact_id FROM civicrm_contribution WHERE is_test = 0)
  )
```

Update the PHP script on the server via cPanel Fileman API with the members-only filter.

## Step 2: Export Data to JSON Files

Download each dataset via HTTP and save to `scripts/civicrm/data/`:

1. `contacts.json` — Members-only contacts (estimated few thousand)
2. `memberships.json` — All non-test memberships (~12,960)
3. `contributions.json` — All non-test contributions (~10,700)

Files saved to: `scripts/civicrm/data/` (gitignored)

## Step 3: Run Migration Script

Existing scripts handle everything:

1. **Dry run**: `pnpm migrate:civicrm --dry-run` — validates data, reports errors
2. **Contacts**: `pnpm migrate:civicrm --contacts` — import contacts first
3. **Full**: `pnpm migrate:civicrm` — memberships + contributions
4. **Validate**: `pnpm migrate:civicrm --validate` — verify counts

**Script**: `scripts/civicrm/migrate-civicrm.ts` (already built, reads from `data/` dir, upserts to Supabase)

## Step 4: Cleanup

- Delete `civicrm_export.php` from the server via cPanel Fileman API
- Verify `scripts/civicrm/data/` is in `.gitignore`

## Files Involved

- `scripts/civicrm/migrate-civicrm.ts` — Existing migration script (no changes needed)
- `scripts/civicrm/data/*.json` — Export data files (generated, gitignored)
- Temporary: `civicrm_export.php` on rlc.org server (uploaded via cPanel, deleted after)

## Verification

1. `contacts.json` has reasonable count (not 192K, should be a few thousand)
2. Dry run completes with 0 or minimal errors
3. After migration: `pnpm migrate:civicrm --validate` shows matching counts
4. Supabase `rlc_members` table has imported records with `civicrm_contact_id` populated
5. Export PHP script deleted from server

## Infrastructure Setup (Completed 2026-02-07)

| Service | Status | Details |
|---------|--------|---------|
| GitHub repo | Done | `republican-liberty-caucus/rlc-website` (mirrored from `matthewdnye/rlc-website`, old archived) |
| Vercel | Done | `rlc-website-ten.vercel.app`, Node 20.x, auto-deploy from main |
| Clerk | Done | Test keys configured (dev mode, no users yet) |
| Supabase | Done | `lbwqtrymxjbllaqystwr`, schema pushed via Prisma |
| HighLevel | Done | Location `eKU9X5pMPSlIjG2USRoE`, PIT token configured |
| Stripe | Done | Live keys (existing account shared with CiviCRM) |
| Resend | Pending | API key not yet configured |
| Custom domain | Pending | `rlc.org` not yet pointed to Vercel |
| Webhook secrets | Pending | Clerk, HighLevel, Stripe webhook endpoints not configured |
