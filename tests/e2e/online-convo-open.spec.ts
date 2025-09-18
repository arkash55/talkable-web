import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('Open an existing ONLINE conversation from General', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD env vars to run this test.');
  test.setTimeout(90_000);

  test('login → general → pick online convo → chat page shows Custom Message', async ({ page }) => {
    // Make headless "support" speech so chat bar renders.
    await page.addInitScript(() => {
      (window as any).SpeechRecognition = function () {};
      (window as any).webkitSpeechRecognition = function () {};
    });

    // Stub Granite
    await page.route('**/api/granite/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ text: 'OK' }], meta: { model_id: 'e2e' } }),
      });
    });

    // --- Login ---
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/email/i).first().or(page.locator('[data-testid="email"]')).fill(EMAIL!);
    await page.getByLabel(/password/i).first().or(page.locator('[data-testid="password"]')).fill(PASSWORD!);
    await Promise.all([
      page.waitForURL(/\/(general|home|settings)\b|^\/(?!login|signin)/i, { timeout: 15_000 }).catch(() => {}),
      page.locator('[role="tablist"]').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
      page.getByRole('button', { name: /sign in|log in|continue/i }).first()
        .or(page.locator('[data-testid="login-submit"]')).click(),
    ]);

    // --- Go to General ---
    const headerTabs = page.locator('[role="tablist"]').first();
    const generalTab = headerTabs.getByRole('tab', { name: /^general$/i });
    await expect(generalTab).toBeVisible({ timeout: 10_000 });
    await generalTab.click();
    await page.waitForURL(/\/general\b/i, { timeout: 10_000 });
    await expect(page.getByText(/^Conversations$/)).toBeVisible({ timeout: 10_000 });

    // --- Switch filter to "Online" (TripleToggle center) ---
    const onlineToggle = page.getByRole('button', { name: /^online$/i }).first();
    if (await onlineToggle.isVisible().catch(() => false)) {
      await onlineToggle.click();
    }

    // Wait for either empty state OR at least one online card
    const emptyState = page.getByText(/No online conversations\.|No matching online conversations\./i);
    const onlineCards =
      // Most reliable: CardActionArea that contains an "Online" Chip
      page.locator('.MuiCardActionArea-root').filter({
        has: page.locator('.MuiChip-root:has-text("Online")'),
      });

    await Promise.race([
      emptyState.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
      onlineCards.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    ]);

    // If empty state visible -> skip; otherwise click first online card
    if (await emptyState.isVisible().catch(() => false)) {
      test.skip('No online conversations available — skipping.');
    }

    // Fallbacks in case of slightly different DOM:
    let target = onlineCards.first();
    if ((await target.count()) === 0) {
      // Paper that has text "Online", then its CardActionArea
      target = page.locator('div.MuiPaper-outlined', { has: page.getByText(/^Online$/) })
                   .locator('.MuiCardActionArea-root').first();
    }
    if ((await target.count()) === 0) {
      // Any CardActionArea that mentions Online
      target = page.locator('.MuiCardActionArea-root:has-text("Online")').first();
    }

    await expect(target).toBeVisible({ timeout: 8000 });
    await target.click();

    // Should navigate to /chat/[cid]
    await page.waitForURL(/\/chat\/[^/?#]+/i, { timeout: 15_000 });

    // Chat page is working if "Custom Message" button is visible
    await expect(page.getByRole('button', { name: /^custom message$/i })).toBeVisible({ timeout: 15_000 });
  });
});
