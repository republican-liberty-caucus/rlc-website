/**
 * RLC Platform Demo Walkthrough
 *
 * Single continuous video recording covering:
 *   Part 1 — Public pages
 *   Part 2 — Admin experience (Sarah Liberty)
 *   Part 3 — Member experience (James Freedom)
 *
 * Run:
 *   BASE_URL=https://rlc-website.vercel.app DEMO_PAUSE_MS=2500 pnpm demo:record
 *
 * Video output: test-results/demo-walkthrough-{hash}/video.webm
 */

import { test, expect, type Page } from '@playwright/test';

const PAUSE_MS = parseInt(process.env.DEMO_PAUSE_MS || '2000', 10);

const ADMIN_EMAIL = 'demo-admin@rlc-demo.test';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'DemoAdmin2026!';
const MEMBER_EMAIL = 'demo-member@rlc-demo.test';
const MEMBER_PASSWORD = process.env.DEMO_MEMBER_PASSWORD || 'DemoMember2026!';

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

/** Sign in through the real Clerk UI. */
async function clerkSignIn(
  page: Page,
  email: string,
  password: string,
  label: string
): Promise<void> {
  console.log(`  >> Signing in as ${label} (${email})`);
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');

  // Clerk renders its own UI — locate email input and fill
  const emailInput = page.locator('input[name="identifier"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);

  // Click continue / submit
  const continueButton = page.locator(
    'button:has-text("Continue"), button[data-localization-key="formButtonPrimary"]'
  );
  await continueButton.click();

  // Wait for password field
  const passwordInput = page.locator('input[name="password"], input[type="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(password);

  // Submit
  const signInButton = page.locator(
    'button:has-text("Continue"), button:has-text("Sign in"), button[data-localization-key="formButtonPrimary"]'
  );
  await signInButton.click();

  // Wait for redirect away from sign-in
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), {
    timeout: 15000,
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

  await clerkSignIn(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Sarah Liberty (Admin)');

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

  // =====================================================================
  // PART 3: Member Experience (~90s)
  // =====================================================================
  console.log('\n=== PART 3: Member Experience ===\n');

  await clerkSignIn(page, MEMBER_EMAIL, MEMBER_PASSWORD, 'James Freedom (Member)');

  await visit(page, '/dashboard', 'Member Dashboard');
  await visit(page, '/profile', 'Profile');
  await visit(page, '/membership', 'Membership');
  await visit(page, '/contributions', 'Contributions');
  await visit(page, '/my-events', 'My Events');
  await visit(page, '/household', 'Household');
  await visit(page, '/action-center/contact', 'Rep Lookup');
  await visit(page, '/candidate-surveys', 'Candidate Surveys');

  await clerkSignOut(page);

  console.log('\n=== Demo Walkthrough Complete ===\n');
});
