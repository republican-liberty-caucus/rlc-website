# CiviCRM Migration Scripts

Scripts for migrating data from CiviCRM to the new RLC website (Supabase + HighLevel).

## Prerequisites

1. Access to the CiviCRM database (read-only)
2. Supabase project configured with the RLC schema
3. HighLevel account with API access

## Migration Process

### Phase 1: Export Data from CiviCRM

1. Run the SQL queries in `export-queries.sql` against your CiviCRM database
2. Export results as JSON files and save to `scripts/civicrm/data/`:
   - `contacts.json` - All individual contacts
   - `memberships.json` - Membership records
   - `contributions.json` - Donation/payment records
   - `events.json` - Event records (optional)
   - `participants.json` - Event registrations (optional)

### Phase 2: Run Migration

```bash
# Dry run first (validates data without writing)
pnpm migrate:civicrm --dry-run

# Migrate contacts only
pnpm migrate:civicrm --contacts

# Full migration
pnpm migrate:civicrm

# Validate migration
pnpm migrate:civicrm --validate
```

### Phase 3: Sync to HighLevel

```bash
# Dry run
pnpm sync:highlevel --dry-run

# Full sync (with rate limiting)
pnpm sync:highlevel --batch=50
```

## Data Mapping

### Membership Tiers

| CiviCRM Type | Supabase Tier |
|--------------|---------------|
| General | member |
| Sustaining | sustaining |
| Lifetime | lifetime |
| Board Member | leadership |
| Student | supporter |

### Membership Status

| CiviCRM Status | Supabase Status |
|----------------|-----------------|
| New | pending |
| Current | active |
| Grace | active |
| Expired | expired |
| Cancelled | cancelled |
| Pending | pending |

### Contribution Types

| CiviCRM Type | Supabase Type |
|--------------|---------------|
| Member Dues | membership |
| Donation | donation |
| Event Fee | event_registration |

## Validation

After migration, verify:

1. **Contact counts match** - Compare CiviCRM contact count with Supabase members
2. **Contribution totals match** - Sum of completed contributions should be equal
3. **Membership status accuracy** - Spot-check member records
4. **HighLevel sync complete** - All members have `highlevel_contact_id`

## Troubleshooting

### Common Issues

1. **Duplicate emails**: CiviCRM may have duplicate contacts. The migration script uses upsert on `civicrm_contact_id` to handle this.

2. **Missing required fields**: Contacts without emails are skipped and logged.

3. **HighLevel rate limits**: The sync script includes rate limiting (100ms delay between requests).

### Recovery

If migration fails partway through:

1. Check `rlc_civicrm_migration_log` for failed records
2. Fix the underlying issue
3. Re-run migration (upsert handles duplicates)

## Files

- `export-queries.sql` - SQL queries to export CiviCRM data
- `migrate-civicrm.ts` - Main migration script
- `sync-highlevel.ts` - HighLevel sync script
- `data/` - Directory for exported JSON files (gitignored)
