/**
 * Shared Clerk authentication fixtures for E2E tests.
 *
 * Provides `adminPage` and `memberPage` fixtures that are pre-authenticated
 * via Clerk Backend API sign-in tokens. Test files import `test` and `expect`
 * from this module instead of `@playwright/test`.
 *
 * Env vars:
 *   CLERK_SECRET_KEY   — Required (already in .env / Vercel)
 *   E2E_ADMIN_EMAIL    — Optional override (default: demo-admin@example.com)
 *   E2E_MEMBER_EMAIL   — Optional override (default: demo-member@example.com)
 */

import { test as base, type Page } from '@playwright/test';

const CLERK_API = 'https://api.clerk.com/v1';

function clerkHeaders(): Record<string, string> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error('CLERK_SECRET_KEY env var is required for auth tests');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

/** Resolve an email address to a Clerk user ID via the Backend API. */
async function resolveUserId(email: string): Promise<string> {
  const res = await fetch(
    `${CLERK_API}/users?email_address=${encodeURIComponent(email)}&limit=1`,
    { headers: clerkHeaders() },
  );
  if (!res.ok) throw new Error(`Clerk user lookup failed: ${res.status}`);
  const users = await res.json();
  if (!users[0]?.id) throw new Error(`No Clerk user found for ${email}`);
  return users[0].id;
}

/**
 * Sign in via Clerk sign-in token.
 *
 * Creates a one-time token through the Clerk Backend API, navigates the
 * browser to `/sign-in?__clerk_ticket={token}`, and waits for the redirect
 * away from the sign-in page (confirms session is established).
 */
async function clerkSignIn(page: Page, email: string): Promise<void> {
  const userId = await resolveUserId(email);

  const tokenRes = await fetch(`${CLERK_API}/sign_in_tokens`, {
    method: 'POST',
    headers: clerkHeaders(),
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
  });
  if (!tokenRes.ok) throw new Error(`Clerk sign-in token creation failed: ${tokenRes.status}`);
  const { token } = await tokenRes.json();

  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  await page.goto(`${baseURL}/sign-in?__clerk_ticket=${token}`);

  // Wait for Clerk to process the ticket and redirect away from /sign-in
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), {
    timeout: 30_000,
  });
}

/** Extended test with pre-authenticated page fixtures. */
export const test = base.extend<{ adminPage: Page; memberPage: Page }>({
  adminPage: async ({ page }, use) => {
    await clerkSignIn(page, process.env.E2E_ADMIN_EMAIL || 'demo-admin@example.com');
    await use(page);
  },
  memberPage: async ({ page }, use) => {
    await clerkSignIn(page, process.env.E2E_MEMBER_EMAIL || 'demo-member@example.com');
    await use(page);
  },
});

export { expect } from '@playwright/test';
