import { test, expect } from '@playwright/test';

const TEST_ADDRESS = '1600 Pennsylvania Ave NW Washington DC 20500';

test.describe('Civic Rep Lookup - /action-center/contact', () => {
  test('API returns officials for a valid address', async ({ request }) => {
    const res = await request.get(
      `/api/v1/civic/representatives?address=${encodeURIComponent(TEST_ADDRESS)}`
    );
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.officials).toBeDefined();
    expect(data.officials.length).toBeGreaterThan(0);
    expect(data.officials[0]).toHaveProperty('name');
    expect(data.officials[0]).toHaveProperty('office');
  });

  test('API returns 400 for missing address', async ({ request }) => {
    const res = await request.get('/api/v1/civic/representatives');
    expect(res.status()).toBe(400);
  });

  test('page auto-searches when address query param is present', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(
      `/action-center/contact?address=${encodeURIComponent(TEST_ADDRESS)}`,
      { waitUntil: 'networkidle' }
    );

    // Input should be populated with the address
    const input = page.locator('input[type="text"]');
    await expect(input).toHaveValue(TEST_ADDRESS);

    // Rep cards should appear
    const repCards = page.locator('[class*="grid"] [class*="rounded"]');
    await expect(repCards.first()).toBeVisible({ timeout: 15000 });

    const count = await repCards.count();
    expect(count).toBeGreaterThan(0);

    // No error messages
    await expect(page.locator('text=Failed to look up')).toHaveCount(0);
    expect(errors.filter((e) => e.includes('500'))).toHaveLength(0);
  });
});
