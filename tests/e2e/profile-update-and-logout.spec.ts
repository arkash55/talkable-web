// tests/e2e/profile-update-and-logout.spec.ts
import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('Profile update then logout', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD env vars to run this test.');

  test('login → settings → personal info → update → back → logout', async ({ page }) => {
    test.setTimeout(90_000);

    // Stub Granite to avoid external calls
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

    if (/login|signin/i.test(page.url())) {
      const error = page.locator('[role="alert"], [data-testid*="error"], .error, .toast');
      const txt = (await error.first().isVisible()) ? await error.first().innerText() : '(no error element found)';
      throw new Error(`Still on login page after submit. Visible error: ${txt}`);
    }

    // --- Go to Settings via header tab ---
    const headerTabs = page.locator('[role="tablist"]').first();
    const settingsTab = headerTabs.getByRole('tab', { name: /^settings$/i });
    await expect(settingsTab).toBeVisible({ timeout: 10_000 });
    await settingsTab.click();
    await page.waitForURL(/\/settings\b/i, { timeout: 10_000 });

    // --- Open Personal Info (Account) tile ---
    const accountTile = page.locator('[data-testid="tile-account"]');
    await expect(accountTile).toBeVisible({ timeout: 10_000 });
    await accountTile.click();
    await page.waitForURL(/\/settings\/profile\b/i, { timeout: 10_000 });

    // --- Update "Self description" and save ---
    const desc = page.getByLabel(/^self description$/i).first()
      .or(page.locator('textarea[name="description"], textarea[aria-label*="description" i]'));
    const saveBtn = page.getByRole('button', { name: /save changes/i }).first()
      .or(page.locator('[data-testid="save-profile"]'));
    const newText = `E2E update ${Date.now()}`;

    await desc.fill(newText);
    await saveBtn.click();

    // Wait for saving cycle (button disabled → enabled) if applicable
    try {
      if (await saveBtn.isDisabled()) {
        await expect(saveBtn).toBeEnabled({ timeout: 15_000 });
      }
    } catch {}

    // Best-effort: look for success banner but don't fail if missed (hot reload etc.)
    try {
      const banner = page.locator('.MuiSnackbar-root, [role="alert"], .MuiAlert-root, [data-testid="toast"]');
      await expect(banner).toContainText(/updated|saved|success/i, { timeout: 5_000 });
    } catch {}

    // Verify persisted after reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(desc).toHaveValue(newText, { timeout: 10_000 });

    // --- Return to Settings (resolve strict-mode conflict cleanly) ---
    const backLink = page.getByRole('link', { name: /back to settings/i });
    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
    } else if (await headerTabs.isVisible().catch(() => false)) {
      await settingsTab.click();
    } else {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    }
    await page.waitForURL(/\/settings\b/i, { timeout: 10_000 });

    // --- Logout via tile + confirm in dialog ---
    const logoutTile = page.locator('[data-testid="tile-logout"]');
    await expect(logoutTile).toBeVisible({ timeout: 10_000 });
    await logoutTile.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /^log out$/i }).click();

    // --- Back on login page ---
    await expect(page).toHaveURL(/login|signin/i, { timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: /sign in|log in/i }).first()
        .or(page.locator('[data-testid="login-submit"]'))
    ).toBeVisible();
  });
});
