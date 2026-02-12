import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('shows error on invalid login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('.bg-accent-red\\/10, [class*="error"]')).toBeVisible({ timeout: 10000 });
  });

  test('register form validates required fields', async ({ page }) => {
    await page.goto('/register');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission
    const emailInput = page.locator('input[type="email"]');
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('register form enforces minimum password length', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="text"]', 'testuser');
    await page.fill('input[type="password"]', 'short');

    const passwordInput = page.locator('input[type="password"]');
    const isValid = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('register form enforces minimum username length', async ({ page }) => {
    await page.goto('/register');

    const usernameInput = page.locator('input[type="text"]').first();
    await usernameInput.fill('ab');

    const isValid = await usernameInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
  });

  test('register page has link to login', async ({ page }) => {
    await page.goto('/register');
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });

  test('referral code is populated from URL', async ({ page }) => {
    await page.goto('/register?ref=TESTCODE123');
    const refInput = page.locator('input[disabled]');
    await expect(refInput).toHaveValue('TESTCODE123');
  });
});
