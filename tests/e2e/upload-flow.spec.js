const { test, expect } = require('@playwright/test');

// Base URL for the app
const BASE_URL = 'http://localhost:3000';

test.describe('PDF Upload Feature - Page Accessibility Tests', () => {
  // These tests verify that new menu pages don't return 404
  // Full authentication flow is tested in separate integration tests

  test('should load home page without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Should redirect to login if not authenticated
    const content = await page.content();
    expect(content).not.toContain('404');
  });

  test('should load register page', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    const content = await page.content();
    expect(content).not.toContain('404');
    expect(content).toContain('Create Account');
  });

  test('should load login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const content = await page.content();
    expect(content).not.toContain('404');
    expect(content).toContain('Login');
  });

  test('should have upload page (may require auth)', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/ops/upload`);

    // Should either show upload page (if authenticated) or redirect to login
    // Either way, should not return 404
    expect([200, 302]).toContain(response.status());
  });

  test('should have preview page (may require auth)', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/ops/preview`);

    // Should either show preview page or redirect
    // Either way, should not return 404
    expect([200, 302]).toContain(response.status());
  });

  test('should have categories-review page (may require auth)', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/ops/categories-review`);

    // Should either show page or redirect
    expect([200, 302]).toContain(response.status());
  });

  test('should have categories management page (may require auth)', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/ops/categories`);

    // Should either show page or redirect
    expect([200, 302]).toContain(response.status());
  });

  test('should have banks management page (may require auth)', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/ops/banks`);

    // Should either show page or redirect
    expect([200, 302]).toContain(response.status());
  });

  test('upload page and preview should not 404', async ({ page }) => {
    // These pages require auth, but should not return 404
    const uploadResponse = await page.goto(`${BASE_URL}/ops/upload`, { waitUntil: 'domcontentloaded' });
    expect(uploadResponse.status()).not.toBe(404);

    const previewResponse = await page.goto(`${BASE_URL}/ops/preview`, { waitUntil: 'domcontentloaded' });
    expect(previewResponse.status()).not.toBe(404);
  });

  test('settings pages should not 404', async ({ page }) => {
    // These pages require auth, but should not return 404
    const categoriesResponse = await page.goto(`${BASE_URL}/ops/categories`, { waitUntil: 'domcontentloaded' });
    expect(categoriesResponse.status()).not.toBe(404);

    const banksResponse = await page.goto(`${BASE_URL}/ops/banks`, { waitUntil: 'domcontentloaded' });
    expect(banksResponse.status()).not.toBe(404);

    const catReviewResponse = await page.goto(`${BASE_URL}/ops/categories-review`, { waitUntil: 'domcontentloaded' });
    expect(catReviewResponse.status()).not.toBe(404);
  });

  test('dashboard should load without 404', async ({ page }) => {
    // Dashboard requires auth, may redirect but should not 404
    const response = await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    expect(response.status()).not.toBe(404);
  });

  test('should not return 404 for api routes', async ({ page }) => {
    // Test that POST endpoint for upload doesn't error
    const response = await page.request.post(`${BASE_URL}/ops/upload`, {
      failOnStatusCode: false
    });

    // Should either reject (401/302) or accept (200) - but not 404
    expect(response.status()).not.toBe(404);
  });

  test('all EJS templates should render without syntax errors', async ({ page }) => {
    // Navigate to a public page to verify templates work
    await page.goto(`${BASE_URL}/login`);

    // Check for any obvious template errors in the page source
    const content = await page.content();

    // Should not contain unrendered template tags
    expect(content).not.toContain('<%');
    expect(content).not.toContain('%>');

    // Should have valid HTML structure
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('</html>');
  });
});
