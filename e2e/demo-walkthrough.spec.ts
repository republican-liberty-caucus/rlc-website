/**
 * RLC Platform Demo Walkthrough
 *
 * Single continuous video recording covering:
 *   Part 1 — Public pages
 *   Part 2 — Admin experience (Sarah Liberty)
 *   Part 3 — Member experience (James Freedom)
 *
 * Run:
 *   BASE_URL=https://2026.rlc.org DEMO_PAUSE_MS=2500 pnpm demo:record
 *
 * Video output: test-results/demo-walkthrough-{hash}/video.webm
 */

import { test, expect, type Page } from '@playwright/test';

const PAUSE_MS = parseInt(process.env.DEMO_PAUSE_MS || '2000', 10);

const ADMIN_EMAIL = 'demo-admin@example.com';
const MEMBER_EMAIL = 'demo-member@example.com';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for page to settle, then pause for the configured demo duration. */
async function demoPause(page: Page, ms = PAUSE_MS): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(ms);
}

/** Navigate to a path, wait for load, then pause. */
async function visit(page: Page, path: string, label: string): Promise<void> {
  console.log(`  >> ${label}: ${path}`);
  await page.goto(path);
  await demoPause(page);
}

/**
 * Sign in via Clerk sign-in token (bypasses device verification).
 * Creates a one-time token through the Clerk Backend API, then navigates
 * the browser to the SSO callback URL which sets the session cookie.
 */
