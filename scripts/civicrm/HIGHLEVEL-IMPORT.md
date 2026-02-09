# HighLevel Member Import & Sync

## Overview

Since July 2024, ~200 members signed up via HighLevel (GoHighLevel) payment forms due to CiviCRM platform issues. This system imports those members into Supabase and establishes bidirectional sync to keep both systems aligned.

**Goal:** Supabase is the single source of truth. HighLevel is a marketing tool with read-only membership metadata.

## Architecture

```
┌──────────────┐                    ┌──────────────┐
│   Supabase   │                    │  HighLevel   │
│ (Source of   │ ◄────── Import ─── │  (Marketing  │
│   Truth)     │                    │    Tool)     │
│              │ ────── Sync ─────► │              │
└──────────────┘        Nightly     └──────────────┘
                      (Membership
                        Metadata)
                            │
                         Webhook
                    (Contact Info Only)
                            ▼
                    ┌──────────────┐
                    │   Supabase   │
                    └──────────────┘
```

## Data Flow

### Direction 1: HighLevel → Supabase (ONE-TIME IMPORT)

**Script:** `scripts/civicrm/import-highlevel.ts`

**Purpose:** Import existing HighLevel members to Supabase (run once)

**What syncs:**
- Contact info (name, email, phone, address)
- Membership tier (parsed from tags or custom fields)
- Membership status (parsed from tags or custom fields)
- Membership dates (from custom fields)

**Deduplication Logic:**
1. Match by email (primary key)
2. If existing contact found:
   - Has CiviCRM ID but no HighLevel ID? → Link HighLevel ID, update data
   - Has same HighLevel ID? → Update with latest data
   - Has different HighLevel ID? → Skip, log conflict for manual review
3. If no match found → Create new contact

### Direction 2: Supabase → HighLevel (ONGOING SYNC)

**Script:** `scripts/civicrm/sync-highlevel.ts`

**Purpose:** Push membership updates from Supabase to HighLevel for marketing segmentation

**Schedule:** Nightly cron or on-demand

**What syncs:**
- Contact info (name, email, phone, address)
- Membership metadata (tier, status, dates) as tags and custom fields

**Important:** HighLevel does NOT manage payments or subscriptions. It only receives membership info for marketing campaigns.

### Direction 3: HighLevel → Supabase (LIVE UPDATES)

**Handler:** `app/api/webhooks/highlevel/route.ts`

**Purpose:** Real-time webhook updates when contact info changes in HighLevel

**What syncs:** Contact info ONLY (name, email, phone)

**What does NOT sync:** Membership tier, status, dates, payments

**Why:** Ensures Supabase remains the single source of truth for membership data. HighLevel can only update contact details.

## Member Identification

A contact qualifies as a member if ANY of these are true:

1. Has any tag matching patterns (case-insensitive):
   - `RLC Member`
   - `Member`
   - `membership type - *`
   - `Student/Military Member`
   - `Individual Member`
   - `Premium Member`
   - `Sustaining Member`
   - `Patron Member`
   - `Benefactor Member`
   - `Roundtable Member`

2. Has custom field `membership_type_id` or `membership_status_id`

## Tag Mappings

### Tier Tags (Supabase → HighLevel)

| Supabase Tier | HighLevel Tag |
|---------------|---------------|
| `student_military` | `Student/Military Member` |
| `individual` | `Individual Member` |
| `premium` | `Premium Member` |
| `sustaining` | `Sustaining Member` |
| `patron` | `Patron Member` |
| `benefactor` | `Benefactor Member` |
| `roundtable` | `Roundtable Member` |

### Status Tags (Supabase → HighLevel)

| Supabase Status | HighLevel Tag |
|----------------|---------------|
| `new_member` | `Membership: New` |
| `current` | `Membership: Current` |
| `grace` | `Membership: Grace` |
| `expired` | `Membership: Expired` |
| `pending` | `Membership: Pending` |
| `cancelled` | `Membership: Cancelled` |
| `deceased` | `Membership: Deceased` |
| `expiring` | `Membership: Expiring` |

### Custom Fields (Supabase → HighLevel)

| Supabase Field | HighLevel Custom Field |
|----------------|----------------------|
| `membership_tier` | `membership_type_id` |
| `membership_status` | `membership_status_id` |
| `id` | `membership_id` |
| `membership_start_date` | `membership_start_date` |
| `membership_expiry_date` | `membership_end_date` |
| `membership_join_date` | `membership_join_date` |
| `membership_join_date` | `membership_join_date_initial` |
| `civicrm_contact_id` | `civicrm_id` |
| `charter_state_code` | `charter_state` |
| `contribution_source` | `membership_source` |

