import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('Trending → Home autostart conversation', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD env vars to run this test.');
  test.setTimeout(90_000);

  test('login → general → click trending → home auto-start shows Stop button', async ({ page }) => {
    // Make headless browser "support" speech recognition so autoStart works.
    await page.addInitScript(() => {
      // Minimal shims — enough for feature detection in most libs.
      (window as any).SpeechRecognition = function () {};
      (window as any).webkitSpeechRecognition = function () {};
    });

    // Stub Granite to avoid external network calls
    await page.route('**/api/granite/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ text: 'OK' }], meta: { model_id: 'e2e' } }),
      });
    });

    // --- Login ---
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const emailInput = page.getByLabel(/email/i).first().or(page.locator('[data-testid="email"]'));
    const passwordInput = page.getByLabel(/password/i).first().or(page.locator('[data-testid="password"]'));
    const signInButton = page
      .getByRole('button', { name: /sign in|log in|continue/i })
      .first()
      .or(page.locator('[data-testid="login-submit"]'));

    await emailInput.fill(EMAIL!);
    await passwordInput.fill(PASSWORD!);

    await Promise.all([
      page.waitForURL(/\/(general|home|settings)\b|^\/(?!login|signin)/i, { timeout: 15_000 }).catch(() => {}),
      page.locator('[role="tablist"]').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
      signInButton.click(),
    ]);

    // --- Go to General via header tab (scope to the tablist to avoid chevrons etc.) ---
    const headerTabs = page.locator('[role="tablist"]').first();
    const generalTab = headerTabs.getByRole('tab', { name: /^general$/i });
    await expect(generalTab).toBeVisible({ timeout: 10_000 });
    await generalTab.click();
    await page.waitForURL(/\/general\b/i, { timeout: 10_000 });

    // --- Click the first trending topic tile ---
    // Prefer a stable test id if you have one; otherwise fall back to MUI CardActionArea.
    const firstTrendingTile =
      page.locator('[data-testid^="trending"]').first()
        .or(page.locator('.MuiCardActionArea-root').first());

    await expect(firstTrendingTile).toBeVisible({ timeout: 10_000 });
    await firstTrendingTile.click();

    // After clicking, GeneralClient routes to /home?starter=...&autostart=1
    // HomeClient then strips params, so the final URL can be /home
    await page.waitForURL(/\/home(\?|$)/, { timeout: 15_000 });

    // --- Conversation should auto-start ⇒ "Stop Conversation" button visible ---
    const stopBtn = page.getByRole('button', { name: /^stop conversation$/i });
    await expect(stopBtn).toBeVisible({ timeout: 20_000 });

    // (Optional) Clean up: stop conversation so further tests start from a clean state
    await stopBtn.click();
  });
});
