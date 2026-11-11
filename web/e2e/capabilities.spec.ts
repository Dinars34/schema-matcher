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
  await expect(page.getByRole('link', { name: 'Katalog' })).toHaveCount(0);
});
