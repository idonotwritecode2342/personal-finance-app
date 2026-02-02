/**
 * E2E Tests for Transaction Filters
 * Tests the filter functionality on the transactions page
 */

const { test, expect } = require('@playwright/test');

test.describe('Transaction Filters', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to transactions page
    await page.goto('http://localhost:3000/dashboard/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('should display transactions page with filters', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1.page-title')).toContainText('All Transactions');

    // Check filter elements exist
    await expect(page.locator('.date-presets')).toBeVisible();
    await expect(page.locator('select[name="transactionType"]')).toBeVisible();
    await expect(page.locator('select[name="category"]')).toBeVisible();
  });

  test('should filter by date preset', async ({ page }) => {
    // Click "This Month" preset
    await page.click('button[data-preset="thisMonth"]');

    // Submit filters
    await page.click('button:has-text("Apply Filters")');
    await page.waitForLoadState('networkidle');

    // Verify URL contains preset parameter
    expect(page.url()).toContain('datePreset=thisMonth');

    // Verify active state on button
    const thisMonthBtn = page.locator('button[data-preset="thisMonth"]');
    await expect(thisMonthBtn).toHaveClass(/active/);
  });

  test('should filter by transaction type', async ({ page }) => {
    // Select "Debits Only"
    await page.selectOption('select[name="transactionType"]', 'debit');

    // Submit filters
    await page.click('button:has-text("Apply Filters")');
    await page.waitForLoadState('networkidle');

    // Verify URL contains type parameter
    expect(page.url()).toContain('transactionType=debit');
  });

  test('should show P&L stat card', async ({ page }) => {
    // Check P&L card exists
    const plCard = page.locator('.stat-card:has-text("Net P&L")');
    await expect(plCard).toBeVisible();

    // Check it has a value
    const plValue = page.locator('.stat-value.positive, .stat-value.negative');
    await expect(plValue).toBeVisible();
  });

  test('should show transaction count', async ({ page }) => {
    // Check total transactions stat
    const countCard = page.locator('.stat-card:has-text("Total Transactions")');
    await expect(countCard).toBeVisible();

    // Should show a number
    const countValue = countCard.locator('.stat-value');
    const count = await countValue.textContent();
    expect(count).toMatch(/^\d+$/);
  });

  test('should maintain filters on page reload', async ({ page }) => {
    // Apply filters
    await page.click('button[data-preset="lastMonth"]');
    await page.selectOption('select[name="transactionType"]', 'credit');
    await page.click('button:has-text("Apply Filters")');
    await page.waitForLoadState('networkidle');

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify filters are still applied
    expect(page.url()).toContain('datePreset=lastMonth');
    expect(page.url()).toContain('transactionType=credit');

    // Verify UI reflects filters
    const lastMonthBtn = page.locator('button[data-preset="lastMonth"]');
    await expect(lastMonthBtn).toHaveClass(/active/);
  });

  test('should navigate using header menu', async ({ page }) => {
    // Check Transactions link is active
    const transactionsLink = page.locator('a.menu-link:has-text("Transactions")');
    await expect(transactionsLink).toHaveClass(/active/);

    // Click Dashboard link
    await page.click('a.menu-link:has-text("Dashboard")');
    await page.waitForURL('**/dashboard');

    // Verify we're on dashboard
    await expect(page.locator('h1')).toContainText('Mission Control');
  });
});
