/**
 * Admin Vetting Pipeline — E2E tests
 *
 * Covers auth gating, pipeline table rendering, candidate detail navigation,
 * and the vetting report view. Uses the shared Clerk auth fixture.
 */

import { test, expect } from './fixtures/auth';

test.describe('Admin Vetting Pipeline', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/admin/vetting');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('loads pipeline page with table', async ({ adminPage }) => {
    await adminPage.goto('/admin/vetting');
    // PageHeader renders an <h1> with the title
    await expect(adminPage.locator('h1')).toContainText('Candidate Pipeline');
    // Verify key table headers from pipeline-table.tsx
    const headers = adminPage.locator('table thead th');
    await expect(headers.nth(0)).toContainText('Candidate');
    await expect(headers.nth(1)).toContainText('State');
  });

  test('navigates to candidate detail', async ({ adminPage }) => {
    await adminPage.goto('/admin/vetting');
    // "View" link in the Actions column (pipeline-table.tsx:206-208)
    const firstViewLink = adminPage.locator('a:has-text("View")').first();
    await firstViewLink.click();
    await expect(adminPage).toHaveURL(/\/admin\/vetting\/[a-f0-9-]+/);
    // Sidebar shows "Report Progress" heading
    await expect(adminPage.locator('text=Report Progress')).toBeVisible();
  });

  test('renders vetting report', async ({ adminPage }) => {
    await adminPage.goto('/admin/vetting');
    const firstViewLink = adminPage.locator('a:has-text("View")').first();
    await firstViewLink.click();
    // "View Full Report" link navigates to /admin/vetting/{id}/report
    await adminPage.locator('a:has-text("View Full Report")').click();
    await expect(adminPage).toHaveURL(/\/report$/);
    await expect(adminPage.getByText('Republican Liberty Caucus', { exact: true })).toBeVisible();
    await expect(adminPage.locator('text=Export PDF')).toBeVisible();
  });

  test('blocks direct URL access without auth', async ({ page }) => {
    await page.goto('/admin/vetting/some-fake-id');
    await expect(page).toHaveURL(/sign-in/);
  });
});
