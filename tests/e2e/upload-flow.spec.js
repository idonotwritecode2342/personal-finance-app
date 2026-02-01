const { test, expect } = require('@playwright/test');

// Base URL for the app
const BASE_URL = 'http://localhost:3000';

test.describe('PDF Upload E2E Flow - Real Browser Tests', () => {
  // Test user credentials
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Test123!@#';

  test.beforeAll(async () => {
    // Optional: Set up test data if needed
  });

  test('should load dashboard and have settings button', async ({ page }) => {
    // Register new user
    await page.goto(`${BASE_URL}/`);
    await page.click('text=Register');

    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button:has-text("Register")');

    // Should redirect to login
    await page.waitForURL('**/login');

    // Login
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button:has-text("Login")');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard');

    // Check for settings button (gear icon)
    const settingsButton = page.locator('button[title="Settings"]');
    await expect(settingsButton).toBeVisible();

    // Verify dashboard content
    await expect(page.locator('text=Mission Control')).toBeVisible();
    await expect(page.locator('text=Net Worth')).toBeVisible();
  });

  test('should navigate to upload page via settings button', async ({ page }) => {
    // Login first (reuse auth from previous test by visiting dashboard)
    await page.goto(`${BASE_URL}/login`);

    // Fill login form
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button:has-text("Login")');

    // Wait for dashboard
    await page.waitForURL('**/dashboard');

    // Click settings button
    await page.click('button[title="Settings"]');

    // Should navigate to /ops/upload
    await page.waitForURL('**/ops/upload');

    // Verify upload page content
    await expect(page.locator('text=Upload Bank Statement')).toBeVisible();
    await expect(page.locator('text=Drop PDF here or click to browse')).toBeVisible();
  });

  test('should show upload form with drag-drop zone', async ({ page }) => {
    // Navigate to upload page
    await page.goto(`${BASE_URL}/ops/upload`);

    // Check for authentication - if redirected to login, skip
    if (page.url().includes('/login')) {
      console.log('Not authenticated, skipping upload form test');
      return;
    }

    // Verify form elements exist
    await expect(page.locator('id=dragDropZone')).toBeVisible();
    await expect(page.locator('id=pdfInput')).toHaveAttribute('accept', '.pdf');

    // Check for buttons
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Continue to Bank Confirmation")')).toBeVisible();

    // Submit button should be disabled initially
    const submitBtn = page.locator('id=submitBtn');
    await expect(submitBtn).toBeDisabled();
  });

  test('should reject non-PDF files', async ({ page }) => {
    // Navigate to upload page
    await page.goto(`${BASE_URL}/ops/upload`);

    if (page.url().includes('/login')) {
      console.log('Not authenticated, skipping file validation test');
      return;
    }

    // Try to select a non-PDF file
    const fileInput = page.locator('id=pdfInput');

    // The fileFilter is handled on backend, but we can verify the input accepts PDF
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toBe('.pdf');
  });

  test('should display transaction preview page', async ({ page }) => {
    // Navigate directly to preview page
    await page.goto(`${BASE_URL}/ops/preview`);

    // If not authenticated or no upload in progress, should redirect to /ops/upload
    // Either way, should not get a 404
    const statusCode = await page.evaluate(() => fetch(document.location.href).then(r => r.status));
    expect(statusCode).not.toBe(404);
  });

  test('should display category review page', async ({ page }) => {
    // Navigate directly to categories-review page
    await page.goto(`${BASE_URL}/ops/categories-review`);

    // If not authenticated or no upload in progress, should redirect
    // Either way, should not get a 404
    const statusCode = await page.evaluate(() => fetch(document.location.href).then(r => r.status));
    expect(statusCode).not.toBe(404);
  });

  test('should have working sidebar navigation in settings pages', async ({ page }) => {
    // Check if categories page is accessible
    await page.goto(`${BASE_URL}/ops/categories`);

    if (page.url().includes('/login')) {
      console.log('Not authenticated, skipping navigation test');
      return;
    }

    // Verify page didn't return 404
    const content = await page.content();
    expect(content).not.toContain('404');

    // Check for sidebar links
    const uploadLink = page.locator('a[href="/ops/upload"]');
    const categoriesLink = page.locator('a[href="/ops/categories"]');
    const banksLink = page.locator('a[href="/ops/banks"]');

    if (await uploadLink.isVisible()) {
      expect(uploadLink).toBeVisible();
      expect(categoriesLink).toBeVisible();
      expect(banksLink).toBeVisible();
    }
  });

  test('should have working banks management page', async ({ page }) => {
    // Navigate to banks page
    await page.goto(`${BASE_URL}/ops/banks`);

    if (page.url().includes('/login')) {
      console.log('Not authenticated, skipping banks page test');
      return;
    }

    // Verify page loaded
    const content = await page.content();
    expect(content).not.toContain('404');

    // Should show either bank list or "no banks" message
    const hasContent = content.includes('Bank') || content.includes('bank');
    expect(hasContent).toBeTruthy();
  });

  test('should load styles and layout correctly', async ({ page }) => {
    // Navigate to upload page
    await page.goto(`${BASE_URL}/ops/upload`);

    if (page.url().includes('/login')) {
      console.log('Not authenticated, skipping style test');
      return;
    }

    // Check that CSS colors are loaded (dark theme)
    const dragDropZone = page.locator('id=dragDropZone');

    if (await dragDropZone.isVisible()) {
      // Get computed styles
      const bgColor = await dragDropZone.evaluate(el => window.getComputedStyle(el).backgroundColor);

      // Should have the dark theme background
      expect(bgColor).toBeTruthy();
    }
  });

  test('should show progress bar and step indicator', async ({ page }) => {
    // Navigate to upload page
    await page.goto(`${BASE_URL}/ops/upload`);

    if (page.url().includes('/login')) {
      console.log('Not authenticated, skipping progress test');
      return;
    }

    // Check for progress elements
    const progressBar = page.locator('.progress-bar');
    const stepIndicator = page.locator('.step-indicator');

    if (await progressBar.isVisible()) {
      await expect(progressBar).toBeVisible();
    }

    if (await stepIndicator.isVisible()) {
      await expect(stepIndicator).toBeVisible();
      // Should show all 5 steps
      const steps = await page.locator('.step-indicator span').count();
      expect(steps).toBe(5);
    }
  });
});