## Usage

### Phase 0: Create Snapshot (REQUIRED BEFORE IMPORT)

**CRITICAL:** Always create a snapshot before running the import. This allows you to rollback if anything goes wrong.

```bash
# Create snapshot of current database state
pnpm snapshot:highlevel
```

This creates a timestamped snapshot file in `scripts/civicrm/data/` with all current contacts. The snapshot includes:
- All contact data (names, emails, addresses)
- All membership data (tier, status, dates)
- Current HighLevel IDs (if any)
- Current CiviCRM IDs (if any)

### Phase 1: Initial Import (ONE-TIME)

```bash
# 1. Dry run to preview
pnpm import:highlevel --dry-run

# 2. Small batch test (first 10 members)
pnpm import:highlevel --batch=10

# 3. Validate test results
pnpm validate:highlevel

# 4. Full import (all members)
pnpm import:highlevel

# 5. Validate results
pnpm validate:highlevel
```

### Phase 2: Ongoing Sync (RECURRING)

```bash
# Push Supabase updates to HighLevel
pnpm sync:highlevel

# Or with custom batch size
pnpm sync:highlevel --batch=100
```

### Phase 3: Webhook Verification (AUTOMATED)

Webhook URL: `https://yourdomain.com/api/webhooks/highlevel`

Webhook events subscribed:
- `contact.created`
- `contact.updated`
- `opportunity.created`

**IMPORTANT:** Webhook only updates contact info, NOT membership data.

## Rollback Procedure

If the import goes wrong, you can safely revert to the pre-import state using the snapshot.

### When to Rollback

Rollback if you encounter:
- Unexpected number of imports (too many or too few)
- Data quality issues (wrong tiers, missing emails, etc.)
- Duplicate HighLevel IDs
- Validation failures
- Any import errors you're not comfortable with

### How to Rollback

```bash
# 1. Preview rollback (dry-run)
pnpm rollback:highlevel --dry-run

# 2. Execute rollback (uses latest snapshot)
pnpm rollback:highlevel

# 3. Or use specific snapshot file
pnpm rollback:highlevel --file=highlevel-snapshot-2024-02-09.json
```

### What Rollback Does

1. **Deletes contacts created during import:**
   - Contacts that have `highlevel_contact_id` but were not in the snapshot
   - Typically these are new members that only existed in HighLevel

