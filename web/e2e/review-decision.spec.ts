import { expect, test } from '@playwright/test';
import { API_URL, uploadFromPage } from './helpers';

test('requires a reviewer name, resolves needs-review, and refreshes the queue badge', async ({
  page,
  request,
}) => {
  await page.goto('/settings');
  await page.locator('#reviewer-name').fill('');

  const { submissionId } = await uploadFromPage(page, 'needs_review', 'review.xlsx');
  await expect(page.locator('.review-summary')).toContainText('Alasan judge');
  await expect(page.locator('.review-summary')).toContainText(
    'Hasil pencocokan memerlukan peninjauan manual.',
  );
  await expect(page.locator('.review-summary')).toContainText('Entri katalog yang cocok');
  await expect(page.getByRole('heading', { name: 'Entri katalog yang cocok' })).toBeVisible();
  const acceptButton = page.getByRole('button', { name: 'Terima' });
  await expect(acceptButton).toBeDisabled();
  const missingVerdictResponse = await request.post(
    `${API_URL}/submissions/${submissionId}/decision`,
    { data: { action: 'accept', decided_by: 'Playwright Reviewer' } },
  );
  expect(missingVerdictResponse.status()).toBe(409);
  await page.getByRole('button', { name: 'Ubah verdict' }).click();
  await page.locator('#manual-verdict').selectOption('enrichment');
  await acceptButton.click();
  await expect(page.getByRole('alert')).toContainText('nama reviewer');

  const undecided = await request.get(`${API_URL}/submissions/${submissionId}`);
  expect((await undecided.json()).status).toBe('draft');

  await page.getByRole('link', { name: 'Pengaturan' }).click();
  await page.locator('#reviewer-name').fill('Playwright Reviewer');
  await page.reload();
  await expect(page.locator('#reviewer-name')).toHaveValue('Playwright Reviewer');
  await page.goto(`/submissions/${submissionId}`);
  await page.getByRole('button', { name: 'Ubah verdict' }).click();
  await page.locator('#manual-verdict').selectOption('enrichment');
  await page.getByRole('button', { name: 'Terima' }).click();
  await expect(page).toHaveURL(/\/submissions$/);
  await page.getByRole('link', { name: 'Needs review' }).click();
  await expect(page.getByText('Tidak ada proposal dalam antrean review.')).toBeVisible();
  await expect(page.locator('nav.side a[href="/needs-review"] .n')).toHaveText('0');

  const decided = await request.get(`${API_URL}/submissions/${submissionId}`);
  const result = await decided.json();
  expect(result.status).toBe('merged');
  expect(result.decision.decided_by).toBe('Playwright Reviewer');
});
