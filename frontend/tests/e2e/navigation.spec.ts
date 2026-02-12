import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CryptoBet/);
  });

  test('navigate to sports page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sports');
    await expect(page).toHaveURL(/sports/);
  });

  test('navigate to casino page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Casino');
    await expect(page).toHaveURL(/casino/);
  });

  test('navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('navigate to register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('Create Account');
  });

  test('login page has required fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register page has required fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('blog page loads', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.locator('h1')).toContainText('Blog');
  });

  test('help center loads', async ({ page }) => {
    await page.goto('/help');
    await expect(page.locator('h1')).toContainText('Help Center');
  });

  test('academy page loads', async ({ page }) => {
    await page.goto('/academy');
    await expect(page.locator('h1')).toContainText('Academy');
  });

  test('VIP page loads', async ({ page }) => {
    await page.goto('/vip');
    await expect(page).toHaveURL(/vip/);
  });
});

test.describe('Responsive Design', () => {
  test('mobile navigation works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('bet slip is accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Bet slip should be hidden on mobile by default
    // and shown via toggle
  });
});

test.describe('Casino Games', () => {
  test('crash game page loads', async ({ page }) => {
    await page.goto('/casino/crash');
    await expect(page).toHaveURL(/casino\/crash/);
  });

  test('dice game page loads', async ({ page }) => {
    await page.goto('/casino/dice');
    await expect(page).toHaveURL(/casino\/dice/);
  });

  test('mines game page loads', async ({ page }) => {
    await page.goto('/casino/mines');
    await expect(page).toHaveURL(/casino\/mines/);
  });

  test('plinko game page loads', async ({ page }) => {
    await page.goto('/casino/plinko');
    await expect(page).toHaveURL(/casino\/plinko/);
  });
});