async function clerkSignInWithToken(
  page: Page,
  email: string,
  label: string
): Promise<void> {
  console.log(`  >> Signing in as ${label} (${email}) via sign-in token`);

  // Look up the user ID from Clerk
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) throw new Error('CLERK_SECRET_KEY env var is required');

  const baseUrl = 'https://api.clerk.com/v1';
  const headers = {
    Authorization: `Bearer ${clerkSecretKey}`,
    'Content-Type': 'application/json',
  };

  // Find the user by email
  const usersRes = await fetch(
    `${baseUrl}/users?email_address=${encodeURIComponent(email)}&limit=1`,
    { headers }
  );
  if (!usersRes.ok) throw new Error(`Clerk user lookup failed: ${usersRes.status}`);
  const users = await usersRes.json();
  if (!users.length) throw new Error(`No Clerk user found for ${email}`);
  const userId = users[0].id;

  // Create a sign-in token for this user
  const tokenRes = await fetch(`${baseUrl}/sign_in_tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
  });
  if (!tokenRes.ok) throw new Error(`Clerk sign-in token creation failed: ${tokenRes.status}`);
  const { token } = await tokenRes.json();

  // Navigate to the app with the sign-in ticket — Clerk handles it automatically
  await page.goto(`/sign-in?__clerk_ticket=${token}`);

  // Wait for redirect away from sign-in (Clerk auto-redirects after accepting the ticket)
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), {
    timeout: 30000,
  });
  await demoPause(page);
  console.log(`  >> Signed in as ${label}`);
}

/** Sign out via Clerk's user button. */
async function clerkSignOut(page: Page): Promise<void> {
  console.log('  >> Signing out');
  // Click the Clerk UserButton (avatar in the header)
  const userButton = page.locator(
    '.cl-userButtonTrigger, button[data-clerk-component="UserButton"]'
  );
  if ((await userButton.count()) > 0) {
    await userButton.click();
    await page.waitForTimeout(500);

    const signOutBtn = page.locator(
      'button:has-text("Sign out"), [data-localization-key="userButton.action__signOut"]'
    );
    if ((await signOutBtn.count()) > 0) {
      await signOutBtn.click();
      await page.waitForURL((url) =>
        url.pathname === '/' || url.pathname.startsWith('/sign-in')
      , { timeout: 10000 });
      await demoPause(page, 1000);
      console.log('  >> Signed out');
      return;
    }
  }

  // Fallback: navigate to a page that forces sign-out or just go home
  await page.goto('/');
  await demoPause(page, 1000);
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('RLC Platform Demo Walkthrough', async ({ page }) => {
  test.setTimeout(600_000); // 10 minute budget

  // =====================================================================
  // PART 1: Public Pages (~90s)
  // =====================================================================
  console.log('\n=== PART 1: Public Pages ===\n');

  await visit(page, '/', 'Homepage');
  await visit(page, '/about', 'About');
  await visit(page, '/charters', 'Charters');
  await visit(page, '/events', 'Events');
  await visit(page, '/blog', 'Blog');
  await visit(page, '/scorecards', 'Scorecards');
  await visit(page, '/action-center', 'Action Center');
  await visit(page, '/endorsements', 'Endorsements');
  await visit(page, '/join', 'Join');
  await visit(page, '/donate', 'Donate');

  // =====================================================================
  // PART 2: Admin Experience (~120s)
  // =====================================================================
  console.log('\n=== PART 2: Admin Experience ===\n');

  let adminSignedIn = false;
  try {
    await clerkSignInWithToken(page, ADMIN_EMAIL, 'Sarah Liberty (Admin)');
    adminSignedIn = true;
  } catch (err) {
    console.warn('  !! Admin sign-in failed — skipping admin walkthrough');
    console.warn(`     ${err instanceof Error ? err.message : err}`);
  }

  if (adminSignedIn) {
    await visit(page, '/admin', 'Admin Dashboard');
    await visit(page, '/admin/members', 'Members');

    // Click into a member detail if rows exist
    const memberRow = page.locator('table tbody tr, [data-testid="member-row"]').first();
    if ((await memberRow.count()) > 0) {
      await memberRow.click();
      await demoPause(page);
      await page.goBack();
      await demoPause(page, 1000);
    }

    await visit(page, '/admin/charters', 'Charters');
    await visit(page, '/admin/events', 'Events');
    await visit(page, '/admin/posts', 'Posts');
    await visit(page, '/admin/scorecards', 'Scorecards');
    await visit(page, '/admin/surveys', 'Surveys');
    await visit(page, '/admin/vetting', 'Vetting Pipeline');
    await visit(page, '/admin/contributions', 'Contributions');
    await visit(page, '/admin/dues-sharing', 'Dues Sharing');
    await visit(page, '/admin/reports', 'Reports');
    await visit(page, '/admin/campaigns', 'Action Campaigns');
    await visit(page, '/admin/settings', 'Settings');

    await clerkSignOut(page);
  }

  // =====================================================================
  // PART 3: Member Experience (~90s)
  // =====================================================================
  console.log('\n=== PART 3: Member Experience ===\n');

  let memberSignedIn = false;
  try {
    await clerkSignInWithToken(page, MEMBER_EMAIL, 'James Freedom (Member)');
    memberSignedIn = true;
  } catch (err) {
    console.warn('  !! Member sign-in failed — skipping member walkthrough');
    console.warn(`     ${err instanceof Error ? err.message : err}`);
  }

  if (memberSignedIn) {
    await visit(page, '/dashboard', 'Member Dashboard');
    await visit(page, '/profile', 'Profile');
    await visit(page, '/membership', 'Membership');
    await visit(page, '/contributions', 'Contributions');
    await visit(page, '/my-events', 'My Events');
    await visit(page, '/household', 'Household');
    await visit(page, '/action-center/contact', 'Rep Lookup');
    await visit(page, '/candidate-surveys', 'Candidate Surveys');

    await clerkSignOut(page);
  }

  const parts = [true, adminSignedIn, memberSignedIn];
  const completed = parts.filter(Boolean).length;
  console.log(`\n=== Demo Walkthrough Complete (${completed}/3 parts) ===\n`);

  // Fail the test only if Part 1 somehow failed — auth issues are non-fatal
  // so we always get the video output
  expect(true).toBe(true);
});
