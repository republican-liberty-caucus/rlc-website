# HighLevel Import - Quick Start Guide

## Safe Import Workflow (Recommended)

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 1: Create Safety Snapshot
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pnpm snapshot:highlevel
# ✅ Creates: scripts/civicrm/data/highlevel-snapshot-YYYY-MM-DD.json


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 2: Preview Import (Dry-Run)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pnpm import:highlevel --dry-run
# Review output:
#   - How many members identified?
#   - Tiers look correct?
#   - Any unexpected contacts?


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 3: Small Batch Test (HIGHLY RECOMMENDED)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pnpm import:highlevel --batch=10

# Validate test batch
pnpm validate:highlevel

# Check database manually
# Look at the 10 imported members in Supabase


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 4: Full Import (if test looks good)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pnpm import:highlevel


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 5: Validate Results
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pnpm validate:highlevel
# All checks should pass (✅)
```

## If Something Goes Wrong - Rollback

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Preview Rollback (See What Would Change)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pnpm rollback:highlevel --dry-run


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Execute Rollback (Revert to Pre-Import State)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pnpm rollback:highlevel
# Gives you 5 seconds to cancel (Ctrl+C)
# Deletes contacts created during import
# Restores contacts modified during import


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# After Rollback: Try Again
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pnpm snapshot:highlevel  # Create fresh snapshot
pnpm import:highlevel --dry-run  # Review again
pnpm import:highlevel  # Import with fixes
```

## Quick Commands Reference

| Command | What It Does |
|---------|-------------|
| `pnpm snapshot:highlevel` | 📸 Save current database state |
| `pnpm import:highlevel --dry-run` | 👀 Preview import without changes |
| `pnpm import:highlevel --batch=10` | 🧪 Test import with 10 members |
| `pnpm import:highlevel` | ▶️ Run full import |
| `pnpm validate:highlevel` | ✅ Check import results |
| `pnpm rollback:highlevel --dry-run` | 👀 Preview rollback |
| `pnpm rollback:highlevel` | ↩️ Undo import (restore snapshot) |
| `pnpm sync:highlevel` | 🔄 Sync Supabase → HighLevel |

## What Each Step Protects Against

### ✅ Snapshot
- **Protects:** Complete data loss
- **Enables:** Full rollback capability
- **Time:** ~5 seconds
- **Risk if skipped:** ⚠️ HIGH - Can't undo import

### ✅ Dry-Run
- **Protects:** Unexpected bulk changes
- **Enables:** Preview before commit
- **Time:** ~10 seconds
- **Risk if skipped:** ⚠️ MEDIUM - May import wrong data

### ✅ Small Batch Test
- **Protects:** Large-scale data quality issues
- **Enables:** Manual inspection of real results
- **Time:** ~30 seconds
- **Risk if skipped:** ⚠️ MEDIUM - May not catch edge cases

### ✅ Validation
- **Protects:** Silent failures, data integrity issues
- **Enables:** Automated quality checks
- **Time:** ~5 seconds
- **Risk if skipped:** ⚠️ LOW - But you won't know if import succeeded

## Expected Results

After successful import:

```
===========================================
Import Complete
===========================================
Total Contacts:    ~200
Members:           ~200
Non-Members:       0
Created:           ~150  (new HighLevel-only members)
Updated:           0
Linked:            ~50   (had CiviCRM ID, now also HighLevel ID)
Skipped:           0
Errors:            0
===========================================
```

Validation should show:

```
✅ PASS: Member Source Distribution
   Total: 1200, CiviCRM: 1000, HighLevel: 200, Both: 50

✅ PASS: No Duplicate HighLevel IDs
   No duplicates found

✅ PASS: Sync Log Success Rate (last hour)
   100.0% (200/200 completed, 0 failed)

✅ PASS: All HighLevel Members Have Email
   All members have email

✅ PASS: All HighLevel Members Have Tier
   All members have tier
```

## Troubleshooting

### Import finds 0 members

**Fix:** Check tags in HighLevel. Update `MEMBER_TAG_PATTERNS` in `import-highlevel.ts` if needed.

### Duplicate HighLevel IDs

**Fix:** Run rollback, manually resolve duplicates, re-import.

### Wrong tiers assigned

**Fix:** Run rollback, update tier parsing logic in `extractMembershipData()`, re-import.

### Validation fails

**Fix:** Review specific validation failure, run rollback if needed, fix issue, re-import.

## Need More Details?

See full documentation: `scripts/civicrm/HIGHLEVEL-IMPORT.md`
