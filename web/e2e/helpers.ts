import { createHash } from 'node:crypto';
import * as XLSX from '@e965/xlsx';
import { expect, type Page } from '@playwright/test';

export const API_URL = 'http://127.0.0.1:18771';

export function createWorkbook(): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['wilayah', 'kalori', 'protein'],
    ['Kota A', 1800, 62],
    ['Kota B', 1950, 68],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  return Buffer.from(XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }));
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function uploadFromPage(
  page: Page,
  scenario: string,
  fileName = 'journey.xlsx',
): Promise<{ bytes: Buffer; submissionId: string; jobId: string }> {
  const bytes = createWorkbook();
  await page.route('**/api/submissions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.continue({
      headers: { ...route.request().headers(), 'X-Mock-Scenario': scenario },
    });
  });

  await page.goto('/upload');
  await page.locator('#fi').setInputFiles({
    name: fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: bytes,
  });
  await expect(page.getByRole('heading', { name: 'Schema masuk' })).toHaveCount(0);
  await expect(page.locator('#sh')).toHaveValue('Data');
  await expect(page.getByText('wilayah', { exact: true })).toBeVisible();
  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/submissions') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Mulai analisis' }).click();
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(202);
  const upload = await uploadResponse.json();
  if (typeof upload.job_id !== 'string') {
    throw new Error('Upload response did not contain job_id.');
  }
  await expect(page.getByRole('heading', { name: 'Schema masuk' })).toBeVisible({
    timeout: 20_000,
  });

  const match = page.url().match(/\/submissions\/([^/]+)$/);
  expect(match).not.toBeNull();
  const submissionId = match?.[1];
  if (!submissionId) throw new Error(`Unexpected submission URL: ${page.url()}`);
  return {
    bytes,
    submissionId: decodeURIComponent(submissionId),
    jobId: upload.job_id,
  };
}