2. **Restores contacts modified during import:**
   - Contacts that existed before but got `highlevel_contact_id` added
   - Restores all fields to their pre-import values
   - Preserves `civicrm_contact_id` (doesn't roll back CiviCRM links)

3. **Cleans up sync log:**
   - Removes all `action='import'` entries from `rlc_highlevel_sync_log`

### Rollback Safety

- **5-second warning:** Gives you time to cancel with Ctrl+C
- **Dry-run mode:** Preview changes before executing
- **Preserves CiviCRM data:** Never deletes or modifies `civicrm_contact_id`
- **Detailed logging:** Shows exactly what will be deleted/restored

### After Rollback

Once rolled back, you can:
1. Fix the issue that caused problems
2. Create a new snapshot: `pnpm snapshot:highlevel`
3. Try the import again with corrections

### Example Rollback Flow

```bash
# Something went wrong during import
pnpm import:highlevel
# Output: "Created: 500, Errors: 50" — Too many errors!

# Preview rollback
pnpm rollback:highlevel --dry-run
# Output: "Delete: 450, Restore: 50, Unchanged: 1000"

# Execute rollback
pnpm rollback:highlevel
# Output: "✅ Database restored to pre-import state."

# Validate rollback
pnpm validate:highlevel
# Should match pre-import counts

# Fix the issue, create new snapshot, try again
pnpm snapshot:highlevel
pnpm import:highlevel --dry-run
# Looks good now!
pnpm import:highlevel
```

## Validation Queries

Run these after import to verify data integrity:

```sql
-- Count members by source
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE civicrm_contact_id IS NOT NULL) as from_civicrm,
  COUNT(*) FILTER (WHERE highlevel_contact_id IS NOT NULL) as from_highlevel,
  COUNT(*) FILTER (WHERE civicrm_contact_id IS NOT NULL
                   AND highlevel_contact_id IS NOT NULL) as both_sources
FROM rlc_members;

-- Check for duplicate HighLevel IDs
SELECT highlevel_contact_id, COUNT(*) as count
FROM rlc_members
WHERE highlevel_contact_id IS NOT NULL
GROUP BY highlevel_contact_id
HAVING COUNT(*) > 1;

-- Review sync log
SELECT action, status, COUNT(*) as count
FROM rlc_highlevel_sync_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY action, status;

-- Members with HighLevel ID but no email
SELECT id, highlevel_contact_id
FROM rlc_members
WHERE highlevel_contact_id IS NOT NULL
  AND email IS NULL;

-- Members with HighLevel ID but no tier
SELECT id, email, highlevel_contact_id
FROM rlc_members
WHERE highlevel_contact_id IS NOT NULL
  AND membership_tier IS NULL;
```

Or use the automated validation script:

```bash
pnpm validate:highlevel
```

## Expected Results

After successful import:

- ~200 HighLevel members imported to Supabase
- All members linked via `highlevel_contact_id`
- CiviCRM members with HighLevel signups have both IDs
- Zero duplicate HighLevel IDs in database
- Sync log shows 95%+ success rate
- Supabase established as single source of truth

## Rate Limits

HighLevel API limits: **100 requests per 10 seconds per location**

Scripts use 100ms delay between requests = 10 req/sec (well under limit)

## Troubleshooting

### Issue: Import script finds 0 members

**Cause:** Tags in HighLevel may have different casing or format

**Solution:** Check actual tags with debug mode:
```typescript
// Add this to import script temporarily
console.log('Sample tags:', allContacts.slice(0, 5).map(c => c.tags));
```

Then update `MEMBER_TAG_PATTERNS` in `import-highlevel.ts`

### Issue: Duplicate HighLevel IDs

**Cause:** Same HighLevel contact linked to multiple Supabase members

**Solution:** Manual review required. Query:
```sql
SELECT highlevel_contact_id, array_agg(email) as emails
FROM rlc_members
WHERE highlevel_contact_id IS NOT NULL
GROUP BY highlevel_contact_id
HAVING COUNT(*) > 1;
```

Decide which email is correct and update the others.

### Issue: Webhook not updating contacts

**Cause:** Signature verification failure or missing env var

**Solution:**
1. Check `HIGHLEVEL_WEBHOOK_SECRET` is set in `.env.local`
2. Verify HighLevel webhook configuration has correct URL and secret
3. Check webhook logs in HighLevel dashboard
4. Check Supabase logs: `SELECT * FROM rlc_highlevel_sync_log ORDER BY created_at DESC LIMIT 10;`

### Issue: Members missing tier or status

**Cause:** Tags not recognized or custom fields not set in HighLevel

**Solution:**
1. Check actual tags in HighLevel contact
2. Update `MEMBER_TAG_PATTERNS` if needed
3. Manually set tier/status in Supabase for those members
4. Re-sync to HighLevel: `pnpm sync:highlevel`

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `snapshot-before-highlevel.ts` | Create pre-import snapshot for rollback | `pnpm snapshot:highlevel` |
| `import-highlevel.ts` | One-time import of HighLevel members | `pnpm import:highlevel` |
| `validate-highlevel-import.ts` | Post-import validation | `pnpm validate:highlevel` |
| `rollback-highlevel.ts` | Revert import to pre-snapshot state | `pnpm rollback:highlevel` |
| `sync-highlevel.ts` | Ongoing sync Supabase → HighLevel | `pnpm sync:highlevel` |
| `app/api/webhooks/highlevel/route.ts` | Real-time webhook handler | Automatic (via webhook) |

## Files Modified

### Created:
- `scripts/civicrm/snapshot-before-highlevel.ts` - Pre-import snapshot for rollback
- `scripts/civicrm/import-highlevel.ts` - Main import script
- `scripts/civicrm/validate-highlevel-import.ts` - Validation script
- `scripts/civicrm/rollback-highlevel.ts` - Rollback script to revert import
- `scripts/civicrm/HIGHLEVEL-IMPORT.md` - This documentation

### Modified:
- `lib/highlevel/client.ts` - Added `listContacts()` function
- `package.json` - Added import and validation scripts

### Verified (no changes):
- `app/api/webhooks/highlevel/route.ts` - Confirmed it only syncs contact info, not membership data
- `lib/highlevel/tags.ts` - Tag mappings already defined
- `scripts/civicrm/sync-highlevel.ts` - Supabase → HighLevel sync already implemented
- `prisma/schema.prisma` - Contact model has `highlevel_contact_id` field

## Payment & Subscription Management

**CRITICAL:** HighLevel does NOT manage payments or subscriptions.

✅ **Managed in Supabase via Stripe integration only**
❌ **HighLevel Stripe integration disabled/not used**
❌ **HighLevel does not create/update memberships**
✅ **HighLevel only receives membership metadata for marketing segmentation**

All payment processing flows through Stripe → Supabase. HighLevel is purely a marketing tool.
