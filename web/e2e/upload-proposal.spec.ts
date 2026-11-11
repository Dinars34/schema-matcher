import { expect, test } from '@playwright/test';
import { API_URL, createWorkbook, sha256, uploadFromPage } from './helpers';

test('uploads a workbook, follows job progress, and reads persisted bytes and proposal', async ({
  page,
  request,
}) => {
  const { bytes, submissionId, jobId } = await uploadFromPage(page, 'new_dataset');
  await expect(page.locator('.review-summary')).toContainText('Alasan judge');
  await expect(page.locator('.review-summary')).toContainText(
    'Tidak ditemukan dataset yang cukup serupa.',
  );
  await expect(page.locator('.review-summary')).toContainText(
    'Tidak ada entri katalog yang dipasangkan.',
  );
  await expect(page.getByRole('heading', { name: 'Entri katalog yang cocok' })).toBeVisible();
  await expect(page.getByText('Proposal tidak menunjuk ke entri katalog tertentu.')).toBeVisible();

  const detailResponse = await request.get(`${API_URL}/submissions/${submissionId}`);
  expect(detailResponse.ok()).toBeTruthy();
  const detail = await detailResponse.json();
  expect(detail.id).toBe(submissionId);
  expect(detail.status).toBe('draft');
  expect(detail.proposal.incoming.columns.length).toBeGreaterThan(0);

  const fileResponse = await request.get(`${API_URL}/submissions/${submissionId}/file`);
  expect(fileResponse.ok()).toBeTruthy();
  const persistedBytes = await fileResponse.body();
  expect(sha256(persistedBytes)).toBe(sha256(bytes));

  const params = new URLSearchParams({
    submission_id: submissionId,
    file_name: 'journey.xlsx',
  });
  await page.goto(`/jobs/${jobId}?${params.toString()}`);
  await expect(page.getByRole('heading', { name: 'Schema masuk' })).toBeVisible({
    timeout: 10_000,
  });
});

test('rejects unsupported files before sending them to the API', async ({ page }) => {
  await page.goto('/upload');
  await page.locator('#fi').setInputFiles({
    name: 'not-a-workbook.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an Excel file'),
  });
  await expect(page.getByRole('alert')).toContainText('Hanya file Excel');
  await expect(page.getByRole('button', { name: 'Mulai analisis' })).toBeDisabled();
});

test('does not show fabricated progress before the job response arrives', async ({ page }) => {
  await page.route('**/api/jobs/slow-job', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        job_id: 'slow-job',
        status: 'processing',
        progress: 25,
        message: 'Menganalisis workbook.',
      }),
    });
  });
  await page.goto('/jobs/slow-job');
  await expect(page.getByText('Memuat status job...')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
});

test('shows the server failure state and does not navigate to a proposal', async ({ page }) => {
  await page.route('**/api/submissions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.continue({
        headers: { ...route.request().headers(), 'X-Mock-Scenario': 'failed_job' },
      });
    } else {
      await route.continue();
    }
  });
  await page.goto('/upload');
  await page.locator('#fi').setInputFiles({
    name: 'failed.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: createWorkbook(),
  });
  await page.getByRole('button', { name: 'Mulai analisis' }).click();
  await expect(page.getByText('Analisis gagal:')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/jobs\//);
});
