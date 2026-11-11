import { expect, test } from '@playwright/test';

test('hides unsupported features and disables their direct routes', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        version: 'test',
        contract_version: '1.1.0',
        features: ['queue'],
      }),
    }),
  );
  await page.goto('/submissions');
  await expect(page.getByRole('link', { name: 'Katalog' })).toHaveCount(0);
  await page.goto('/reports/new');
  await expect(page.getByRole('alert')).toContainText('tidak mengumumkan dukungan laporan');
  await expect(page.getByRole('button', { name: 'Unduh laporan' })).toBeDisabled();
  await page.goto('/catalog/entries/entry-unsupported/history');
  await expect(page.getByRole('alert')).toContainText('tidak mengumumkan dukungan riwayat');
  await expect(page.getByText('Memuat riwayat...')).toHaveCount(0);
});

test('shows a truthful disconnected state when health checks fail', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.goto('/settings');
  await expect(page.getByRole('status')).toContainText('Server tidak terhubung');
  await expect(page.getByRole('alert')).toContainText('Server tidak dapat dihubungi');
  await expect(page.locator('.settings-actions')).toContainText('Tidak terhubung');
  await expect(page.getByRole('link', { name: 'Katalog' })).toHaveCount(0);
});

test('settings saves a custom server URL, persists the reviewer, and re-tests the connection', async ({
  page,
}) => {
  let healthCalls = 0;
  const healthUrls: string[] = [];
  await page.route('**/api/health', async (route) => {
    healthCalls += 1;
    healthUrls.push(route.request().url());
    await route.continue();
  });
  await page.route('https://schema-api.example.test/api/health', (route) => {
    healthCalls += 1;
    healthUrls.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        version: 'custom',
        contract_version: '1.1.0',
        features: ['queue'],
      }),
    });
  });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Pengaturan' })).toBeVisible();
  await expect(page.getByLabel('URL server')).toHaveValue(/\/api$/);
  await expect(page.locator('.settings-actions')).toContainText('Terhubung');

  await page.getByLabel('URL server').fill('https://schema-api.example.test/api');
  await page.getByRole('button', { name: 'Uji koneksi' }).click();
  await expect(page.getByLabel('URL server')).toHaveValue('https://schema-api.example.test/api');
  await expect(page.getByText('Versi server custom')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('URL server')).toHaveValue('https://schema-api.example.test/api');

  await page.getByLabel('Nama reviewer').fill('Settings Reviewer');
  await page.reload();
  await expect(page.getByLabel('Nama reviewer')).toHaveValue('Settings Reviewer');

  const callsBeforeTest = healthCalls;
  await page.getByRole('button', { name: 'Uji koneksi' }).click();
  await expect.poll(() => healthCalls).toBeGreaterThan(callsBeforeTest);
  await expect(healthUrls).toContain('https://schema-api.example.test/api/health');
  await expect(page.locator('.settings-actions')).toContainText('Terhubung');
});
