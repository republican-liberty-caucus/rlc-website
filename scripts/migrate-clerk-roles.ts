/**
 * Migrate Clerk publicMetadata role values from old chapter_* to new charter_* names.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/migrate-clerk-roles.ts           # live
 *   tsx --env-file=.env.local scripts/migrate-clerk-roles.ts --dry-run # preview
 */

import { createClerkClient } from '@clerk/backend';

const ROLE_MAP: Record<string, string> = {
  chapter_officer: 'charter_officer',
  chapter_admin: 'charter_admin',
};

const dryRun = process.argv.includes('--dry-run');
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  console.log(`\n=== Clerk Role Migration (${dryRun ? 'DRY RUN' : 'LIVE'}) ===\n`);

  let migrated = 0;
  let skipped = 0;
  let offset = 0;
  const limit = 100;

  // Paginate through all Clerk users
  while (true) {
    const users = await clerk.users.getUserList({ limit, offset });

    if (users.data.length === 0) break;

    for (const user of users.data) {
      const meta = user.publicMetadata as Record<string, unknown> | undefined;
      const currentRole = meta?.role as string | undefined;

      if (!currentRole || !ROLE_MAP[currentRole]) {
        if (currentRole) {
          console.log(`  [SKIP] ${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.id}: role="${currentRole}" (already migrated or not applicable)`);
        } else {
          console.log(`  [SKIP] ${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.id}: no role set`);
        }
        skipped++;
        continue;
      }

      const newRole = ROLE_MAP[currentRole];
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.id;

      if (dryRun) {
        console.log(`  [DRY RUN] ${name}: ${currentRole} → ${newRole}`);
      } else {
        await clerk.users.updateUserMetadata(user.id, {
          publicMetadata: { role: newRole },
        });
        console.log(`  Updated ${name}: ${currentRole} → ${newRole}`);
      }

      migrated++;
    }

    if (users.data.length < limit) break;
    offset += limit;
  }

  console.log(`\n  Total scanned: ${migrated + skipped}`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (no old role): ${skipped}`);
  if (dryRun) console.log(`\n  ** DRY RUN — no changes made **`);
  console.log();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
