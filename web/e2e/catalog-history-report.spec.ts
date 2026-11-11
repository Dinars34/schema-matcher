import { expect, test } from '@playwright/test';
import { API_URL, createWorkbook } from './helpers';

test('browses dataset to entry history and downloads a filtered report', async ({
  page,
  request,
}) => {
  const uploadResponse = await request.post(`${API_URL}/submissions`, {
    multipart: {
      file: {
        name: 'catalog.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: createWorkbook(),
      },
      sheet: 'Data',
    },
    headers: { 'X-Mock-Scenario': 'new_dataset' },
  });
  expect(uploadResponse.status()).toBe(202);
  const upload = await uploadResponse.json();
  const decisionResponse = await request.post(
    `${API_URL}/submissions/${upload.submission_id}/decision`,
    {
      data: { action: 'accept', verdict: 'new_dataset', decided_by: 'Seed Reviewer' },
    },
  );
  expect(decisionResponse.ok()).toBeTruthy();

  const datasetsResponse = await request.get(`${API_URL}/catalog/datasets`);
  const datasets = await datasetsResponse.json();
  expect(datasets.total).toBeGreaterThan(0);
  let entryId: string | undefined;
  for (const dataset of datasets.items as { dataset_id: string }[]) {
    const response = await request.get(
      `${API_URL}/catalog/datasets/${dataset.dataset_id}/entries`,
    );
    const entryPage = await response.json();
    const matchingEntry = entryPage.items.find(
      (entry: { file_name: string; entry_id: string }) => entry.file_name === 'catalog.xlsx',
    );
    if (matchingEntry) {
      entryId = matchingEntry.entry_id;
      break;
    }
  }
  expect(entryId).toBeDefined();
  const historyResponse = await request.get(
    `${API_URL}/catalog/entries/${entryId}/history`,
  );
  expect((await historyResponse.json()).total).toBeGreaterThan(0);
  if (!entryId) throw new Error('The uploaded entry was not found in the catalog.');

  await page.goto('/catalog');
  await page.getByLabel('Cari dataset').fill('catalog.xlsx');
  const datasetButton = page.getByRole('button', { name: /Dataset catalog\.xlsx/ });
  await expect(datasetButton).toHaveCount(1);
  await datasetButton.click();
  const entryButton = page.getByRole('button', { name: 'catalog.xlsx accepted' });
  await expect(entryButton).toBeVisible();
  await entryButton.click();
  await expect(page.getByText(entryId)).toBeVisible();
  await page.getByRole('button', { name: 'Lihat Riwayat Audit' }).click();
  await expect(page.getByText('Seed Reviewer')).toBeVisible();

  await page.goto('/catalog/entries/undefined');
  await expect(page.getByRole('alert')).toContainText('ID entri tidak valid');

  await page.goto('/reports/new');
  await page.locator('#report-status').selectOption('accepted');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh laporan' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  await expect(page.getByText(/baris laporan diunduh/)).toBeVisible();
});

test('shows an explicit empty state for an empty catalog', async ({ page }) => {
  await page.route('**/api/catalog/datasets*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 10 }),
    }),
  );
  await page.goto('/catalog');
  await expect(page.getByText('Tidak ada dataset yang cocok.')).toBeVisible();
});
